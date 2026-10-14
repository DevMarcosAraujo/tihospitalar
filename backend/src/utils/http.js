class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Encaminha erros de handlers async para o errorHandler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Garante que os campos obrigatórios foram enviados
function required(body, fields) {
  const faltando = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (faltando.length) throw new HttpError(400, `Campos obrigatórios: ${faltando.join(', ')}`);
}

const flag = (v) => v === '1' || v === 'true';
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identificador inválido');
  return n;
};
const emptyToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

module.exports = { HttpError, wrap, required, flag, isDate, toId, emptyToNull };
