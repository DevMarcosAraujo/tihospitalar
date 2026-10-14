// CSV para Excel pt-BR: separador ';' e BOM UTF-8
const pad = (n) => String(n).padStart(2, '0');

function fmtData(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, d] = v.split('-');
    return `${d}/${m}/${a}`;
  }
  return new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(';');
  const body = rows.map((r) =>
    columns.map((c) => esc(c.date ? fmtData(r[c.key]) : r[c.key])).join(';')
  );
  return '﻿' + [head, ...body].join('\r\n');
}

function sendCsv(res, filename, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(toCsv(rows, columns));
}

module.exports = { toCsv, sendCsv, fmtData, pad };
