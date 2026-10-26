const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, isDate, toId, emptyToNull } = require('../../utils/http');
const { registrar } = require('../../utils/atividade');

// Serviços atribuídos pelo administrador aos técnicos.
// Fluxo: PENDENTE -> EM_ANDAMENTO -> AGUARDANDO_APROVACAO -> CONCLUIDO (só o administrador conclui, aprovando).
const pronto = db.query(
  `CREATE TABLE IF NOT EXISTS servicos (
     id SERIAL PRIMARY KEY,
     titulo VARCHAR(160) NOT NULL,
     descricao TEXT,
     tecnico_id INT NOT NULL REFERENCES usuarios(id),
     unidade_id INT REFERENCES unidades(id) ON DELETE SET NULL,
     setor_id INT REFERENCES setores(id) ON DELETE SET NULL,
     prioridade VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
     prazo DATE,
     status VARCHAR(25) NOT NULL DEFAULT 'PENDENTE',
     tipo_servico VARCHAR(40),
     observacao_tecnico TEXT,
     motivo_reprovacao TEXT,
     criado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
     criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
     enviado_em TIMESTAMPTZ,
     aprovado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
     aprovado_em TIMESTAMPTZ
   );
   ALTER TABLE servicos ADD COLUMN IF NOT EXISTS motivo_devolucao TEXT;
   CREATE INDEX IF NOT EXISTS idx_servicos_tecnico ON servicos (tecnico_id, status)`
);

const TIPOS = ['Manutenção', 'Instalação', 'Troca de equipamento', 'Configuração', 'Formatação', 'Cabeamento / rede', 'Diagnóstico', 'Outro'];
const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];
// DEVOLVIDO = o técnico deixou pendente e o administrador precisa passar para outro técnico
const STATUS = ['PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_APROVACAO', 'DEVOLVIDO', 'CONCLUIDO'];

const SELECT = `
  SELECT s.*, t.nome AS tecnico_nome, un.nome AS unidade_nome, st.nome AS setor_nome,
         ap.nome AS aprovado_por_nome,
         (s.status <> 'CONCLUIDO' AND s.prazo IS NOT NULL AND s.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS atrasado
  FROM servicos s
  JOIN usuarios t ON t.id = s.tecnico_id
  LEFT JOIN unidades un ON un.id = s.unidade_id
  LEFT JOIN setores st ON st.id = s.setor_id
  LEFT JOIN usuarios ap ON ap.id = s.aprovado_por`;

router.use(authenticate);
router.use(wrap(async (req, res, next) => { await pronto; next(); }));

router.get('/tipos', (req, res) => res.json(TIPOS));

// Números do menu/dashboard: administrador = aguardando aprovação; técnico = a fazer e reprovados
router.get('/resumo', wrap(async (req, res) => {
  const admin = req.user.perfil === 'ADMINISTRADOR';
  const { rows } = await db.query(
    admin
      ? `SELECT count(*) FILTER (WHERE status = 'AGUARDANDO_APROVACAO')::int AS aprovar,
                count(*) FILTER (WHERE status = 'DEVOLVIDO')::int AS devolvidos,
                count(*) FILTER (WHERE status IN ('PENDENTE','EM_ANDAMENTO'))::int AS abertos FROM servicos`
      : `SELECT count(*) FILTER (WHERE status IN ('PENDENTE','EM_ANDAMENTO'))::int AS abertos,
                count(*) FILTER (WHERE status = 'EM_ANDAMENTO' AND motivo_reprovacao IS NOT NULL)::int AS reprovados
         FROM servicos WHERE tecnico_id = $1`,
    admin ? [] : [req.user.id]);
  res.json(rows[0]);
}));

