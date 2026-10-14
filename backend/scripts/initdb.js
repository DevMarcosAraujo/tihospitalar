// Cria as tabelas e carrega categorias/tipos.  Uso: npm run db:init   |   npm run db:reset (apaga tudo antes)
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const dir = path.join(__dirname, '..', '..', 'database');

(async () => {
  try {
    if (process.argv.includes('--reset')) {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('Schema recriado (dados anteriores apagados).');
    }
    await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(dir, 'seeds', '001_categorias_tipos.sql'), 'utf8'));
    console.log('Banco inicializado: tabelas + categorias/tipos de equipamento.');
  } catch (err) {
    console.error('Falha ao inicializar o banco:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
