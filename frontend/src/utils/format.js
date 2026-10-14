// Datas: a API usa AAAA-MM-DD (DATE) ou timestamp ISO; a tela mostra DD/MM/AAAA, fuso America/Sao_Paulo
const TZ = 'America/Sao_Paulo';

export function fmtDate(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; }
  return new Date(s).toLocaleDateString('pt-BR', { timeZone: TZ });
}

export function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).replace(',', '');
}

export const fmtAny = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? fmtDate(v) : fmtDateTime(v));

// [rótulo, tom do badge]
export const STATUS_TAREFA = {
  ABERTA: ['Aberta', 'blue'], EM_ANDAMENTO: ['Em andamento', 'amber'],
  CONCLUIDA: ['Concluída', 'green'], ATRASADA: ['Atrasada', 'red'],
};
export const PRIORIDADE = {
  BAIXA: ['Baixa', 'gray'], NORMAL: ['Normal', 'blue'], ALTA: ['Alta', 'amber'], URGENTE: ['Urgente', 'red'],
};
export const STATUS_EQUIP = {
  ATIVO: ['Ativo', 'green'], INATIVO: ['Inativo', 'gray'],
  EM_MANUTENCAO: ['Em manutenção', 'amber'], FORA_DE_USO: ['Fora de uso', 'red'],
};
export const RESULTADO = {
  OK: ['OK', 'green'], PROBLEMA_ENCONTRADO: ['Problema encontrado', 'red'], NAO_APLICAVEL: ['Não aplicável', 'gray'],
};

export const rotulo = (map, v) => map[v]?.[0] || v;

// Rótulos legíveis para valores crus de relatórios
export const humanize = (v) =>
  STATUS_TAREFA[v]?.[0] || STATUS_EQUIP[v]?.[0] || PRIORIDADE[v]?.[0] || v;

// Nome para exibir: o hostname identifica o computador; sem ele, patrimônio; sem nenhum, "Tipo Modelo"
export const nomeEquip = (e) =>
  e.nome || e.hostname || e.patrimonio || [e.tipo, e.modelo].filter(Boolean).join(' ') || 'Equipamento';

export const percentual = (feitas, total) => (total ? Math.round((feitas / total) * 100) : 0);
