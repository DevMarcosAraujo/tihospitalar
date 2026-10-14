// Banco limpo: apaga TUDO, recria as tabelas e categorias/tipos e cria só 1 administrador.
// Uso: npm run db:zero   (senha inicial: admin123 — troque em Configurações)
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const dir = path.join(__dirname, '..', '..', 'database');

(async () => {
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(dir, 'seeds', '001_categorias_tipos.sql'), 'utf8'));
    await pool.query(
      "INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES ('Administrador', 'admin', $1, 'ADMINISTRADOR')",
      [await bcrypt.hash('admin123', 10)]
    );
    console.log('Banco zerado. Existe apenas o administrador: admin / admin123');
  } catch (err) {
    console.error('Falha ao zerar o banco:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
