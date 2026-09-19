// Importa o export JSON do Realtime Database do Firebase para o Supabase.
//
//   node scripts/migrate-from-firebase.mjs --dry-run     (só lê o JSON e mostra o que faria)
//   node scripts/migrate-from-firebase.mjs               (importa de verdade)
//   node scripts/migrate-from-firebase.mjs --send-reset  (importa e envia e-mail de nova senha)
//
// Requer .env com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e FIREBASE_EXPORT_PATH.
// A service_role key NUNCA vai para o front-end: este script roda só na sua máquina.
// É idempotente: pode ser executado de novo (usa firebase_uid / firebase_key para upsert).
//
// Senhas não são migradas (hash scrypt do Firebase): os usuários precisam redefinir a senha.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const SEND_RESET = args.has('--send-reset');

// ---------- .env ----------
function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
const env = { ...loadDotEnv(resolve(root, '.env')), ...process.env };

const exportPath = resolve(root, env.FIREBASE_EXPORT_PATH || 'SIGAV/hub-de-conhecimento-default-rtdb-export.json');
if (!existsSync(exportPath)) {
  console.error(`Export não encontrado: ${exportPath}`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(exportPath, 'utf8'));

// ---------- constantes de mapeamento ----------
const TRACKS = new Set(['uxui', 'frontend', 'backend']);
const LEVELS = new Set(['level1', 'level2', 'level3']);
const CATEGORIES = new Set(['videos', 'artigos', 'links', 'cursos']);
// ids de trilha antigos (camelCase) → ids atuais (iguais aos gravados pelas páginas)
const TRAIL_ALIASES = { javaScript: 'javascript', Scrum: 'scrum', Metodologia_5S: 'metodologia_5s' };
const VALID_TRAILS = new Set([
  'html_e_css', 'javascript', 'git_e_github', 'python_basico', 'django', 'vue', 'typescript', 'ux_ui',
  'scrum', 'metodologia_5s', 'gestao_de_tempo', 'desenvolvimento_humano', 'financeiro',
  'marketing_comercial', 'okrs_kpis_e_bpmn', 'wordpress', 'historia_eject'
]);
const LEVEL_ALIASES = { basico: 'level1', intermediario: 'level2', avancado: 'level3' };

const report = { skipped: [], counts: {} };
const skip = (what, why) => report.skipped.push(`${what}: ${why}`);
const iso = (ms) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null);
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const normLevel = (l) => {
  const v = String(l ?? '').trim().toLowerCase();
  return LEVELS.has(v) ? v : LEVEL_ALIASES[v] || null;
};
const normTrack = (t) => {
  const v = String(t ?? '').trim().toLowerCase();
  return TRACKS.has(v) ? v : null;
};

// ---------- cliente Supabase ----------
let sb = null;
if (!DRY) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env (ou use --dry-run).');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js').catch(() => {
    console.error('Instale as dependências: npm install');
    process.exit(1);
  });
  sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function upsert(table, rows, onConflict) {
  report.counts[table] = (report.counts[table] || 0) + rows.length;
  if (DRY || rows.length === 0) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data: res, error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict }).select();
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...res);
  }
  return out;
}

// ---------- 1. usuários (Auth + profiles) ----------
const users = data.users || {};
const profilesNode = data.profiles || {};
const uidMap = new Map(); // firebase uid -> uuid do Supabase

async function findAuthUserByEmail(email) {
  // listUsers é paginado; para poucos usuários basta percorrer as páginas.
  for (let page = 1; page < 100; page++) {
    const { data: res, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = res.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (res.users.length < 1000) return null;
  }
  return null;
}

for (const [fbUid, u] of Object.entries(users)) {
  const email = (u.email || profilesNode[fbUid]?.email || '').trim();
  if (!email) { skip(`users/${fbUid}`, 'sem e-mail (não dá para criar a conta)'); continue; }
  const name = u.name || profilesNode[fbUid]?.name || email.split('@')[0];

  if (DRY) { uidMap.set(fbUid, `dry-${fbUid}`); continue; }

  let authUser;
  const created = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } });
  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) authUser = await findAuthUserByEmail(email);
    else throw new Error(`createUser ${email}: ${created.error.message}`);
  } else {
    authUser = created.data.user;
  }
  if (!authUser) { skip(`users/${fbUid}`, 'não foi possível criar/encontrar a conta'); continue; }
  uidMap.set(fbUid, authUser.id);

  // O trigger já criou a linha em profiles; aqui completamos os dados.
  const gam = { ...(u.gamification || {}), ...(profilesNode[fbUid]?.gamification || {}) };
  const { error } = await sb.from('profiles').update({
    firebase_uid: fbUid,
    name,
    email,
    score: Math.max(0, parseInt(profilesNode[fbUid]?.gamification?.score ?? u.gamification?.score ?? 0) || 0),
    created_at: iso(u.createdAt) ?? undefined,
    last_login: iso(u.lastLogin) ?? undefined,
    last_activity: gam.lastActivity ?? null
  }).eq('id', authUser.id);
  if (error) throw new Error(`profiles ${email}: ${error.message}`);

  if (SEND_RESET) {
    await sb.auth.resetPasswordForEmail(email, { redirectTo: env.PASSWORD_RESET_URL || undefined });
  }
}
report.counts.users = uidMap.size;

