const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => console.log(`API rodando em http://localhost:${env.port}/api`));
