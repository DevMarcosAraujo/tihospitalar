const TOKEN_KEY = 'ti_token';

// Em produção (Netlify) aponta para o backend no Render: VITE_API_URL=https://seu-backend.onrender.com
// Em desenvolvimento fica vazio e o Vite encaminha /api para o backend local.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

function qs(params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, v === true ? '1' : v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body, params } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(`${API_BASE}/api${path}${qs(params)}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null);
    window.dispatchEvent(new Event('auth:expired'));
  }
  return res;
}

export async function api(path, opts) {
  const res = await request(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro ao comunicar com o servidor');
  return data;
}

// Baixa um CSV autenticado
export async function baixarCsv(path, params, nome) {
  const res = await request(path, { params: { ...params, formato: 'csv' } });
  if (!res.ok) throw new Error('Não foi possível exportar');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
