import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useApi } from '../../api/useApi';
import { ErrorMsg, Loading, Options, PageHeader } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';

// Cada opção diz quais equipamentos entram no arquivo
const TIPOS = [
  { id: 'todos', label: 'Todos', test: () => true },
  { id: 'pcs', label: 'Computadores (PC + notebooks)', test: (e) => e.categoria === 'Computadores' },
  { id: 'desktop', label: 'Só PCs (desktop)', test: (e) => e.categoria === 'Computadores' && e.tipo !== 'Notebook' },
  { id: 'notebook', label: 'Só notebooks', test: (e) => e.tipo === 'Notebook' },
  { id: 'impressoras', label: 'Impressoras', test: (e) => e.categoria === 'Impressoras' },
  { id: 'tvs', label: 'TVs / Painéis', test: (e) => e.categoria === 'Audiovisual' },
  { id: 'leitos', label: 'Beira leito', test: (e) => e.categoria === 'Beira leito' },
];

const COLUNAS = [
  ['Equipamento', (e) => nomeEquip(e)],
  ['Tipo', (e) => [e.tipo, e.fabricante, e.modelo].filter(Boolean).join(' · ')],
  ['Unidade', (e) => e.unidade_nome],
  ['Setor', (e) => e.setor_nome || e.divisao],
  ['Posição', (e) => e.sala],
  ['Hostname da máquina', (e) => e.hostname || e.ligado_a_hostname],
  ['IP', (e) => e.ip],
  ['TeamViewer / AnyDesk', (e) => e.teamviewer],
  ['Nº de série', (e) => e.numero_serie],
  ['Status', (e) => STATUS_EQUIP[e.status]?.[0] || e.status],
];

const nat = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
const linhasDe = (lista) => lista.map((e) => COLUNAS.map(([, f]) => f(e) || '—'));

// A logo (SVG) vira PNG para entrar no PDF
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

export default function Exportar() {
  const [tipo, setTipo] = useState('todos');
  const [unidadeId, setUnidadeId] = useState('');
  const [inativos, setInativos] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const unidades = useApi('/unidades');
  const { data, loading, error } = useApi('/equipamentos', { unidade_id: unidadeId, inativos });

  const sel = TIPOS.find((t) => t.id === tipo);
  const lista = useMemo(() => (data || []).filter(sel.test).sort((a, b) =>
    nat(a.unidade_nome, b.unidade_nome) || nat(a.setor_nome || a.divisao, b.setor_nome || b.divisao) || nat(a.sala, b.sala) || nat(nomeEquip(a), nomeEquip(b))), [data, sel]);
  const unidadeNome = unidades.data?.find((u) => String(u.id) === String(unidadeId))?.nome || 'Todas as unidades';
  const arquivo = `equipamentos-${tipo}-${new Date().toISOString().slice(0, 10)}`;

  function excel() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [COLUNAS.map(([n]) => n), ...linhasDe(lista)].map((l) => l.map(esc).join(';')).join('\r\n');
    baixar(new Blob(['﻿' + linhas], { type: 'text/csv;charset=utf-8' }), `${arquivo}.csv`);
  }

  async function pdf() {
    setErro(''); setGerando(true);
    try {
      const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import('jspdf'), import('jspdf-autotable'), logoPng()]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const hoje = new Date().toLocaleDateString('pt-BR');
      const marcadas = new Set();

      // Cabeçalho, marca d'água e rodapé de cada página (uma vez só)
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
        doc.text('Mapeamento de TI - MedSênior SIG', 80, 32);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(155, 233, 247);
        doc.text(`${sel.label}  |  ${unidadeNome}  |  ${lista.length} equipamento(s)  |  Gerado em ${hoje}`, 80, 48);
        doc.setFillColor(0, 229, 255); doc.rect(0, 62, W, 3, 'F');
        doc.setTextColor(120); doc.setFontSize(8);
        doc.text('Arquitetura: Rodrigo Souza  |  Engenheiro: Marcos Araujo', 30, H - 16);
        doc.text(`Página ${n}`, W - 30, H - 16, { align: 'right' });
      };

      // Quando o tipo é "Todos", cada categoria vira uma seção
      const grupos = tipo === 'todos'
        ? [...new Set(lista.map((e) => e.categoria))].map((c) => [c, lista.filter((e) => e.categoria === c)])
        : [[sel.label, lista]];
      let y = 86;
      moldura();
      grupos.forEach(([titulo, itens]) => {
        if (y > H - 110) { doc.addPage(); y = 86; moldura(); }
        doc.setTextColor(7, 11, 31); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        doc.text(`${titulo} (${itens.length})`, 30, y);
        autoTable(doc, {
          head: [COLUNAS.map(([n]) => n)],
          body: linhasDe(itens),
          startY: y + 8,
          margin: { top: 82, left: 30, right: 30, bottom: 30 },
          styles: { fontSize: 8, cellPadding: 4, textColor: [30, 35, 60], lineColor: [220, 224, 240], lineWidth: 0.4 },
          headStyles: { fillColor: [74, 40, 190], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [244, 246, 255] },
          didDrawPage: moldura,
        });
        y = doc.lastAutoTable.finalY + 26;
      });
      doc.save(`${arquivo}.pdf`);
    } catch (e) { setErro(e.message || 'Não foi possível gerar o PDF'); }
    setGerando(false);
  }

  return (
    <>
      <PageHeader title="Exportar equipamentos" subtitle="Baixe a lista em PDF (com a logo ao fundo) ou em Excel">
        <button className="btn" onClick={excel} disabled={!lista.length}><FileSpreadsheet size={18} /> Baixar Excel</button>
        <button className="btn btn-primary" onClick={pdf} disabled={!lista.length || gerando}><FileText size={18} /> {gerando ? 'Gerando…' : 'Baixar PDF'}</button>
      </PageHeader>

      <h2>O que baixar</h2>
      <div className="escolhas" style={{ marginBottom: '1rem' }}>
        {TIPOS.map((t) => (
          <button type="button" key={t.id} className={`escolha ${tipo === t.id ? 'sel' : ''}`} onClick={() => setTipo(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="toolbar">
        <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}><Options items={unidades.data} vazio="Todas as unidades" /></select>
        <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Incluir inativos</label>
      </div>
      <ErrorMsg>{erro || error}</ErrorMsg>
      {loading && !data ? <Loading /> : (
        <div className="card">
          <p><strong>{lista.length}</strong> equipamento(s) serão exportados: {sel.label.toLowerCase()} · {unidadeNome}.</p>
          <p className="muted">O arquivo não inclui senhas de acesso remoto.</p>
        </div>
      )}
    </>
  );
}
