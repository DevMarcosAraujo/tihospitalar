const { Pool, types } = require('pg');
const env = require('./env');

// DATE vem como string 'AAAA-MM-DD' (sem conversão de fuso)
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: env.databaseUrl,
  // Supabase exige SSL (DATABASE_SSL=true). Não use ?sslmode= na URL junto com esta opção.
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  options: '-c timezone=America/Sao_Paulo',
});

const query = (text, params) => pool.query(text, params);

// Executa fn(client) dentro de uma transação
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
