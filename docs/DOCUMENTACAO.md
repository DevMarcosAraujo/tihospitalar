# Mapeamento de TI — MedSênior SIG (Brasília/DF)

Documentação do que foi construído, das regras do sistema e de como publicar.
Repositório: https://github.com/DevMarcosAraujo/tihospitalar

> **Segurança:** este arquivo não contém senhas nem chaves. Senhas do banco, `JWT_SECRET` e senha provisória
> do administrador ficam só no painel do Render/Supabase e com o responsável.

---

## 1. Visão geral

Sistema web para mapear os equipamentos de TI da unidade, organizados por **unidade → divisão → setor**.
Substitui o antigo HTML com Firebase.

| Camada | Tecnologia | Onde roda |
|---|---|---|
| Frontend | React + Vite | Netlify |
| Backend (API REST `/api`) | Node.js + Express + JWT | Render |
| Banco de dados | PostgreSQL | Supabase |

Estrutura do repositório:

```
sistema/
├── backend/    API (src/modules: auth, usuarios, unidades, setores, equipamentos, dashboard, relatorios, configuracoes, recursos)
├── frontend/   Interface (src/pages: login, dashboard, unidades, setores, mapeamento, beira-leito, usuarios, relatorios, configuracoes)
├── database/   schema.sql, migrations/001..010, seeds/, supabase/001_migracao_completa.sql
├── docs/       documentação
├── render.yaml / frontend/netlify.toml / DEPLOY.md
```

---

## 2. Perfis e permissões

| Ação | Técnico | Administrador |
|---|---|---|
| Ver equipamentos e setores | Só da **própria unidade** | Todas (ou a unidade escolhida no menu) |
| Ver a ficha do equipamento (inclui senha de acesso remoto) | Sim | Sim |
| Adicionar equipamento | Sim | Sim |
| Editar / inativar / excluir equipamento | Não | Sim |
| Cadastrar modelo de impressora | Sim | Sim |
| Definir link/pasta de drivers | Não | Sim |
| Unidades, setores, usuários, relatórios, configurações | Não | Sim |
| Mapeamento (tela) | Só se o admin liberar | Sempre |

- **Técnico fixo em uma unidade**: o backend filtra unidades, setores, equipamentos e dashboard pela unidade dele.
- **Admin** escolhe a unidade no seletor do menu ("Todas as unidades" ou uma específica); a escolha fica salva.
- **Mapeamento para técnicos**: desligado por padrão. O admin liga/desliga com o botão
  "Liberar para técnicos" / "Ocultar dos técnicos" na própria tela.

---

## 3. Acesso e senhas

- Login **sem diferenciar maiúsculas** (`Admin` = `admin`); o banco impede dois usuários que só diferem pela caixa.
- O admin define uma **senha provisória** ao criar o usuário ou ao usar o botão de chave (**Redefinir senha**,
  que gera uma senha aleatória mostrada uma única vez).
- No **primeiro acesso** (ou após redefinição) o usuário é obrigado a criar uma nova senha antes de usar o sistema.
  O backend bloqueia as demais rotas até a troca.
- Senhas guardadas com bcrypt. Mínimo de 6 caracteres.

---

## 4. Estrutura: unidade, divisão e setor

- **Unidade**: hoje existe a **SIG** (MedSênior SIG — Brasília/DF).
- **Divisão** (campo `localizacao` do setor): *Setor PS/CDM*, *UTI*, *Centro Cirúrgico*. O admin pode criar outras.
- **Setor**: 37 setores importados do HTML antigo (21 no PS/CDM, 6 na UTI, 9 no Centro Cirúrgico, mais 1 criado depois).
- Nas telas, as divisões aparecem **minimizadas** e abrem ao clicar. Existe busca por setor e por equipamento.
- Para adicionar outra unidade: **Unidades → Nova unidade**, cadastrar os setores dela e criar os técnicos
  escolhendo essa unidade. Cada técnico só vê a sua.

---

## 5. Equipamentos

Cadastro com três tipos, como no HTML original, mais o beira leito:

| Tipo | Campos |
|---|---|
| **Computador** | Desktop ou Notebook · hostname · ID e senha do TeamViewer/AnyDesk · guichê/posição |
| **Impressora** | Modelo (Multifuncional, Zebra, Pulseira, Térmica) · marca · modelo · **número de série** · IP (só Multifuncional) · PC conectado (Zebra/Pulseira/Térmica) |
| **TV / Painel** | **Nome do painel** · hostname (mini PC) · ID e senha do TeamViewer/AnyDesk |
| **Beira leito** | Número do leito · hostname · ID e senha do TeamViewer — **pertence à divisão**, não ao setor |

Detalhes:
- **Posição / sub-setor**: opcional (botão "+ Adicionar posição"); no computador aparece direto como **Guichê**.
- **Ordem**: a lista do setor é sempre do menor para o maior, por guichê (GUICHÊ 01, 02, 03…), depois hostname.
  A ordenação entende números (2 antes de 10); sem guichê vai para o fim.
- **Lista enxuta**: Equipamento · Host · Guichê. Clicar abre uma janela com **todas** as informações.
  No celular, campos vazios não aparecem.
- **Abas no setor**: Computadores · Impressoras (com filtro por modelo) · TVs/Painéis.
- **Beira leito**: atalho laranja dentro das divisões UTI, Centro Cirúrgico e PS/CDM; lista por divisão,
  ordenada pelo número do leito. O mesmo número pode existir em divisões diferentes.
