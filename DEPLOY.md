# Deploy: Supabase (banco) + Render (API) + Netlify (site)

Ordem: **1) Supabase → 2) Render → 3) Netlify → 4) voltar ao Render ajustar o CORS.**

## 0. Código no GitHub
Render e Netlify publicam a partir de um repositório Git.
```
cd sistema
git init
git add .
git commit -m "Sistema TI hospitalar"
# crie um repositório PRIVADO no GitHub e envie:
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```
Os arquivos `.env` já estão no .gitignore (não sobem). **Mantenha o repositório privado**: o SQL do Supabase
contém a senha provisória do admin.

## 1. Supabase (banco)
1. Crie um projeto em supabase.com (região mais próxima: São Paulo).
2. **SQL Editor → New query** → cole o conteúdo de `database/supabase/001_migracao_completa.sql` → **Run**.
   (Rode uma vez, em banco vazio. Cria tabelas, unidade SIG, setores, tipos e o usuário admin.)
3. **Connect → Session pooler** → copie a connection string e troque `[YOUR-PASSWORD]` pela senha do banco.
   Use o **pooler** (IPv4): a conexão direta é só IPv6 e não funciona no Render.

## 2. Render (API)
1. **New → Blueprint** → escolha o repositório (usa o `render.yaml`). Ou **New → Web Service** com:
   Root Directory `backend`, Build `npm ci`, Start `npm start`.
2. Variáveis de ambiente:
   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | string do Session pooler (passo 1.3), **sem** `?sslmode=` |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | chave longa e aleatória (comando abaixo) |
   | `CORS_ORIGIN` | `https://SEU-SITE.netlify.app` (preencha depois do passo 3) |
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Após o deploy, teste: `https://SEU-BACKEND.onrender.com/api/saude` → `{"ok":true}`.
   No plano free o serviço "dorme" após 15 min sem uso; o primeiro acesso demora ~30 s.

## 3. Netlify (site)
1. **Add new site → Import from Git** → escolha o repositório.
2. Base directory `frontend` · Build `npm run build` · Publish `dist` (o `netlify.toml` já define).
3. **Site settings → Environment variables**: `VITE_API_URL` = `https://SEU-BACKEND.onrender.com` (sem barra no fim).
4. **Deploy**. Copie a URL do site (ex.: `https://sig-ti.netlify.app`).

## 4. Fechar o ciclo
No Render, ajuste `CORS_ORIGIN` para a URL do Netlify e salve (reinicia sozinho).
Se usar domínio próprio, liste os dois separados por vírgula.

## Primeiro acesso
Usuário `admin` + senha provisória do SQL; o sistema obriga a trocar na primeira entrada.
Depois crie os técnicos em **Usuários** (cada um já recebe senha provisória e troca ao entrar).

## Problemas comuns
- **"Erro ao comunicar com o servidor"**: `VITE_API_URL` errada/ausente, ou API dormindo (aguarde ~30 s).
- **Erro de CORS no navegador**: `CORS_ORIGIN` diferente da URL real do Netlify (confira https e sem barra final).
- **API não conecta no banco**: usou a conexão direta (IPv6) em vez do Session pooler, ou esqueceu `DATABASE_SSL=true`.
