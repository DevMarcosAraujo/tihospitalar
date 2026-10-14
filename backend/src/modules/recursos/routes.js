const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap } = require('../../utils/http');

// Liga/desliga recursos para os técnicos (por enquanto: tela de Mapeamento). Padrão: desligado.
const pronto = db.query(
  `CREATE TABLE IF NOT EXISTS parametros (chave VARCHAR(60) PRIMARY KEY, valor VARCHAR(200) NOT NULL)`
);

const ler = async () => {
  await pronto;
  const { rows } = await db.query("SELECT valor FROM parametros WHERE chave = 'mapeamento_tecnicos'");
  return { mapeamento_tecnicos: rows[0]?.valor === 'true' };
};

router.use(authenticate);

router.get('/', wrap(async (req, res) => res.json(await ler())));

router.put('/mapeamento', requireAdmin, wrap(async (req, res) => {
  if (typeof req.body.liberado !== 'boolean') throw new HttpError(400, 'Informe liberado true/false');
  await pronto;
  await db.query(
    `INSERT INTO parametros (chave, valor) VALUES ('mapeamento_tecnicos', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [String(req.body.liberado)]
  );
  res.json(await ler());
}));

module.exports = router;
