import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from './client';

// Cache em memória: ao voltar para uma tela, mostra os dados anteriores na hora e atualiza em segundo plano
const cache = new Map();
const chave = (path, key) => `${getToken()}|${path}|${key}`;

// Busca dados de GET `path`. path = null desativa. Refaz a busca quando path/params mudam.
export function useApi(path, params) {
  const key = JSON.stringify(params || {});
  const [state, setState] = useState(() => {
    const c = path && cache.get(chave(path, key));
    return { data: c ?? null, loading: !!path, error: null };
  });
  const req = useRef(0);

  const load = useCallback(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    const id = ++req.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { params: JSON.parse(key) })
      .then((data) => { cache.set(chave(path, key), data); if (id === req.current) setState({ data, loading: false, error: null }); })
      .catch((e) => id === req.current && setState({ data: null, loading: false, error: e.message }));
  }, [path, key]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
