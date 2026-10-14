require('dotenv').config();

const env = {
  port: process.env.PORT || 3333,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  // vários domínios separados por vírgula (ex.: https://app.netlify.app,http://localhost:5173)
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
  databaseSsl: process.env.DATABASE_SSL === 'true',
};

for (const k of ['databaseUrl', 'jwtSecret']) {
  if (!env[k]) throw new Error(`Variável de ambiente ausente (${k}). Copie .env.example para .env.`);
}

module.exports = env;
