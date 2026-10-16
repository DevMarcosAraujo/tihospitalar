const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const { HttpError, wrap } = require('../utils/http');

const CACHE_MS = 15000;
const cacheUsuarios = new Map(); // id -> { u, ate }

// Valida o token e recarrega o usuário (assim, inativar bloqueia na hora)
const authenticate = wrap(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Não autenticado');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sessão inválida ou expirada');
  }

  const hit = cacheUsuarios.get(payload.sub);
  let u = hit && hit.ate > Date.now() ? hit.u : null;
  if (!u) {
  const { rows } = await db.query(
    `SELECT u.id, u.nome, u.usuario, u.perfil, u.ativo, u.unidade_id, u.trocar_senha, un.nome AS unidade_nome
     FROM usuarios u LEFT JOIN unidades un ON un.id = u.unidade_id WHERE u.id = $1`,
    [payload.sub]
  );
  u = rows[0];
  if (u) cacheUsuarios.set(payload.sub, { u, ate: Date.now() + CACHE_MS });
  }
  if (!u || !u.ativo) throw new HttpError(401, 'Usuário inativo ou inexistente');

  // Primeiro acesso / senha redefinida: só pode trocar a senha (rotas /api/auth)
  if (u.trocar_senha && !req.originalUrl.startsWith('/api/auth/')) throw new HttpError(403, 'Troque sua senha para continuar');

  req.user = { id: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil, unidade_id: u.unidade_id, unidade_nome: u.unidade_nome, trocar_senha: u.trocar_senha };
  next();
});

const requireAdmin = (req, res, next) => {
  if (req.user?.perfil !== 'ADMINISTRADOR') {
    return next(new HttpError(403, 'Acesso restrito ao administrador'));
  }
  next();
};

const isAdmin = (req) => req.user.perfil === 'ADMINISTRADOR';

module.exports = { authenticate, requireAdmin, isAdmin };