router.get('/', wrap(async (req, res) => {
  const where = [];
  const params = [];
  if (req.user.perfil === 'ADMINISTRADOR') {
    if (req.query.tecnico_id) { params.push(toId(req.query.tecnico_id)); where.push(`s.tecnico_id = $${params.length}`); }
    if (req.query.unidade_id) { params.push(toId(req.query.unidade_id)); where.push(`s.unidade_id = $${params.length}`); }
  } else {
    params.push(req.user.id); where.push(`s.tecnico_id = $${params.length}`);
  }
  if (req.query.status) {
    if (!STATUS.includes(req.query.status)) throw new HttpError(400, 'Status inválido');
    params.push(req.query.status); where.push(`s.status = $${params.length}`);
  }
  const { rows } = await db.query(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE s.status WHEN 'AGUARDANDO_APROVACAO' THEN 0 WHEN 'DEVOLVIDO' THEN 1 WHEN 'EM_ANDAMENTO' THEN 2 WHEN 'PENDENTE' THEN 3 ELSE 4 END,
              s.prazo NULLS LAST, s.id DESC
     LIMIT 1000`, params);
  res.json(rows);
}));

async function obter(id) {
  const { rows } = await db.query(`${SELECT} WHERE s.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Serviço não encontrado');
  return rows[0];
}

// Técnico só mexe no que é dele
async function doTecnico(req) {
  const s = await obter(toId(req.params.id));
  if (s.tecnico_id !== req.user.id) throw new HttpError(404, 'Serviço não encontrado');
  return s;
}

async function dados(b) {
  required(b, ['titulo', 'tecnico_id']);
  const tec = await db.query("SELECT id, unidade_id FROM usuarios WHERE id = $1 AND perfil = 'TECNICO' AND ativo", [toId(b.tecnico_id)]);
  if (!tec.rows[0]) throw new HttpError(400, 'Técnico inexistente ou inativo');
  let setorId = null;
  if (b.setor_id) {
    const st = await db.query('SELECT unidade_id FROM setores WHERE id = $1 AND ativo', [toId(b.setor_id)]);
    if (!st.rows[0] || st.rows[0].unidade_id !== tec.rows[0].unidade_id) throw new HttpError(400, 'O setor precisa ser da unidade do técnico');
    setorId = toId(b.setor_id);
  }
  const prioridade = b.prioridade || 'NORMAL';
  if (!PRIORIDADES.includes(prioridade)) throw new HttpError(400, 'Prioridade inválida');
  const prazo = emptyToNull(b.prazo);
  if (prazo && !isDate(prazo)) throw new HttpError(400, 'Prazo inválido');
  return { titulo: String(b.titulo).trim().slice(0, 160), descricao: emptyToNull(b.descricao), tecnicoId: tec.rows[0].id, unidadeId: tec.rows[0].unidade_id, setorId, prioridade, prazo };
}

router.post('/', requireAdmin, wrap(async (req, res) => {
  const d = await dados(req.body);
  const { rows } = await db.query(
    `INSERT INTO servicos (titulo, descricao, tecnico_id, unidade_id, setor_id, prioridade, prazo, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [d.titulo, d.descricao, d.tecnicoId, d.unidadeId, d.setorId, d.prioridade, d.prazo, req.user.id]);
  const s = await obter(rows[0].id);
  await registrar(req, 'ATRIBUIU', 'Serviço', `${s.titulo} → ${s.tecnico_nome}`, s.unidade_id);
  res.status(201).json(s);
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const atual = await obter(toId(req.params.id));
  if (atual.status === 'CONCLUIDO') throw new HttpError(409, 'Serviço já concluído não pode ser alterado');
  const d = await dados(req.body);
  await db.query(
    `UPDATE servicos SET titulo=$1, descricao=$2, tecnico_id=$3, unidade_id=$4, setor_id=$5, prioridade=$6, prazo=$7,
       status = CASE WHEN status = 'DEVOLVIDO' THEN 'PENDENTE' ELSE status END,
       motivo_devolucao = CASE WHEN status = 'DEVOLVIDO' THEN NULL ELSE motivo_devolucao END WHERE id=$8`,
    [d.titulo, d.descricao, d.tecnicoId, d.unidadeId, d.setorId, d.prioridade, d.prazo, atual.id]);
  const s = await obter(atual.id);
  const reatribuiu = atual.status === 'DEVOLVIDO';
  await registrar(req, reatribuiu ? 'REATRIBUIU' : 'EDITOU', 'Serviço', `${s.titulo} → ${s.tecnico_nome}`, s.unidade_id);
  res.json(s);
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const s = await obter(toId(req.params.id));
  await db.query('DELETE FROM servicos WHERE id = $1', [s.id]);
  await registrar(req, 'EXCLUIU', 'Serviço', `${s.titulo} (${s.tecnico_nome})`, s.unidade_id);
  res.status(204).end();
}));

// Técnico começa a executar
router.post('/:id/iniciar', wrap(async (req, res) => {
  const s = await doTecnico(req);
  if (s.status !== 'PENDENTE') throw new HttpError(409, 'Este serviço já foi iniciado');
  await db.query("UPDATE servicos SET status = 'EM_ANDAMENTO' WHERE id = $1", [s.id]);
  await registrar(req, 'INICIOU', 'Serviço', s.titulo, s.unidade_id);
  res.json(await obter(s.id));
}));

// Técnico não vai conseguir fazer: deixa pendente com o motivo, para o administrador passar a outro técnico
router.post('/:id/devolver', wrap(async (req, res) => {
  const s = await doTecnico(req);
  if (!['PENDENTE', 'EM_ANDAMENTO'].includes(s.status)) throw new HttpError(409, 'Este serviço não pode ser devolvido agora');
  const motivo = emptyToNull(req.body.motivo);
  if (!motivo) throw new HttpError(400, 'Informe o motivo');
  await db.query("UPDATE servicos SET status = 'DEVOLVIDO', motivo_devolucao = $1 WHERE id = $2", [motivo, s.id]);
  await registrar(req, 'DEVOLVEU', 'Serviço', `${s.titulo}: ${motivo}`, s.unidade_id);
  res.json(await obter(s.id));
}));

// Técnico terminou: informa o tipo de serviço e manda para aprovação (ainda NÃO é concluído)
router.post('/:id/enviar', wrap(async (req, res) => {
  const s = await doTecnico(req);
  if (!['PENDENTE', 'EM_ANDAMENTO'].includes(s.status)) throw new HttpError(409, 'Este serviço não pode ser enviado agora');
  const tipo = String(req.body.tipo_servico || '').trim();
  if (!TIPOS.includes(tipo)) throw new HttpError(400, 'Informe o tipo de serviço realizado');
  await db.query(
    `UPDATE servicos SET status = 'AGUARDANDO_APROVACAO', tipo_servico = $1, observacao_tecnico = $2, enviado_em = now(), motivo_reprovacao = NULL WHERE id = $3`,
    [tipo, emptyToNull(req.body.observacao), s.id]);
  await registrar(req, 'ENVIOU', 'Serviço', `${s.titulo} — ${tipo} (aguardando aprovação)`, s.unidade_id);
  res.json(await obter(s.id));
}));

router.post('/:id/aprovar', requireAdmin, wrap(async (req, res) => {
  const s = await obter(toId(req.params.id));
  if (s.status !== 'AGUARDANDO_APROVACAO') throw new HttpError(409, 'Este serviço não está aguardando aprovação');
  await db.query("UPDATE servicos SET status = 'CONCLUIDO', aprovado_por = $1, aprovado_em = now() WHERE id = $2", [req.user.id, s.id]);
  await registrar(req, 'APROVOU', 'Serviço', `${s.titulo} (${s.tecnico_nome})`, s.unidade_id);
  res.json(await obter(s.id));
}));

// Reprovar devolve ao técnico com o motivo
router.post('/:id/reprovar', requireAdmin, wrap(async (req, res) => {
  const s = await obter(toId(req.params.id));
  if (s.status !== 'AGUARDANDO_APROVACAO') throw new HttpError(409, 'Este serviço não está aguardando aprovação');
  const motivo = emptyToNull(req.body.motivo);
  if (!motivo) throw new HttpError(400, 'Informe o motivo da reprovação');
  await db.query("UPDATE servicos SET status = 'EM_ANDAMENTO', motivo_reprovacao = $1 WHERE id = $2", [motivo, s.id]);
  await registrar(req, 'REPROVOU', 'Serviço', `${s.titulo} (${s.tecnico_nome}): ${motivo}`, s.unidade_id);
  res.json(await obter(s.id));
}));

module.exports = router;
