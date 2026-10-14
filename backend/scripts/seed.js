// Dados de exemplo. Rode depois de db:init.  Uso: npm run db:seed
// Logins: admin / admin123 · marcos / tecnico123 · ana / tecnico123  (trocar em produção)
const bcrypt = require('bcryptjs');
const { pool, tx } = require('../src/config/db');

const UNIDADES = [
  { nome: 'Hospital Central', codigo: 'HC01', endereco: 'Av. Principal, 100', telefone: '(11) 3000-0001',
    setores: [['UTI', 'UTI-01', '2º andar', 'Ala Norte', '2345'], ['Recepção', 'REC-01', 'Térreo', 'Entrada', '2100'], ['Pronto Atendimento', 'PA-01', 'Térreo', 'Ala Sul', '2200']] },
  { nome: 'Unidade Norte', codigo: 'UN01', endereco: 'Rua das Palmeiras, 50', telefone: '(11) 3000-0002',
    setores: [['Ambulatório', 'AMB-01', '1º andar', 'Bloco A', '3100'], ['Laboratório', 'LAB-01', 'Térreo', 'Bloco B', '3200']] },
  { nome: 'Unidade Sul', codigo: 'US01', endereco: 'Av. do Sul, 900', telefone: '(11) 3000-0003',
    setores: [['Recepção', 'REC-01', 'Térreo', 'Entrada', '4100'], ['Diagnóstico por Imagem', 'IMG-01', '1º andar', 'Ala Leste', '4200']] },
];

// [tipo, quantidade, fabricante, modelo]
const EQUIPAMENTOS = [
  ['Desktop', 3, 'Dell', 'OptiPlex 3080'], ['Notebook', 1, 'Lenovo', 'ThinkPad E14'], ['Mini PC', 1, 'HP', 'EliteDesk 800 G6'],
  ['Térmica', 1, 'Zebra', 'ZD220'], ['Laser', 1, 'HP', 'LaserJet M404'], ['TV', 1, 'Samsung', 'Crystal 43'],
  ['Telefone IP', 2, 'Yealink', 'T31P'], ['Leitor de código de barras', 1, 'Honeywell', 'Voyager 1250g'], ['Switch', 1, 'Cisco', 'SG350-28'],
];