- **Drivers**: o admin informa um link (`https://…`) ou um caminho de rede por **modelo** de impressora;
  todos veem na ficha (link vira botão; caminho de rede aparece com botão **Copiar**).
- **Exclusão**: o admin pode excluir definitivamente (além de inativar).

### Regras anti-duplicidade
| Regra | Comparação |
|---|---|
| Impressora: **número de série** único (obrigatório) | ignora maiúsculas e espaços |
| Hostname único (computador, TV, beira leito) | ignora maiúsculas e espaços; também protegido por índice no banco |
| Patrimônio único, quando informado | ignora maiúsculas e espaços |
| Beira leito: número do leito único **dentro da divisão** | ignora maiúsculas e espaços |

A mensagem de erro informa onde o equipamento já está cadastrado.

---

## 6. Interface

- **Menu**: Dashboard · Unidades · Setores · Mapeamento (admin/liberado) · Usuários · Relatórios · Configurações (admin).
- **Dashboard**: Equipamentos, Unidades, Setores e a lista de setores por divisão com busca.
- **Unidades**: mostra só o nome da unidade e a quantidade de divisões.
- **Tarefas**: removidas da plataforma (menu, dashboard e rotas). Os dados continuam no banco.
- **Login**: botão de mostrar/ocultar senha e aviso de primeiro acesso.
- **Celular**: tabelas viram cartões, botão flutuante "+" e menu em gaveta.

---

## 7. Banco de dados

- Esquema completo e migrações em `database/`.
- `database/supabase/001_migracao_completa.sql`: tabelas, categorias/tipos, unidade SIG, setores e RLS ligado
  (sem políticas: a API pública do Supabase fica bloqueada; só o backend acessa).
- Migrações: 002 TeamViewer/unidade do técnico · 003 troca de senha e parâmetros · 004 hostname único ·
  005 modelos de impressora e senha remota · 006 link de drivers · 007 nome do painel · 008 beira leito ·
  009 beira leito por divisão · 010 usuário único sem diferenciar caixa.
- Scripts úteis (`backend/package.json`): `db:init`, `db:reset`, `db:seed`, `db:zero`, `db:setores`.

---

## 8. Publicação (deploy)

Guia detalhado em `DEPLOY.md`. Resumo:

**Supabase** — rodar `001_migracao_completa.sql` no SQL Editor (uma vez, em banco vazio).
Usar o **Session pooler** (IPv4), porta 5432.

**Render (backend)**

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Build / Start | `npm ci` / `npm start` |
| Plano | Free (dorme após 15 min; primeiro acesso ~30 s) |
| Health check | `/api/saude` |

Variáveis: `DATABASE_URL` (Session pooler, com `@` da senha escrito `%40`) · `DATABASE_SSL=true` ·
`JWT_SECRET` (chave longa e aleatória) · `CORS_ORIGIN` (URL do Netlify, sem barra no final) · `NODE_VERSION=20`.

**Netlify (frontend)**

| Campo | Valor |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Variável | `VITE_API_URL` = URL do backend no Render (sem barra no final) |

> `VITE_API_URL` é lida **na hora do build**. Depois de criar ou alterar, faça
> *Deploys → Trigger deploy → Clear cache and deploy site*.

### Endereços
- Backend: https://tihospitalar.onrender.com
- Frontend: https://mapeamentoti.netlify.app
- Código: https://github.com/DevMarcosAraujo/tihospitalar

---

## 9. Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| "Erro ao comunicar com o servidor" e `404` em `/api/auth/login` no console | `VITE_API_URL` ausente no build do Netlify | Definir a variável e fazer novo deploy com cache limpo |
| "Erro ao comunicar com o servidor" e erro de CORS | `CORS_ORIGIN` diferente da URL real do site | Ajustar no Render (https, sem barra final) |
| Primeiro acesso muito lento | Plano Free do Render estava dormindo | Aguardar ~30 s |
| API não conecta no banco | Conexão direta (IPv6) em vez do Session pooler, ou falta `DATABASE_SSL=true` | Usar a string do pooler |
| "Usuário ou senha inválidos" | Senha digitada errada | Admin usa **Redefinir senha** na tela Usuários |
| Backend local cai sozinho | Pouca memória do computador | Reiniciar com `npm run dev` na pasta `backend` |

---

## 10. Estado atual e próximos passos

Concluído:
- Sistema completo, publicado em Supabase + Render + Netlify.
- Banco do Supabase com unidade SIG, setores, tipos e **um único usuário: o administrador**
  (login `Admin`, senha provisória a ser trocada no primeiro acesso).
- Usuários de teste removidos do banco local.

Pendente:
1. **Netlify**: confirmar `VITE_API_URL` e refazer o deploy com cache limpo.
2. **Render**: `CORS_ORIGIN` = `https://mapeamentoti.netlify.app`.
3. **Criar os técnicos** (nome, login, senha provisória e unidade).
4. **Trocar a senha do banco** no Supabase (Project Settings → Database → Reset database password) e atualizar
   a `DATABASE_URL` no Render — a senha atual foi exposta durante a configuração.
5. Cadastrar os equipamentos reais (nada foi migrado do Firebase; os dados antigos podem ser importados
   a partir de um export JSON).
6. Opcional: deixar o repositório do GitHub **privado**.
