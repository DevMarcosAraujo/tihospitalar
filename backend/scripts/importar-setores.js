// Importa a estrutura de setores do mapeamento (HTML antigo) para o banco.
// Macro-setor → campo "localizacao" do setor; sala → nome do setor. Idempotente: pode rodar várias vezes.
// Uso: npm run db:setores
const db = require('../src/config/db');

const UNIDADE = { nome: 'SIG', codigo: 'SIG', endereco: 'MedSênior SIG - Brasília/DF' };

const ESTRUTURA = {
  'SETOR PS/CDM': [
    'ALMOXARIFADO', 'AREA TECNICA', 'COLONOSCOPIA', 'CONSULTORIO PS',
    'ENDOSCOPIA', 'FARMACIA', 'GERÊNCIA CDM', 'GERÊNCIA MEDICA',
    'GERÊNCIA OPERACIONAL', 'INTERNAÇÃO', 'LABORATORIO', 'MAPA E HOLTER',
    'RECEPÇÕES', 'RESULTADO DE EXAMES CDM', 'SALA ADM CDM',
    'SALA DE PRESCRIÇÃO', 'SALA MEDICAÇÃO', 'SALA MULTI', 'SALA VERMELHA',
    'TESTE ERGOMETRICO', 'TOMOGRAFIA',
  ],
  UTI: [
    'Recepção', '1-posto enfermagem black', '2-posto enfermagem posto B',
    '3-posto enfermagem posto A', '4-farmacia de apoio', '5-posto medico',
  ],
  'CENTRO CIRÚRGICO': [
    'Recepção Principal', 'Recepção Centro Cirúrgico', '1-posto de enfermagem 1',
    '2-farmacia sateletite', '3-prescrição medica', '4-posto enfermagem Rpa',
    '5-posto medico', '6-repouso medico', '7-sala adm',
  ],
};
const PREFIXO = { 'SETOR PS/CDM': 'PSCDM', UTI: 'UTI', 'CENTRO CIRÚRGICO': 'CC' };

(async () => {
  let unidade = (await db.query('SELECT id FROM unidades WHERE codigo = $1', [UNIDADE.codigo])).rows[0];
  if (!unidade) {
    unidade = (await db.query('INSERT INTO unidades (nome, codigo, endereco) VALUES ($1,$2,$3) RETURNING id', [UNIDADE.nome, UNIDADE.codigo, UNIDADE.endereco])).rows[0];
    console.log(`Unidade criada: ${UNIDADE.nome}`);
  }

  let criados = 0;
  for (const [macro, salas] of Object.entries(ESTRUTURA)) {
    for (const [i, sala] of salas.entries()) {
      const codigo = `${PREFIXO[macro]}-${String(i + 1).padStart(2, '0')}`;
      const r = await db.query(
        `INSERT INTO setores (unidade_id, nome, codigo, localizacao) VALUES ($1,$2,$3,$4)
         ON CONFLICT (unidade_id, codigo) DO NOTHING`,
        [unidade.id, sala, codigo, macro]
      );
      criados += r.rowCount;
    }
  }
  console.log(`Setores novos: ${criados} de ${Object.values(ESTRUTURA).flat().length}`);

  // Técnico fica fixo em uma unidade: quem ainda não tem, recebe esta
  const t = await db.query("UPDATE usuarios SET unidade_id = $1 WHERE perfil = 'TECNICO' AND unidade_id IS NULL", [unidade.id]);
  console.log(`Técnicos vinculados à unidade: ${t.rowCount}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