(async () => {
  try {
    const senhaAdmin = await bcrypt.hash('admin123', 10);
    const senhaTec = await bcrypt.hash('tecnico123', 10);

    await tx(async (c) => {
      const ja = await c.query('SELECT 1 FROM usuarios LIMIT 1');
      if (ja.rowCount) throw new Error('O banco já tem usuários. Use "npm run db:reset" antes de semear.');

      const uid = {};
      for (const [nome, usuario, senha, perfil, email] of [
        ['Administrador', 'admin', senhaAdmin, 'ADMINISTRADOR', 'admin@hospital.local'],
        ['Marcos Araújo', 'marcos', senhaTec, 'TECNICO', 'marcos@hospital.local'],
        ['Ana Souza', 'ana', senhaTec, 'TECNICO', 'ana@hospital.local'],
      ]) {
        uid[usuario] = (await c.query(
          'INSERT INTO usuarios (nome, usuario, senha_hash, perfil, email) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [nome, usuario, senha, perfil, email]
        )).rows[0].id;
      }

      const tipos = Object.fromEntries((await c.query('SELECT id, nome FROM tipos_equipamento')).rows.map((t) => [t.nome, t.id]));
      const setorIds = {}; // 'HC01/UTI-01' -> { id, unidadeId }
      let seq = 1000;

      for (const u of UNIDADES) {
        const un = (await c.query(
          'INSERT INTO unidades (nome, codigo, endereco, telefone) VALUES ($1,$2,$3,$4) RETURNING id',
          [u.nome, u.codigo, u.endereco, u.telefone]
        )).rows[0].id;

        for (const [nome, codigo, andar, loc, ramal] of u.setores) {
          const sid = (await c.query(
            'INSERT INTO setores (unidade_id, nome, codigo, andar, localizacao, ramal) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [un, nome, codigo, andar, loc, ramal]
          )).rows[0].id;
          setorIds[`${u.codigo}/${codigo}`] = { id: sid, unidadeId: un };

          for (const [tipo, qtd, fab, modelo] of EQUIPAMENTOS) {
            for (let i = 1; i <= qtd; i++) {
              seq += 1;
              const comHost = ['Desktop', 'Notebook', 'Mini PC'].includes(tipo);
              const comIp = comHost || ['Térmica', 'Laser', 'TV', 'Telefone IP', 'Switch'].includes(tipo);
              await c.query(
                `INSERT INTO equipamentos (patrimonio, tipo_id, fabricante, modelo, numero_serie, hostname, ip, unidade_id, setor_id, sala, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [`PAT-${seq}`, tipos[tipo], fab, modelo, `SN${seq}XZ`,
                 comHost ? `${codigo.replace('-', '')}-${tipo.replace(/\s/g, '').slice(0, 3).toUpperCase()}${String(i).padStart(2, '0')}` : null,
                 comIp ? `10.${un}.${sid}.${10 + i + (seq % 200)}` : null,
                 un, sid, `Sala ${i}`, seq % 17 === 0 ? 'EM_MANUTENCAO' : 'ATIVO']
              );
            }
          }
        }
      }

      // Técnicos ficam fixos em uma unidade
      for (const [login, codigo] of [['marcos', 'HC01'], ['ana', 'UN01']]) {
        await c.query(
          'UPDATE usuarios SET unidade_id = (SELECT id FROM unidades WHERE codigo = $1) WHERE id = $2',
          [codigo, uid[login]]
        );
      }

      // Tarefas em todos os status: [titulo, setor, tecnico, prazo(dias a partir de hoje), prioridade, atividades, executadas]
      const uti = setorIds['HC01/UTI-01'];
      const tarefas = [
        ['Verificação dos equipamentos da UTI', uti, 'marcos', 7, 'ALTA',
          ['Verificar computadores', 'Verificar notebooks', 'Verificar impressoras', 'Verificar TVs', 'Verificar Mini PCs', 'Verificar telefones', 'Verificar leitores', 'Verificar conexão de rede'], 0],
        ['Inventário da Recepção', setorIds['HC01/REC-01'], 'marcos', 5, 'NORMAL',
          ['Conferir patrimônios', 'Verificar impressoras', 'Verificar conexão de rede'], 1],
        ['Revisão do Pronto Atendimento', setorIds['HC01/PA-01'], 'ana', 3, 'URGENTE',
          ['Verificar computadores', 'Verificar impressoras', 'Verificar telefones'], 3],
        ['Checagem do Laboratório', setorIds['UN01/LAB-01'], 'ana', -4, 'ALTA',
          ['Verificar computadores', 'Verificar leitores', 'Verificar impressoras'], 1],
        ['Atualização do Ambulatório', setorIds['UN01/AMB-01'], 'marcos', -2, 'BAIXA',
          ['Verificar computadores', 'Verificar telefones'], 0],
      ];

      for (const [titulo, st, tec, dias, prio, ativs, feitas] of tarefas) {
        const tid = (await c.query(
          `INSERT INTO tarefas (titulo, unidade_id, setor_id, tecnico_id, prazo, prioridade)
           VALUES ($1,$2,$3,$4, current_date + $5::int, $6) RETURNING id`,
          [titulo, st.unidadeId, st.id, uid[tec], dias, prio]
        )).rows[0].id;
        await c.query('INSERT INTO historico_tarefa (tarefa_id, usuario_id, evento, detalhe) VALUES ($1,$2,$3,$4)',
          [tid, uid.admin, 'CRIACAO', JSON.stringify({ titulo })]);

        for (const [i, desc] of ativs.entries()) {
          const feita = i < feitas;
          const problema = feita && desc.includes('impressoras');
          const resultado = feita ? (problema ? 'PROBLEMA_ENCONTRADO' : 'OK') : null;
          await c.query(
            `INSERT INTO atividades (tarefa_id, descricao, ordem, concluida, resultado, problema, executado_por, executado_em)
             VALUES ($1,$2,$3,$4,$5,$6,$7, ${feita ? 'now()' : 'NULL'})`,
            [tid, desc, i + 1, feita, resultado, problema ? 'Impressora Zebra não está imprimindo etiquetas.' : null, feita ? uid[tec] : null]
          );
        }
      }
    });
    console.log('Dados de exemplo criados: 3 unidades, setores, equipamentos, 1 administrador, 2 técnicos e 5 tarefas.');
    console.log('Logins: admin/admin123 · marcos/tecnico123 · ana/tecnico123');
  } catch (err) {
    console.error('Falha no seed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
