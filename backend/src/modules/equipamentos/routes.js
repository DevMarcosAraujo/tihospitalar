const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, flag, toId, emptyToNull } = require('../../utils/http');

router.use(authenticate);

const STATUS = ['ATIVO', 'INATIVO', 'EM_MANUTENCAO', 'FORA_DE_USO'];

// "exibe_hostname" também indica que a categoria é de computadores (hostname, TeamViewer e impressora ligada)
const SELECT = `
  SELECT e.*, t.nome AS tipo, t.link_drivers, t.categoria_id, c.nome AS categoria,
         u.nome AS unidade_nome, COALESCE(s.nome, e.divisao) AS setor_nome,
         c.usa_hostname AS exibe_hostname, COALESCE(t.usa_ip, c.usa_ip) AS exibe_ip,
         pc.hostname AS ligado_a_hostname, pc.patrimonio AS ligado_a_patrimonio,
         (SELECT COALESCE(json_agg(json_build_object('id', i.id, 'tipo', ti.nome, 'modelo', i.modelo, 'patrimonio', i.patrimonio) ORDER BY i.id), '[]')
            FROM equipamentos i JOIN tipos_equipamento ti ON ti.id = i.tipo_id
           WHERE i.ligado_a_id = e.id) AS impressoras
  FROM equipamentos e
  JOIN tipos_equipamento t ON t.id = e.tipo_id
  JOIN categorias_equipamento c ON c.id = t.categoria_id
  JOIN unidades u ON u.id = e.unidade_id
  LEFT JOIN setores s ON s.id = e.setor_id
  LEFT JOIN equipamentos pc ON pc.id = e.ligado_a_id`;

