# Sistema de Gestão de Infraestrutura de TI Hospitalar — V1

Especificação completa: `docs/especificacao.md`.

## Estrutura

```
sistema/
├── docs/                 especificação e decisões
├── database/
│   ├── schema.sql        tabelas PostgreSQL
│   └── seeds/            dados de exemplo (3 unidades, 1 admin, 2 técnicos, tarefas em todos os status)
├── backend/              Node.js + Express, API REST em /api
│   └── src/
│       ├── config/       conexão com o banco, variáveis de ambiente
│       ├── middlewares/  autenticação JWT, checagem de perfil
│       ├── modules/      auth, usuarios, unidades, setores, equipamentos,
│       │                 tarefas, dashboard, relatorios, configuracoes
│       └── utils/        status da tarefa (calculado), datas America/Sao_Paulo
└── frontend/             React + Vite + Lucide
    └── src/
        ├── api/  auth/  layouts/  components/  utils/
        └── pages/        login, dashboard, unidades, setores, equipamentos,
                          tarefas, usuarios, relatorios, configuracoes
```

## Decisões de arquitetura

- **Status da tarefa não é coluna**: é calculado (Aberta / Em andamento / Concluída / Atrasada) a partir das atividades e do prazo.
- **Sem exclusão**: unidades, setores, equipamentos e usuários só são inativados (`ativo = false`).
- **Permissões no backend** (middleware por perfil) e espelhadas no menu do frontend. O técnico só enxerga as tarefas atribuídas a ele.
- **Campos condicionais** (hostname, IP) são regras de `categorias_equipamento`, e não ficam fixos no código.

## Ordem de construção sugerida

1. Banco + seed → 2. Auth/JWT e perfis → 3. Cadastros (unidades, setores, equipamentos, usuários)
→ 4. Tarefas, atividades e execução → 5. Dashboard → 6. Relatórios CSV e configurações.

## Rodando o backend

```
cd backend
copy .env.example .env      # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run db:init             # tabelas + categorias/tipos (db:reset apaga tudo antes)
npm run db:seed             # dados de exemplo
npm run dev                 # http://localhost:3333/api
```

Logins de exemplo: `admin/admin123`, `marcos/tecnico123`, `ana/tecnico123`.
A API recebe datas em `AAAA-MM-DD`; a tela as exibe como DD/MM/AAAA.

## Rodando o frontend

```
cd frontend
npm install
npm run dev                 # http://localhost:5173 (encaminha /api para o backend na porta 3333)
```

## Pré-requisitos

Node.js 24 (instalado) e **PostgreSQL (ainda não instalado nesta máquina)**.
