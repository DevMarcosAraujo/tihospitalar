import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { Empty, ErrorMsg, Loading, PageHeader } from '../../components/ui';

export default function UnidadeDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: u, loading, error } = useApi(`/unidades/${id}`);

  const grupos = useMemo(() => {
    const m = new Map();
    (u?.setores || []).forEach((s) => {
      const g = s.localizacao || 'Sem divisão';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(s);
    });
    return [...m.entries()];
  }, [u]);

  if (loading && !u) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;

  return (
    <>
      <PageHeader title={u.nome} subtitle={u.endereco || undefined} back="/unidades" />
      <h2 className="mt">Setores</h2>
      {!grupos.length ? <Empty>Esta unidade ainda não tem setores.</Empty> : grupos.map(([nome, lista]) => {
                return (
          <section key={nome} className="setores-grupo">
            <p className="mapa-macro-tit">{nome}</p>
            {(
              <div className="setores-lista">
                {lista.map((s) => (
                  <div key={s.id} className={`setor-item ${s.ativo ? '' : 'inativo'}`}>
                    <button type="button" className="setor-item-corpo" onClick={() => nav(`/setores/${s.id}`)}>
                      <strong>{s.nome}</strong>
                    </button>
                    <span className="setor-qtd" title="Equipamentos">{s.total_equipamentos}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
