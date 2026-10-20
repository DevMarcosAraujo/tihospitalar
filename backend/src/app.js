const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/api/saude', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/usuarios', require('./modules/usuarios/routes'));
app.use('/api/unidades', require('./modules/unidades/routes'));
app.use('/api/setores', require('./modules/setores/routes'));
app.use('/api/equipamentos', require('./modules/equipamentos/routes'));
app.use('/api/access-points', require('./modules/accesspoints/routes'));
app.use('/api/tarefas', require('./modules/tarefas/routes'));
app.use('/api/dashboard', require('./modules/dashboard/routes'));
app.use('/api/relatorios', require('./modules/relatorios/routes'));
app.use('/api/configuracoes', require('./modules/configuracoes/routes'));
app.use('/api/recursos', require('./modules/recursos/routes'));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use(errorHandler);

module.exports = app;
