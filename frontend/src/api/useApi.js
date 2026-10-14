import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './client';

// Busca dados de GET `path`. path = null desativa. Refaz a busca quando path/params mudam.
export function useApi(path, params) {
  const key = JSON.stringify(params || {});
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const req = useRef(0);

  const load = useCallback(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    const id = ++req.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { params: JSON.parse(key) })
      .then((data) => id === req.current && setState({ data, loading: false, error: null }))
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
