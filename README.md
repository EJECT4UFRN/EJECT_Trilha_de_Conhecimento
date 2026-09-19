![Logo](https://www.ejectufrn.com.br/svgs/logo.svg)

# EJECT - Trilha de Conhecimento

Bem-vindo(a) ao repositório da Trilha de Conhecimento da EJECT (Empresa Júnior da Escola de Ciências e Tecnologia da UFRN). Este projeto foi desenvolvido com o objetivo de auxiliar novos aspirantes e integrantes que estão ingressando na EJECT. Aqui, você encontrará materiais de estudo, atividades práticas e diretrizes para o desenvolvimento de habilidades essenciais no ambiente de trabalho da empresa.

## Objetivo

A Trilha de Conhecimento tem como propósito:

- Facilitar a integração dos novos membros à cultura e processos da EJCT.
- Oferecer um caminho estruturado de aprendizado nas principais áreas de atuação da empresa.
- Incentivar o desenvolvimento técnico e interpessoal através de atividades e desafios práticos.

## Arquitetura e banco de dados (Supabase)

O site é estático (HTML/JS, GitHub Pages, sem build). Login, banco de dados e regras de negócio ficam no **Supabase** (Auth + PostgreSQL + RLS + funções SQL). O acesso ao banco é centralizado em três arquivos em `SIGAV/`:

| Arquivo                | Função                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `supabase-config.js` | **Gerado** (não versionado): URL do projeto e chave *publishable*                              |
| `supabase-client.js` | Cria o cliente (`window.sb`)                                                                          |
| `data-api.js`        | `window.Api`: todas as operações que as páginas usam (login, progresso, ranking, gamificação...) |

> O módulo **Metrific** (`SIGAV/Metrific`) é um app à parte, com projeto Firebase próprio, e não faz parte desta migração.

### Configurando o Supabase do zero

1. **Crie um projeto** em [https://supabase.com/dashboard](https://supabase.com/dashboard) (guarde a senha do banco).
2. **Crie as tabelas:** abra *SQL Editor → New query*, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em *Run*. O script cria enums, tabelas, índices, funções, triggers, políticas de RLS, permissões, Realtime e o seed das trilhas. Pode ser executado mais de uma vez.
3. **Configure a autenticação** (*Authentication*):
   - *Providers → Email*: habilitado. Decida se exige confirmação de e-mail (recomendado). Com confirmação ligada, o cadastro avisa o usuário para confirmar o e-mail antes de entrar.
   - *URL Configuration*: defina a **Site URL** (ex.: `https://eject4ufrn.github.io/EJECT_Trilha_de_Conhecimento/`) e inclua em **Redirect URLs** a página `.../SIGAV/recuperar-senha.html` (e `http://127.0.0.1:5501/SIGAV/recuperar-senha.html` para desenvolvimento). É para lá que o link de "esqueci a senha" leva.
4. **Copie as chaves** em *Project Settings → API*: `Project URL` e a chave **publishable** (ou `anon`). Nunca use a `service_role` no site.
5. **Configure o ambiente local:**
   ```bash
   cp .env.example .env        # preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY
   node scripts/generate-config.mjs   # gera SIGAV/supabase-config.js
   ```

   Depois abra o site com o Live Server (porta 5501). Sem o passo do `generate-config` o site não conecta.
6. **Crie o primeiro administrador:** cadastre-se pelo site (`SIGAV/login.html`) e, no SQL Editor, rode (troque o e-mail):
   ```sql
   insert into public.admins (user_id, is_super)
   select id, true from public.profiles where email = 'SEU_EMAIL@exemplo.com'
   on conflict (user_id) do update set is_super = true;
   ```

   A partir daí, o painel *Gerenciar admins* do SIGAV promove os demais administradores.

### Variáveis de ambiente

| Variável                     | Usada por                                   | Observação                                       |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `SUPABASE_URL`              | site (via`generate-config`) e scripts     | URL do projeto                                     |
| `SUPABASE_PUBLISHABLE_KEY`  | site (via`generate-config`)               | Pública; protegida pelo RLS                       |
| `SUPABASE_SERVICE_ROLE_KEY` | **só** `migrate-from-firebase.mjs` | Secreta. Nunca no front nem no git                 |
| `FIREBASE_EXPORT_PATH`      | `migrate-from-firebase.mjs`               | Export JSON do Realtime Database                   |
| `SUPER_ADMIN_EMAIL`         | `migrate-from-firebase.mjs` (opcional)    | Marca esse e-mail como super admin na importação |

### Deploy (GitHub Pages)

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) gera o `supabase-config.js` a partir de *Secrets* e publica o site. É preciso fazer **manualmente, uma vez**:

1. *Settings → Secrets and variables → Actions*: criar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
2. *Settings → Pages → Build and deployment → Source*: escolher **GitHub Actions**.

### Migrando os dados que estavam no Firebase

```bash
npm install
# .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_EXPORT_PATH (e SUPER_ADMIN_EMAIL, se quiser)
npm run migrate:dry     # apenas mostra o que seria importado
npm run migrate         # importa (idempotente: pode rodar de novo)
```

Exporte o JSON atualizado em *Firebase Console → Realtime Database → ⋮ → Export JSON*. O script cria as contas no Supabase Auth, preserva progresso, insígnias, conteúdos, envios de desafio, times e atividades, e imprime o que foi ignorado. **As senhas não migram** (o Firebase usa outro hash): cada usuário deve usar *Esqueci a senha* no primeiro acesso (ou rode com `--send-reset` para enviar o e-mail de nova senha). `backups/*`, `public/ranking` e `public/stats` não são importados: o ranking agora é calculado pelo banco.

### Testes do banco

Requer Docker e `psql`:

```bash
docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17
export PGPASSWORD=pw
psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap_local.sql -f supabase/schema.sql
psql -h localhost -p 55432 -U postgres -f supabase/tests/rls_test.sql   # termina com "OK"
```

`bootstrap_local.sql` só simula o que o Supabase já traz (roles e o schema `auth`); **nunca** o execute num projeto Supabase.

### Regras de negócio no banco

- Pontuações (individual e de time) só mudam por funções SQL (`record_activity`, `update_activity`, `delete_activity`, `move_member_team`), sem escrita direta pelo navegador.
- Aprovar um desafio (`approve_submission`) marca o envio, concede a insígnia e libera o próximo nível numa única transação.
- O ranking das trilhas (`get_public_ranking`) usa 10 pontos por tópico × multiplicador da tabela `trails`.
- Quem é administrador vem da tabela `admins`; e-mails fixos no código foram removidos.

## Contribuições

Contribuições para a Trilha de Conhecimento são bem-vindas! Para contribuir, siga os passos abaixo:

1. **Fork o repositório:** Clique no botão "Fork" no canto superior direito da página do repositório no GitHub.
2. **Clone seu fork:** Depois de criar um fork, clone-o em sua máquina local:

```bash
git clone https://github.com/seu-usuario/trilha-conhecimento.git
```

3. **Faça suas alterações:** Navegue até o diretório do seu fork e faça as alterações que você deseja contribuir.
4. **Commit suas alterações:**

```bash
git add .
git commit -m "Descrição da minha contribuição"
```

5. **Envie suas alterações para o fork:**

```bash
git push origin main
```

6. **Abra um pull request:** Volte para o repositório original e clique em "New Pull Request" para enviar suas alterações para revisão.

## Direitos Autorais

As logos e o nome da EJECT são de propriedade exclusiva da empresa e estão protegidos por direitos autorais. O uso não autorizado dessas marcas é proibido.

O conteúdo deste repositório consiste em duas partes:

- **Conteúdo Autoral:** Materiais e diretrizes desenvolvidos pela equipe da EJECT.
- **Conteúdo de Terceiros:** Materiais obtidos de fontes externas, utilizados para fins educacionais e de capacitação dos membros e aspirantes da EJECT.
  O uso desse conteúdo segue as permissões e licenças dos respectivos autores. Se você tiver interesse em utilizar ou adaptar este material fora do contexto da EJECT, verifique as licenças de cada parte do conteúdo ou entre em contato conosco através do e-mail: contato@ejectufrn.com.br.