// Categorias e tipos ativos (para os formulários), com as regras de campos condicionais
router.get('/categorias', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.nome, c.usa_hostname,
            COALESCE(json_agg(json_build_object('id', t.id, 'nome', t.nome, 'usa_ip', COALESCE(t.usa_ip, c.usa_ip), 'link_drivers', t.link_drivers)
                     ORDER BY t.nome) FILTER (WHERE t.id IS NOT NULL), '[]') AS tipos
     FROM categorias_equipamento c
     LEFT JOIN tipos_equipamento t ON t.categoria_id = c.id AND t.ativo
     GROUP BY c.id ORDER BY c.nome`
  );
  res.json(rows);
}));

// Novo modelo de impressora (qualquer perfil). Define se usa IP; o link dos drivers é só do administrador.
router.post('/modelos', wrap(async (req, res) => {
  required(req.body, ['nome']);
  const cat = await db.query("SELECT id FROM categorias_equipamento WHERE nome = 'Impressoras'");
  const nome = String(req.body.nome).trim();
  const ja = await db.query('SELECT id, ativo FROM tipos_equipamento WHERE categoria_id = $1 AND lower(nome) = lower($2)', [cat.rows[0].id, nome]);
  if (ja.rows[0]) {
    if (ja.rows[0].ativo) throw new HttpError(409, `O modelo "${nome}" já existe`);
    await db.query('UPDATE tipos_equipamento SET ativo = TRUE WHERE id = $1', [ja.rows[0].id]);
    return res.status(201).json({ id: ja.rows[0].id, nome });
  }
  const { rows } = await db.query(
    'INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip) VALUES ($1, $2, $3) RETURNING id, nome',
    [cat.rows[0].id, nome, req.body.usa_ip === true]
  );
  res.status(201).json(rows[0]);
}));

// Link/pasta dos drivers de um modelo (somente administrador)
router.put('/modelos/:id/drivers', requireAdmin, wrap(async (req, res) => {
  const link = emptyToNull(req.body.link_drivers);
  const { rowCount } = await db.query('UPDATE tipos_equipamento SET link_drivers = $1 WHERE id = $2', [link, toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Modelo não encontrado');
  res.json({ ok: true, link_drivers: link });
}));

// Quantidade de beira leito por divisão (para os atalhos nas telas de setores)
router.get('/beira-leito/resumo', wrap(async (req, res) => {
  const params = [];
  let filtro = '';
  const uni = req.user.perfil === 'TECNICO' ? (req.user.unidade_id || 0) : (req.query.unidade_id ? toId(req.query.unidade_id) : null);
  if (uni !== null) { params.push(uni); filtro = 'AND e.unidade_id = $1'; }
  const { rows } = await db.query(
    `SELECT e.divisao, count(*)::int AS total FROM equipamentos e
     JOIN tipos_equipamento t ON t.id = e.tipo_id JOIN categorias_equipamento c ON c.id = t.categoria_id
     WHERE c.nome = 'Beira leito' AND e.status <> 'INATIVO' ${filtro} GROUP BY e.divisao`, params);
  res.json(rows);
}));

// Busca: patrimônio, hostname, TeamViewer, modelo, nº de série e IP
router.get('/', wrap(async (req, res) => {
  const { setor_id, divisao, tipo_id, categoria_id, status, q, inativos } = req.query;
  const unidade_id = req.user.perfil === 'TECNICO' ? (req.user.unidade_id || 0) : req.query.unidade_id;
  const where = [];
  const params = [];
  const add = (cond, v) => { params.push(v); where.push(cond.replace('?', `$${params.length}`)); };

  if (unidade_id) add('e.unidade_id = ?', toId(unidade_id));
  if (setor_id) add('e.setor_id = ?', toId(setor_id));
  if (divisao) add('e.divisao = ?', String(divisao));
  if (tipo_id) add('e.tipo_id = ?', toId(tipo_id));
  if (categoria_id) add('t.categoria_id = ?', toId(categoria_id));
  if (status) {
    if (!STATUS.includes(status)) throw new HttpError(400, 'Status inválido');
    add('e.status = ?', status);
  } else if (!flag(inativos)) {
    where.push("e.status <> 'INATIVO'");
  }
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(e.patrimonio ILIKE ${p} OR e.hostname ILIKE ${p} OR e.teamviewer ILIKE ${p} OR e.modelo ILIKE ${p}
                 OR e.numero_serie ILIKE ${p} OR e.ip ILIKE ${p})`);
  }
  const { rows } = await db.query(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(e.hostname, e.patrimonio, t.nome), e.id`,
    params
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(`${SELECT} WHERE e.id = $1`, [toId(req.params.id)]);
  if (rows[0] && req.user.perfil === 'TECNICO' && rows[0].unidade_id !== req.user.unidade_id) throw new HttpError(404, 'Equipamento não encontrado');
  if (!rows[0]) throw new HttpError(404, 'Equipamento não encontrado');
  res.json(rows[0]);
}));

// Valida e normaliza o corpo. A unidade do técnico é fixa (vem do usuário), a do administrador vem do formulário.
async function preparar(b, user, selfId = null) {
  required(b, ['tipo_id']);
  const status = b.status || 'ATIVO';
  if (!STATUS.includes(status)) throw new HttpError(400, 'Status inválido');

  let unidadeId;
  if (user.perfil === 'TECNICO') {
    if (!user.unidade_id) throw new HttpError(400, 'Seu usuário não está ligado a uma unidade. Peça ao administrador.');
    unidadeId = user.unidade_id;
  } else {
    unidadeId = b.unidade_id ? toId(b.unidade_id) : null; // beira leito pode omitir (vem da divisão)
  }
  const tipoId = toId(b.tipo_id);
  const setorId = b.setor_id ? toId(b.setor_id) : null;

  const tipo = await db.query(
    `SELECT c.nome AS categoria, t.nome AS tipo_nome, c.usa_hostname, COALESCE(t.usa_ip, c.usa_ip) AS usa_ip
     FROM tipos_equipamento t JOIN categorias_equipamento c ON c.id = t.categoria_id
     WHERE t.id = $1 AND t.ativo`,
    [tipoId]
  );
  if (!tipo.rows[0]) throw new HttpError(400, 'Tipo de equipamento inexistente ou inativo');
  const computador = tipo.rows[0].usa_hostname;
  const impressora = tipo.rows[0].categoria === 'Impressoras';
  // TV / painel de chamada também tem hostname (mini PC) e ID de acesso remoto
  const usaHost = computador || tipo.rows[0].tipo_nome === 'TV';

  // Regra anti-duplicidade: impressora é identificada pelo número de série; computador, pelo hostname; patrimônio é único.
  const serie = emptyToNull(b.numero_serie)?.toUpperCase() || null;
  const hostname = usaHost ? emptyToNull(b.hostname)?.toUpperCase() || null : null;
  const patrimonio = emptyToNull(b.patrimonio);
  const sala = emptyToNull(b.sala);
  if (impressora && !serie) throw new HttpError(400, 'Informe o número de série da impressora');
  const onde = (r) => `${r.setor_nome}${r.sala ? ' · ' + r.sala : ''}`;
  const achar = async (cond, valor) => (await db.query(
    `SELECT COALESCE(s.nome, e.divisao) AS setor_nome, e.sala FROM equipamentos e LEFT JOIN setores s ON s.id = e.setor_id
     WHERE ${cond} AND ($2::int IS NULL OR e.id <> $2) LIMIT 1`, [valor, selfId])).rows[0];
  if (impressora) {
    const dup = await achar(`upper(trim(e.numero_serie)) = $1 AND e.tipo_id IN (
      SELECT t2.id FROM tipos_equipamento t2 JOIN categorias_equipamento c2 ON c2.id = t2.categoria_id WHERE c2.nome = 'Impressoras')`, serie);
    if (dup) throw new HttpError(409, `Já existe uma impressora com o número de série ${serie} (${onde(dup)})`);
  }
  // Nome padrão da impressora (ex.: IMP_SIG_SCAN_CDM): único no sistema
  const nomeImp = impressora ? emptyToNull(b.nome)?.toUpperCase().replace(/s+/g, '_') || null : null;
  if (nomeImp) {
    const dup = await achar('upper(trim(e.nome)) = $1', nomeImp);
    if (dup) throw new HttpError(409, `Já existe um equipamento com o nome ${nomeImp} (${onde(dup)})`);
  }
  if (hostname) {
    const dup = await achar('upper(trim(e.hostname)) = $1', hostname);
    if (dup) throw new HttpError(409, `Já existe um equipamento com o hostname ${hostname} (${onde(dup)})`);
  }
  if (patrimonio) {
    const dup = await achar('upper(trim(e.patrimonio)) = $1', patrimonio.toUpperCase());
    if (dup) throw new HttpError(409, `Já existe um equipamento com o patrimônio ${patrimonio} (${onde(dup)})`);
  }

  // Impressora sem IP (Zebra, Pulseira, Térmica) é conectada a um computador
  let ligadoAId = null;
  if (impressora && b.ligado_a_id) {
    ligadoAId = toId(b.ligado_a_id);
    const pc = await db.query(
      `SELECT 1 FROM equipamentos e JOIN tipos_equipamento t ON t.id = e.tipo_id JOIN categorias_equipamento c ON c.id = t.categoria_id
       WHERE e.id = $1 AND c.usa_hostname AND e.unidade_id = $2`, [ligadoAId, unidadeId]);
    if (!pc.rowCount) throw new HttpError(400, 'O computador informado não existe nesta unidade');
  }

  // Beira leito pertence à divisão (não a um setor); os demais equipamentos pertencem a um setor
  const leito = tipo.rows[0].categoria === 'Beira leito';
  let divisao = null;
  if (leito) {
    divisao = emptyToNull(b.divisao);
    if (!['SETOR PS/CDM', 'UTI', 'CENTRO CIRÚRGICO'].includes(divisao)) {
      throw new HttpError(400, 'Beira leito só existe no PS/CDM, UTI e Centro Cirúrgico');
    }
    if (!sala) throw new HttpError(400, 'Informe o número do beira leito');
    if (!hostname) throw new HttpError(400, 'Informe o hostname do beira leito');
    if (!unidadeId) {
      const u = await db.query('SELECT unidade_id FROM setores WHERE localizacao = $1 AND ativo ORDER BY unidade_id LIMIT 1', [divisao]);
      unidadeId = u.rows[0]?.unidade_id;
      if (!unidadeId) throw new HttpError(400, 'Nenhuma unidade possui esta divisão');
    }
    const dupLeito = await db.query(
      `SELECT 1 FROM equipamentos WHERE divisao = $1 AND unidade_id = $2 AND upper(trim(sala)) = $3 AND ($4::int IS NULL OR id <> $4)`,
      [divisao, unidadeId, sala.toUpperCase().trim(), selfId]
    );
    if (dupLeito.rowCount) throw new HttpError(409, `Já existe o beira leito ${sala.toUpperCase()} em ${divisao}`);
  } else {
    if (!setorId) throw new HttpError(400, 'Informe o setor');
    if (!unidadeId) throw new HttpError(400, 'Informe a unidade');
    const setor = await db.query('SELECT 1 FROM setores WHERE id = $1 AND unidade_id = $2 AND ativo', [setorId, unidadeId]);
    if (!setor.rowCount) throw new HttpError(400, 'O setor não pertence à unidade ou está inativo');
  }

  return {
    patrimonio,
    tipoId, unidadeId, setorId: leito ? null : setorId, divisao, status, computador,
    fabricante: emptyToNull(b.fabricante),
    modelo: emptyToNull(b.modelo),
    numeroSerie: serie,
    // Campos condicionais: ignorados quando a categoria/tipo não os utiliza
    hostname,
    teamviewer: usaHost ? emptyToNull(b.teamviewer) : null,
    nome: impressora ? nomeImp : tipo.rows[0].tipo_nome === 'TV' ? emptyToNull(b.nome) : null,
    teamviewerSenha: usaHost ? emptyToNull(b.teamviewer_senha) : null,
    // só impressoras: null = sem computador; 'ligado' informa se o corpo trouxe o campo
    ligadoAId, informouLigacao: impressora && 'ligado_a_id' in b,
    ip: tipo.rows[0].usa_ip ? emptyToNull(b.ip) : null,
    sala: emptyToNull(b.sala),
    observacoes: emptyToNull(b.observacoes),
    // undefined = não mexer nas ligações (edição sem esse campo)
    impressorasIds: !computador ? [] : Array.isArray(b.impressoras_ids) ? [...new Set(b.impressoras_ids.map(toId))] : undefined,
  };
}

// Liga ao computador exatamente as impressoras informadas (do mesmo setor e ainda sem outro computador)
async function ligarImpressoras(c, pcId, ids, setorId) {
  if (ids === undefined) return;
  if (ids.length) {
    const ok = await c.query(
      `SELECT e.id FROM equipamentos e
       JOIN tipos_equipamento t ON t.id = e.tipo_id
       JOIN categorias_equipamento cat ON cat.id = t.categoria_id
       WHERE e.id = ANY($1) AND cat.nome = 'Impressoras' AND e.setor_id = $2
         AND (e.ligado_a_id IS NULL OR e.ligado_a_id = $3)`,
      [ids, setorId, pcId]
    );
    if (ok.rowCount !== ids.length) {
      throw new HttpError(400, 'Impressora inválida: precisa ser do mesmo setor e não estar ligada a outro computador');
    }
  }
  await c.query('UPDATE equipamentos SET ligado_a_id = NULL WHERE ligado_a_id = $1', [pcId]);
  if (ids.length) await c.query('UPDATE equipamentos SET ligado_a_id = $1 WHERE id = ANY($2)', [pcId, ids]);
}

// Administrador e técnico podem cadastrar; editar e inativar continuam só do administrador
router.post('/', wrap(async (req, res) => {
  const d = await preparar(req.body, req.user);
  const id = await db.tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO equipamentos (patrimonio, tipo_id, fabricante, modelo, numero_serie, hostname, teamviewer, ip,
                                 unidade_id, setor_id, sala, status, observacoes, teamviewer_senha, ligado_a_id, nome, divisao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [d.patrimonio, d.tipoId, d.fabricante, d.modelo, d.numeroSerie, d.hostname, d.teamviewer, d.ip,
       d.unidadeId, d.setorId, d.sala, d.status, d.observacoes, d.teamviewerSenha, d.ligadoAId, d.nome, d.divisao]
    );
    await ligarImpressoras(c, rows[0].id, d.impressorasIds, d.setorId);
    return rows[0].id;
  });
  const full = await db.query(`${SELECT} WHERE e.id = $1`, [id]);
  res.status(201).json(full.rows[0]);
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const d = await preparar(req.body, req.user, id);
  await db.tx(async (c) => {
    // Mudou de setor: a impressora deixa de estar ligada ao computador antigo
    const { rowCount } = await c.query(
      `UPDATE equipamentos SET patrimonio=$1, tipo_id=$2, fabricante=$3, modelo=$4, numero_serie=$5, hostname=$6,
              teamviewer=$7, ip=$8, unidade_id=$9, setor_id=$10, sala=$11, status=$12, observacoes=$13,
              teamviewer_senha=$15, nome=$18, divisao=$19,
              ligado_a_id = CASE WHEN $16::boolean THEN $17::int
                                 WHEN equipamentos.setor_id = $10 THEN equipamentos.ligado_a_id ELSE NULL END
       WHERE id=$14`,
      [d.patrimonio, d.tipoId, d.fabricante, d.modelo, d.numeroSerie, d.hostname, d.teamviewer, d.ip,
       d.unidadeId, d.setorId, d.sala, d.status, d.observacoes, id, d.teamviewerSenha, d.informouLigacao, d.ligadoAId, d.nome, d.divisao]
    );
    if (!rowCount) throw new HttpError(404, 'Equipamento não encontrado');
    // Se deixou de ser computador, solta as impressoras que estavam ligadas a ele
    await ligarImpressoras(c, id, d.computador ? d.impressorasIds : [], d.setorId);
  });
  const full = await db.query(`${SELECT} WHERE e.id = $1`, [id]);
  res.json(full.rows[0]);
}));

// Inativar / reativar (nunca exclui)
router.patch('/:id/ativo', requireAdmin, wrap(async (req, res) => {
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo true/false');
  const { rowCount } = await db.query('UPDATE equipamentos SET status=$1 WHERE id=$2', [req.body.ativo ? 'ATIVO' : 'INATIVO', toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Equipamento não encontrado');
  const full = await db.query(`${SELECT} WHERE e.id = $1`, [toId(req.params.id)]);
  res.json(full.rows[0]);
}));

// Exclusão definitiva (só administrador). Impressoras ligadas a este computador ficam sem ligação (ON DELETE SET NULL).
router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM equipamentos WHERE id = $1', [toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Equipamento não encontrado');
  res.status(204).end();
}));

module.exports = router;