// ---------- 2. admins ----------
const adminRows = Object.entries(data.admins || {})
  .filter(([, v]) => v === true)
  .map(([fbUid]) => ({ fbUid, id: uidMap.get(fbUid) }))
  .filter((a) => { if (!a.id) { skip(`admins/${a.fbUid}`, 'usuário não importado'); return false; } return true; })
  .map((a) => ({ user_id: a.id, is_super: false }));
// Super admin: informe SUPER_ADMIN_EMAIL no .env (ou defina depois pelo SQL do schema.sql)
await upsert('admins', adminRows, 'user_id');
if (!DRY && env.SUPER_ADMIN_EMAIL) {
  const { error } = await sb.from('admins').upsert(
    { user_id: (await findAuthUserByEmail(env.SUPER_ADMIN_EMAIL))?.id, is_super: true }, { onConflict: 'user_id' });
  if (error) console.warn('Super admin não definido:', error.message);
}

// ---------- 3. times ----------
const teamsNode = data.gamification?.teams || {};
const teamRows = Object.entries(teamsNode).map(([key, t]) => ({
  firebase_key: key,
  name: t.name || `Equipe ${key}`,
  score: Math.max(0, parseInt(t.score) || 0),
  created_at: iso(t.createdAt) ?? undefined,
  created_by: uidMap.get(t.createdBy) ?? null
}));
const teamIds = new Map(); // firebase key -> uuid
const teamByName = new Map();
(await upsert('teams', teamRows, 'firebase_key')).forEach((r) => { teamIds.set(r.firebase_key, r.id); teamByName.set(r.name, r.id); });
if (DRY) teamRows.forEach((r) => { teamIds.set(r.firebase_key, `dry-${r.firebase_key}`); teamByName.set(r.name, `dry-${r.firebase_key}`); });
const resolveTeam = (v) => (v ? teamIds.get(v) ?? teamByName.get(v) ?? null : null);

// time de cada perfil (profiles.gamification.teamId tem prioridade sobre users.gamification.teamId)
if (!DRY) {
  for (const [fbUid, id] of uidMap) {
    const fbTeam = profilesNode[fbUid]?.gamification?.teamId ?? users[fbUid]?.gamification?.teamId;
    const teamId = resolveTeam(fbTeam);
    if (fbTeam && !teamId) skip(`profiles/${fbUid}`, `time "${fbTeam}" não encontrado`);
    if (teamId) await sb.from('profiles').update({ team_id: teamId }).eq('id', id);
  }
}

// ---------- 4. conteúdos ----------
const contentRows = [];
const contentIds = new Map(); // firebase push id -> uuid
for (const [track, levels] of Object.entries(data.contents || {})) {
  for (const [level, cats] of Object.entries(levels || {})) {
    for (const [cat, items] of Object.entries(cats || {})) {
      for (const [key, item] of Object.entries(items || {})) {
        if (!TRACKS.has(track) || !LEVELS.has(level) || !CATEGORIES.has(cat)) { skip(`contents/${track}/${level}/${cat}/${key}`, 'trilha/nível/categoria inválidos'); continue; }
        if (!item?.title || !isUrl(item.url)) { skip(`contents/${track}/${level}/${cat}/${key}`, 'título ou URL http(s) ausente'); continue; }
        const quiz = item.quiz ? (Array.isArray(item.quiz) ? item.quiz : [item.quiz]) : null;
        contentRows.push({
          firebase_key: key, track, level, category: cat,
          title: item.title, url: item.url, description: item.description || '',
          quiz, created_at: iso(item.createdAt) ?? undefined, updated_at: iso(item.updatedAt)
        });
      }
    }
  }
}
(await upsert('contents', contentRows, 'firebase_key')).forEach((r) => contentIds.set(r.firebase_key, r.id));
if (DRY) contentRows.forEach((r) => contentIds.set(r.firebase_key, `dry-${r.firebase_key}`));

