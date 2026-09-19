// Camada única de acesso a dados (Supabase). Todas as páginas usam window.Api.
// Requer window.sb (supabase-client.js).
//
// Convenções:
//  - Os objetos devolvidos usam camelCase, como as páginas já esperavam (userId, teamId,
//    pointsIndividual...), e o usuário autenticado tem { uid, id, email, displayName }.
//  - Métodos lançam Error (com .message em português quando vem de RPC) em caso de falha.
(function () {
  var sb = window.sb;
  if (!sb) { console.error('data-api: window.sb indisponível.'); return; }

  // ---------- utilidades ----------
  function must(res) {
    if (res.error) {
      var err = new Error(res.error.message || 'Erro desconhecido');
      err.code = res.error.code;
      throw err;
    }
    return res.data;
  }
  function ms(ts) { return ts ? new Date(ts).getTime() : null; }
  function toUser(u) {
    if (!u) return null;
    var meta = u.user_metadata || {};
    return { uid: u.id, id: u.id, email: u.email || '', displayName: meta.name || '' };
  }
  function mapProfile(p) {
    if (!p) return null;
    return {
      uid: p.id, id: p.id, name: p.name, email: p.email,
      teamId: p.team_id, score: p.score,
      lastActivity: p.last_activity, createdAt: ms(p.created_at), lastLogin: ms(p.last_login)
    };
  }
  function mapTeam(t) {
    return { id: t.id, name: t.name, score: t.score, createdAt: ms(t.created_at), createdBy: t.created_by };
  }
  function mapActivity(a) {
    return {
      id: a.id, userId: a.user_id, teamId: a.team_id, type: a.type,
      pointsIndividual: a.points_individual, pointsTeam: a.points_team,
      description: a.description, activity: a.activity, evidence: a.evidence, color: a.color,
      registeredBy: a.registered_by, timestamp: ms(a.created_at), updatedAt: ms(a.updated_at)
    };
  }
  function mapContent(c) {
    return {
      id: c.id, title: c.title, url: c.url, description: c.description,
      quiz: c.quiz, createdAt: ms(c.created_at), updatedAt: ms(c.updated_at)
    };
  }
  function mapSubmission(s) {
    return {
      id: s.id, userId: s.user_id, userName: s.user_name, track: s.track, level: s.level,
      repoLink: s.repo_link, notes: s.notes, status: s.status,
      timestamp: ms(s.created_at), reviewedAt: ms(s.reviewed_at)
    };
  }

  var Api = {
    client: sb,

    // Escapa texto vindo do banco antes de usar em innerHTML.
    esc: function (v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    // ================= Autenticação =================
    onAuthChange: function (cb) {
      // setTimeout evita deadlock ao chamar o supabase dentro do callback do próprio auth.
      var sub = sb.auth.onAuthStateChange(function (event, session) {
        setTimeout(function () { cb(toUser(session && session.user), event); }, 0);
      });
      return function () { sub.data.subscription.unsubscribe(); };
    },
    currentUser: async function () {
      var r = await sb.auth.getSession();
      return toUser(r.data.session && r.data.session.user);
    },
    signIn: async function (email, password) {
      var d = must(await sb.auth.signInWithPassword({ email: email, password: password }));
      return toUser(d.user);
    },
    signUp: async function (name, email, password) {
      var d = must(await sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } }));
      // Se a confirmação de e-mail estiver ligada, session vem nula.
      // Com confirmação de e-mail ligada, um e-mail já cadastrado volta como usuário sem identities.
      var already = !!(d.user && d.user.identities && d.user.identities.length === 0);
      return { user: toUser(d.user), needsConfirmation: !d.session, alreadyRegistered: already };
    },
    signOut: async function () { must(await sb.auth.signOut()); },
    resetPassword: async function (email, redirectTo) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }));
    },
    updatePassword: async function (newPassword) {
      must(await sb.auth.updateUser({ password: newPassword }));
    },
    // Confirma a senha atual antes de alterar dados sensíveis (equivale à reautenticação do Firebase).
    verifyPassword: async function (password) {
      var u = await Api.currentUser();
      must(await sb.auth.signInWithPassword({ email: u.email, password: password }));
    },
    // O Supabase envia um e-mail de confirmação; profiles.email é atualizado por trigger após confirmar.
    updateEmail: async function (newEmail) {
      must(await sb.auth.updateUser({ email: newEmail }));
    },
    updateDisplayName: async function (name) {
      must(await sb.auth.updateUser({ data: { name: name } }));
    },
    deleteMyAccount: async function () {
      must(await sb.rpc('delete_my_account'));
      await sb.auth.signOut().catch(function () {});
    },
    // Redireciona para o login se não houver sessão. Devolve o usuário ou null.
    requireUser: async function (loginUrl) {
      var u = await Api.currentUser();
      if (!u && loginUrl) window.location.href = loginUrl;
      return u;
    },

    // ================= Perfil e administração =================
    getProfile: async function (uid) {
      var r = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      return mapProfile(must(r));
    },
    updateName: async function (uid, name) {
      must(await sb.from('profiles').update({ name: name }).eq('id', uid));
    },
    updateProfileEmail: async function (uid, email) {
      must(await sb.from('profiles').update({ email: email }).eq('id', uid));
    },
    touchLastLogin: async function (uid) {
      await sb.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', uid);
    },
    // Somente admin (RLS): lista todos os perfis.
    listProfiles: async function () {
      var d = must(await sb.from('profiles').select('*').order('name'));
      return d.map(mapProfile);
    },
    isAdmin: async function () { return must(await sb.rpc('is_admin')) === true; },
    isSuperAdmin: async function () { return must(await sb.rpc('is_super_admin')) === true; },
    // { uid: { isSuper } }
    listAdmins: async function () {
      var d = must(await sb.from('admins').select('user_id,is_super'));
      var out = {};
      d.forEach(function (a) { out[a.user_id] = { isSuper: a.is_super }; });
      return out;
    },
    setAdmin: async function (uid, makeAdmin, byUid) {
      if (makeAdmin) {
        must(await sb.from('admins').insert({ user_id: uid, is_super: false, created_by: byUid }));
      } else {
        must(await sb.from('admins').delete().eq('user_id', uid));
      }
    },
    resetMyProgress: async function () { must(await sb.rpc('reset_my_progress')); },
    resetUserProgress: async function (uid) { must(await sb.rpc('admin_reset_user_progress', { p_user: uid })); },

    // ================= Trilhas paralelas =================
    getTrails: async function () {
      return must(await sb.from('trails').select('*'));
    },
    // { topicKey: boolean }
    getTrailProgress: async function (trailId, uid) {
      uid = uid || (await Api.currentUser()).uid;
      var d = must(await sb.from('trail_progress').select('topic_key,completed').eq('user_id', uid).eq('trail_id', trailId));
      var out = {};
      d.forEach(function (r) { out[r.topic_key] = r.completed; });
      return out;
    },
    saveTrailProgress: async function (trailId, map) {
      var u = await Api.currentUser();
      if (!u) throw new Error('Não autenticado.');
      var rows = Object.keys(map).map(function (k) {
        return { user_id: u.uid, trail_id: trailId, topic_key: k, completed: !!map[k] };
      });
      if (!rows.length) return;
      must(await sb.from('trail_progress').upsert(rows, { onConflict: 'user_id,trail_id,topic_key' }));
    },

    // Árvore de progresso no formato que dashboard/hub/admin já consumiam:
    // { trilha: {topico: bool}, uxui: {level1:{tasks:{id:bool}}, level2_unlocked: true, ...} }
    getProgressTree: async function (uid) {
      uid = uid || (await Api.currentUser()).uid;
      var res = await Promise.all([
        sb.from('trail_progress').select('trail_id,topic_key,completed').eq('user_id', uid),
        sb.from('task_progress').select('content_id,completed,contents!inner(track,level)').eq('user_id', uid),
        sb.from('level_unlocks').select('track,level').eq('user_id', uid)
      ]);
      var tree = {};
      must(res[0]).forEach(function (r) {
        (tree[r.trail_id] = tree[r.trail_id] || {})[r.topic_key] = r.completed;
      });
      must(res[1]).forEach(function (r) {
        var t = (tree[r.contents.track] = tree[r.contents.track] || {});
        var l = (t[r.contents.level] = t[r.contents.level] || { tasks: {} });
        l.tasks[r.content_id] = r.completed;
      });
      must(res[2]).forEach(function (r) {
        (tree[r.track] = tree[r.track] || {})[r.level + '_unlocked'] = true;
      });
      return tree;
    },
    // Somente admin: { uid: { trilha: {topico: bool} } } das trilhas paralelas.
    getAllTrailProgress: async function () {
      var out = {};
      var from = 0, size = 1000;
      for (;;) {
        var d = must(await sb.from('trail_progress').select('user_id,trail_id,topic_key,completed').range(from, from + size - 1));
        d.forEach(function (r) {
          var u = (out[r.user_id] = out[r.user_id] || {});
          (u[r.trail_id] = u[r.trail_id] || {})[r.topic_key] = r.completed;
        });
        if (d.length < size) break;
        from += size;
      }
      return out;
    },

    // ================= Nivelamento: conteúdos e progresso =================
    // { videos: {id: item}, artigos: {...}, links: {...}, cursos: {...} }
    getContents: async function (track, level) {
      var d = must(await sb.from('contents').select('*').eq('track', track).eq('level', level).order('created_at'));
      var out = {};
      d.forEach(function (c) { (out[c.category] = out[c.category] || {})[c.id] = mapContent(c); });
      return out;
    },
    // { track: { level: { categoria: { id: item } } } }
    getContentsTree: async function () {
      var d = must(await sb.from('contents').select('*').order('created_at'));
      var out = {};
      d.forEach(function (c) {
        var t = (out[c.track] = out[c.track] || {});
        var l = (t[c.level] = t[c.level] || {});
        (l[c.category] = l[c.category] || {})[c.id] = mapContent(c);
      });
      return out;
    },
    saveContent: async function (track, level, category, item, id) {
      var row = {
        track: track, level: level, category: category,
        title: item.title, url: item.url, description: item.description || '',
        quiz: item.quiz && item.quiz.length ? item.quiz : null
      };
      if (id) must(await sb.from('contents').update(row).eq('id', id));
      else must(await sb.from('contents').insert(row));
    },
    deleteContent: async function (id) { must(await sb.from('contents').delete().eq('id', id)); },
    // { contentId: boolean } para um nível
    getTaskProgress: async function (track, level, uid) {
      uid = uid || (await Api.currentUser()).uid;
      var d = must(await sb.from('task_progress').select('content_id,completed,contents!inner(track,level)')
        .eq('user_id', uid).eq('contents.track', track).eq('contents.level', level));
      var out = {};
      d.forEach(function (r) { out[r.content_id] = r.completed; });
      return out;
    },
    setTask: async function (contentId, completed) {
      var u = await Api.currentUser();
      must(await sb.from('task_progress').upsert(
        { user_id: u.uid, content_id: contentId, completed: !!completed },
        { onConflict: 'user_id,content_id' }));
    },
    // { level2: true, level3: true }
    getUnlocks: async function (track, uid) {
      uid = uid || (await Api.currentUser()).uid;
      var d = must(await sb.from('level_unlocks').select('level').eq('user_id', uid).eq('track', track));
      var out = {};
      d.forEach(function (r) { out[r.level] = true; });
      return out;
    },

    // ================= Desafios e insígnias =================
    createSubmission: async function (s) {
      var u = await Api.currentUser();
      must(await sb.from('submissions').insert({
        user_id: u.uid, user_name: s.userName || '', track: s.track, level: s.level,
        repo_link: s.repoLink, notes: s.notes || ''
      }));
    },
    listMySubmissions: async function (uid) {
      uid = uid || (await Api.currentUser()).uid;
      var d = must(await sb.from('submissions').select('*').eq('user_id', uid).order('created_at'));
      return d.map(mapSubmission);
    },
    // Somente admin
    listSubmissions: async function () {
      var d = must(await sb.from('submissions').select('*').order('created_at'));
      return d.map(mapSubmission);
    },
    approveSubmission: async function (id) { must(await sb.rpc('approve_submission', { p_id: id })); },
    rejectSubmission: async function (id) { must(await sb.rpc('reject_submission', { p_id: id })); },
    // { badgeId: {id, name, image, date, isNew} }
    getBadges: async function (uid) {
      uid = uid || (await Api.currentUser()).uid;
      var d = must(await sb.from('badges').select('*').eq('user_id', uid));
      var out = {};
      d.forEach(function (b) {
        out[b.badge_id] = { id: b.badge_id, name: b.name, image: b.image, date: ms(b.awarded_at), isNew: b.is_new };
      });
      return out;
    },
    clearBadgeNew: async function (badgeId) {
      var u = await Api.currentUser();
      must(await sb.from('badges').update({ is_new: false }).eq('user_id', u.uid).eq('badge_id', badgeId));
    },

    // ================= Gamificação =================
    listTeams: async function () {
      return must(await sb.from('teams').select('*').order('created_at')).map(mapTeam);
    },
    saveTeam: async function (name, id, byUid) {
      if (id) must(await sb.from('teams').update({ name: name, updated_by: byUid }).eq('id', id));
      else must(await sb.from('teams').insert({ name: name, created_by: byUid }));
    },
    // Lança erro se o time ainda tiver membros.
    deleteTeam: async function (id) { must(await sb.from('teams').delete().eq('id', id)); },
    // Mais recentes primeiro.
    listActivities: async function (opts) {
      opts = opts || {};
      var q = sb.from('activities').select('*').order('created_at', { ascending: false });
      if (opts.userId) q = q.eq('user_id', opts.userId);
      if (opts.limit) q = q.limit(opts.limit);
      return must(await q).map(mapActivity);
    },
    recordActivity: async function (a) {
      var d = must(await sb.rpc('record_activity', {
        p_user_id: a.userId, p_team_id: a.teamId, p_type: a.type,
        p_points_individual: a.pointsIndividual, p_points_team: a.pointsTeam,
        p_description: a.description || ''
      }));
      return mapActivity(d);
    },
    updateActivity: async function (id, a) {
      must(await sb.rpc('update_activity', {
        p_id: id, p_activity: a.activity, p_description: a.description || null,
        p_evidence: a.evidence || '', p_points_individual: a.pointsIndividual, p_points_team: a.pointsTeam
      }));
    },
    deleteActivity: async function (id) { must(await sb.rpc('delete_activity', { p_id: id })); },
    moveMemberTeam: async function (memberId, teamId) {
      must(await sb.rpc('move_member_team', { p_member: memberId, p_new_team: teamId || null }));
    },
    // Público (sem e-mails): [{ uid, name, score, teamId }]
    getLeaderboard: async function () {
      return must(await sb.rpc('get_leaderboard')).map(function (r) {
        return { uid: r.id, id: r.id, name: r.name, score: r.score, teamId: r.team_id };
      });
    },

    // ================= Ranking de trilhas (público) =================
    getPublicRanking: async function () {
      return must(await sb.rpc('get_public_ranking')).map(function (r) {
        return { uid: r.user_id, name: r.name, score: r.score };
      });
    },
    getPublicStats: async function () {
      var d = must(await sb.rpc('get_public_stats'));
      var r = Array.isArray(d) ? d[0] : d;
      return { totalUsers: r ? r.total_users : 0, lastUpdate: r ? ms(r.last_update) : null };
    },

    // ================= Realtime =================
    // Chama cb() a cada mudança na tabela (as páginas então recarregam os dados).
    // Devolve uma função para cancelar.
    watch: function (table, cb) {
      var ch = sb.channel('watch-' + table + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, function () { cb(); })
        .subscribe();
      return function () { sb.removeChannel(ch); };
    }
  };

  window.Api = Api;
})();
