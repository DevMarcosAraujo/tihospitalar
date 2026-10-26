import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Empty, ErrorMsg, Loading, Options, PageHeader } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';

const PERIODOS = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const br = (d) => d.toLocaleDateString('pt-BR');

// Início e fim do período que contém a data de referência
function intervalo(periodo, ref) {
  const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (periodo === 'dia') return [r, r];
  if (periodo === 'semana') {
    const ini = new Date(r); ini.setDate(r.getDate() - ((r.getDay() + 6) % 7)); // segunda-feira
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return [ini, fim];
  }
  if (periodo === 'mes') return [new Date(r.getFullYear(), r.getMonth(), 1), new Date(r.getFullYear(), r.getMonth() + 1, 0)];
  return [new Date(r.getFullYear(), 0, 1), new Date(r.getFullYear(), 11, 31)];
}

function mover(periodo, ref, passo) {
  const d = new Date(ref);
  if (periodo === 'dia') d.setDate(d.getDate() + passo);
  else if (periodo === 'semana') d.setDate(d.getDate() + 7 * passo);
  else if (periodo === 'mes') d.setMonth(d.getMonth() + passo, 1);
  else d.setFullYear(d.getFullYear() + passo, 0, 1);
  return d;
}

function rotuloPeriodo(periodo, ini, fim) {
  if (periodo === 'dia') return br(ini);
  if (periodo === 'semana') return `${br(ini)} a ${br(fim)}`;
  if (periodo === 'mes') return `${MESES[ini.getMonth()]} de ${ini.getFullYear()}`;
  return String(ini.getFullYear());
}

const CABECALHO = ['Data e hora', 'Usuário', 'Perfil', 'Ação', 'O quê', 'Descrição', 'Unidade'];
const linhaDe = (a) => [fmtDateTime(a.criado_em), a.usuario_nome, a.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Técnico',
  a.acao.charAt(0) + a.acao.slice(1).toLowerCase(), a.entidade, a.descricao, a.unidade_nome || '—'];

async function logoPng() {
  const img = new Image();
  img.src = '/logo.svg';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  c.getContext('2d').drawImage(img, 0, 0, 512, 512);
  return c.toDataURL('image/png');
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

export default function Atividades() {
  const { unidadeId } = useAuth();
  const [periodo, setPeriodo] = useState('dia');
  const [ref, setRef] = useState(() => new Date());
  const [usuarioId, setUsuarioId] = useState('');
  const usuarios = useApi('/usuarios');
  const [ini, fim] = intervalo(periodo, ref);
  const { data, loading, error } = useApi('/atividades', { de: iso(ini), ate: iso(fim), usuario_id: usuarioId, unidade_id: unidadeId });

  const nomeArquivo = `atividades-${periodo}-${iso(ini)}`;

  function excel() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [CABECALHO, ...(data || []).map(linhaDe)].map((l) => l.map(esc).join(';')).join('\r\n');
    baixar(new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8' }), `${nomeArquivo}.csv`);
  }

  async function pdf() {
    const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), logoPng()]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const marcadas = new Set();
    const moldura = () => {
      const n = doc.internal.getCurrentPageInfo().pageNumber;
      if (marcadas.has(n)) return;
      marcadas.add(n);
      doc.setGState(new doc.GState({ opacity: 0.07 }));
      doc.addImage(logo, 'PNG', W / 2 - 170, H / 2 - 170, 340, 340);
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setFillColor(7, 11, 31); doc.rect(0, 0, W, 62, 'F');
      doc.addImage(logo, 'PNG', 30, 12, 38, 38);
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('Atividades executadas - MedSênior SIG', 80, 32);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(155, 233, 247);
      doc.text(`${rotuloPeriodo(periodo, ini, fim)}  |  ${(data || []).length} atividade(s)  |  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 80, 48);
      doc.setFillColor(0, 229, 255); doc.rect(0, 62, W, 3, 'F');
      doc.setTextColor(120); doc.setFontSize(8);
      doc.text('Arquitetura: Rodrigo Souza  |  Engenheiro: Marcos Araujo', 30, H - 16);
      doc.text(`Página ${n}`, W - 30, H - 16, { align: 'right' });
    };
    moldura();
    autoTable(doc, {
      head: [CABECALHO], body: (data || []).map(linhaDe), startY: 82,
      margin: { top: 82, left: 30, right: 30, bottom: 30 },
      styles: { fontSize: 8, cellPadding: 4, textColor: [30, 35, 60], lineColor: [220, 224, 240], lineWidth: 0.4 },
      headStyles: { fillColor: [74, 40, 190], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 246, 255] },
      didDrawPage: moldura,
    });
    doc.save(`${nomeArquivo}.pdf`);
  }

  // Um bloco por pessoa, com o total do período e a lista de tiks
  const porPessoa = useMemo(() => {
    const m = new Map();
    (data || []).forEach((a) => {
      const k = a.usuario_id ?? 0;
      if (!m.has(k)) m.set(k, { nome: a.usuario_nome, perfil: a.perfil, itens: [] });
      m.get(k).itens.push(a);
    });
    return [...m.values()].sort((a, b) => b.itens.length - a.itens.length);
  }, [data]);

  return (
    <>
      <PageHeader title="Atividades dos técnicos" subtitle="Tudo o que cada técnico fez no sistema, com data e hora">
        <button className="btn" onClick={excel} disabled={!data?.length}><FileSpreadsheet size={18} /> Baixar Excel</button>
        <button className="btn btn-primary" onClick={pdf} disabled={!data?.length}><FileText size={18} /> Baixar PDF</button>
      </PageHeader>

      <div className="tabs">
        {PERIODOS.map(([id, nome]) => (
          <button key={id} className={`tab ${periodo === id ? 'ativa' : ''}`} onClick={() => setPeriodo(id)}>{nome}</button>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn btn-sm" onClick={() => setRef(mover(periodo, ref, -1))} aria-label="Período anterior"><ChevronLeft size={16} /></button>
        <strong style={{ minWidth: 180, textAlign: 'center' }}>{rotuloPeriodo(periodo, ini, fim)}</strong>
        <button className="btn btn-sm" onClick={() => setRef(mover(periodo, ref, 1))} aria-label="Próximo período"><ChevronRight size={16} /></button>
        <button className="btn btn-sm" onClick={() => setRef(new Date())}>Hoje</button>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}><Options items={usuarios.data} vazio="Todos os usuários" /></select>
      </div>

      <ErrorMsg>{error}</ErrorMsg>
      {loading && !data ? <Loading /> : !porPessoa.length ? <Empty>Nenhuma atividade neste período.</Empty> : (
        <>
          <div className="chips" style={{ marginBottom: '1rem' }}>
            {porPessoa.map((p) => <span key={p.nome} className="chip">{p.nome}: {p.itens.length}</span>)}
          </div>
          {porPessoa.map((p) => (
            <div className="card" key={p.nome} style={{ marginBottom: '1rem' }}>
              <h2 style={{ marginTop: 0 }}>{p.nome} <span className="muted" style={{ fontSize: '.9rem', fontWeight: 400 }}>
                {p.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Técnico'} · {p.itens.length} atividade(s)</span></h2>
              <ul className="atividades-lista">
                {p.itens.map((a) => (
                  <li key={a.id}>
                    <CheckCircle2 size={18} className="tik" />
                    <div>
                      <strong>{a.acao.charAt(0) + a.acao.slice(1).toLowerCase()}</strong> · {a.entidade}: {a.descricao}
                      <div className="muted">{fmtDateTime(a.criado_em)}{a.unidade_nome ? ` · ${a.unidade_nome}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </>
  );
}