// ---------- 5. progresso, liberações e insígnias ----------
const trailRows = [], taskRows = [], unlockRows = [], badgeRows = [];
for (const [fbUid, u] of Object.entries(users)) {
  const id = uidMap.get(fbUid);
  if (!id) continue;

  for (const [key, value] of Object.entries(u.progress || {})) {
    if (TRACKS.has(key)) {
      // trilha de nivelamento: { level1: {tasks:{contentKey: bool}}, level2_unlocked: true, ... }
      for (const [k, v] of Object.entries(value || {})) {
        const unlock = k.match(/^(level[23])_unlocked$/);
        if (unlock) { if (v === true) unlockRows.push({ user_id: id, track: key, level: unlock[1] }); continue; }
        if (!LEVELS.has(k)) continue;
        for (const [contentKey, done] of Object.entries(v?.tasks || {})) {
          const contentId = contentIds.get(contentKey);
          if (!contentId) { skip(`users/${fbUid}/progress/${key}/${k}/tasks/${contentKey}`, 'conteúdo não importado'); continue; }
          taskRows.push({ user_id: id, content_id: contentId, completed: done === true });
        }
      }
      continue;
    }
    const trailId = TRAIL_ALIASES[key] || key;
    if (!VALID_TRAILS.has(trailId)) { skip(`users/${fbUid}/progress/${key}`, 'trilha desconhecida'); continue; }
    if (!value || typeof value !== 'object') { skip(`users/${fbUid}/progress/${key}`, 'formato inesperado'); continue; }
    for (const [topic, done] of Object.entries(value)) {
      if (typeof done !== 'boolean') continue;
      trailRows.push({ user_id: id, trail_id: trailId, topic_key: topic, completed: done });
    }
  }

  for (const [badgeId, b] of Object.entries(u.badges || {})) {
    badgeRows.push({
      user_id: id, badge_id: badgeId, name: b.name || badgeId, image: b.image || '../img/logo.svg',
      awarded_at: iso(b.date) ?? undefined, is_new: b.isNew === true
    });
  }
}
await upsert('trail_progress', trailRows, 'user_id,trail_id,topic_key');
await upsert('task_progress', taskRows, 'user_id,content_id');
await upsert('level_unlocks', unlockRows, 'user_id,track,level');
await upsert('badges', badgeRows, 'user_id,badge_id');

// ---------- 6. submissões ----------
const submissionRows = [];
for (const [key, sub] of Object.entries(data.submissions || {})) {
  const userId = uidMap.get(sub.userId);
  const track = normTrack(sub.track), level = normLevel(sub.level);
  if (!userId || !track || !level || !isUrl(sub.repoLink)) { skip(`submissions/${key}`, 'usuário/trilha/nível/link inválido'); continue; }
  submissionRows.push({
    firebase_key: key, user_id: userId, user_name: sub.userName || '', track, level,
    repo_link: sub.repoLink, notes: sub.notes || '',
    status: ['pending', 'approved', 'rejected'].includes(sub.status) ? sub.status : 'pending',
    created_at: iso(sub.timestamp) ?? undefined, reviewed_at: iso(sub.reviewedAt)
  });
}
await upsert('submissions', submissionRows, 'firebase_key');

// ---------- 7. atividades da gamificação ----------
const activityRows = [];
for (const [key, a] of Object.entries(data.gamification?.activities || {})) {
  const userId = uidMap.get(a.userId) ?? null;
  if (a.userId && !userId) skip(`gamification/activities/${key}`, 'usuário não importado (atividade mantida sem usuário)');
  activityRows.push({
    firebase_key: key, user_id: userId, team_id: resolveTeam(a.teamId) ?? resolveTeam(a.team),
    type: a.type || 'task',
    points_individual: Math.max(0, parseInt(a.pointsIndividual) || 0),
    points_team: Math.max(0, parseInt(a.pointsTeam) || 0),
    description: a.description || '', activity: a.activity ?? null, evidence: a.evidence ?? null,
    color: a.color ?? null, status: a.status ?? null,
    registered_by: uidMap.get(a.registeredBy) ?? null,
    created_at: iso(a.timestamp) ?? undefined, updated_at: iso(a.updatedAt), updated_by: uidMap.get(a.updatedBy) ?? null
  });
}
await upsert('activities', activityRows, 'firebase_key');

// ---------- relatório ----------
console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Importação concluída a partir de ${exportPath}`);
console.table(report.counts);
if (report.skipped.length) {
  console.log(`\n${report.skipped.length} item(ns) ignorado(s):`);
  report.skipped.forEach((s) => console.log(' -', s));
}
console.log('\nNós do Firebase não importados por decisão: backups/*, public/ranking, public/stats (agora calculados pelo banco).');
if (!SEND_RESET) console.log('Os usuários precisam usar "Esqueci a senha" no primeiro acesso (ou rode com --send-reset).');
