// ============================================================
// ABA RELATÓRIOS: troca de sub-aba (Controle / Metas) e o
// Relatório de Controle: faturamento, comissões, pagamentos e
// faturas vencidas (a partir das NFs), com exportação PDF/XLSX
// ============================================================

function switchRelTab(tab){
  const abas = {controle:['subRelControleBtn','subRelControle'], metas:['subRelMetasBtn','subRelMetas']};
  Object.keys(abas).forEach(t=>{
    document.getElementById(abas[t][0]).classList.toggle('active', t===tab);
    document.getElementById(abas[t][1]).style.display = t===tab ? 'block' : 'none';
  });

  if(tab==='controle'){
    if(!document.getElementById('relCtrlDataIni').value){
      const now=new Date(),pad=n=>String(n).padStart(2,'0');
      document.getElementById('relCtrlDataIni').value=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-01';
      document.getElementById('relCtrlDataFim').value=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
    }
    if(!CONTROLE||!CONTROLE.length)loadControle();
    _initRelCtrlSecoes();
  }
  if(tab==='metas'){
    if(!CONTROLE||!CONTROLE.length)loadControle();
    initMetas();
  }
}

// Seções que o usuário pode exibir/ocultar (vale para tela, PDF e XLSX)
const REL_CTRL_SECOES = [
  {id:'cardSecFatMes', label:'Faturado por mês'},
  {id:'cardSecPontas', label:'Pontas de Produção / Classe B'},
  {id:'cardSecComPais', label:'Comissão por país destino'},
  {id:'cardSecMatriz', label:'Faturamento por mês × país'},
  {id:'cardSecTopClientes', label:'Top clientes'},
  {id:'cardSecPagos', label:'Pagamentos recebidos'},
  {id:'cardSecVencidas', label:'Faturas vencidas'},
];
const REL_CTRL_SECOES_STORAGE_KEY = 'adexport_relctrl_secoes_v1';
function _carregarRelCtrlSecoesStorage(){
  try { return JSON.parse(localStorage.getItem(REL_CTRL_SECOES_STORAGE_KEY)) || {}; } catch(e){ return {}; }
}
let _relCtrlSecoesState = _carregarRelCtrlSecoesStorage();
function _salvarRelCtrlSecoesStorage(){
  try { localStorage.setItem(REL_CTRL_SECOES_STORAGE_KEY, JSON.stringify(_relCtrlSecoesState)); } catch(e){}
}
function _initRelCtrlSecoes(){
  const wrap = document.getElementById('relCtrlSecoesWrap');
  if(!wrap || wrap.children.length) { _aplicarRelCtrlSecoesVisibilidade(); return; } // já inicializado
  REL_CTRL_SECOES.forEach(sec=>{
    if(_relCtrlSecoesState[sec.id]===undefined) _relCtrlSecoesState[sec.id]=true;
    const ativo = _relCtrlSecoesState[sec.id];
    const btn=document.createElement('button');
    btn.className='col-toggle-btn'+(ativo?' visible':'');
    btn.textContent=sec.label;
    btn.dataset.id=sec.id;
    btn.onclick=()=>{
      const novo = !_relCtrlSecoesState[sec.id];
      _relCtrlSecoesState[sec.id]=novo;
      btn.classList.toggle('visible',novo);
      _salvarRelCtrlSecoesStorage();
      _aplicarRelCtrlSecoesVisibilidade();
    };
    wrap.appendChild(btn);
  });
  _aplicarRelCtrlSecoesVisibilidade();
}
function _aplicarRelCtrlSecoesVisibilidade(){
  REL_CTRL_SECOES.forEach(sec=>{
    const el = document.getElementById(sec.id);
    if(el) el.style.display = (_relCtrlSecoesState[sec.id]===false) ? 'none' : '';
  });
}

// ═══════════════════════════════════════════════════════════════

// RELATÓRIO DE CONTROLE
let relCtrlFiltros = {dataIni:'', dataFim:'', cliente:'', pais:'', transporte:''};

function setRelCtrlPeriodo(tipo, e){
  document.querySelectorAll('#subRelControle .rel-shortcut-btn').forEach(b=>b.classList.remove('active-shortcut'));
  if(e && e.currentTarget) e.currentTarget.classList.add('active-shortcut');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let ini = new Date(hoje), fim = new Date(hoje);
  if(tipo==='mes_anterior'){ ini = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1); fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); }
  else if(tipo==='mes'){ ini.setDate(1); }
  else if(tipo==='trimestre'){ ini.setMonth(ini.getMonth()-2); ini.setDate(1); }
  else if(tipo==='semestre'){ ini.setMonth(ini.getMonth()-5); ini.setDate(1); }
  else if(tipo==='ano'){ ini = new Date(hoje.getFullYear(),0,1); }
  const fmt = d => d.toISOString().split('T')[0];
  document.getElementById('relCtrlDataIni').value = fmt(ini);
  document.getElementById('relCtrlDataFim').value = fmt(fim);
  relCtrlFiltros.dataIni = fmt(ini);
  relCtrlFiltros.dataFim = fmt(fim);
}

function relCtrlClienteInput(v){
  const dd=document.getElementById('relCtrlClienteDd');
  const lista=[...new Set((CONTROLE||[]).map(r=>r.cliente_nome).filter(Boolean))].sort();
  const m=v?lista.filter(c=>c.toLowerCase().includes(v.toLowerCase())):lista.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.map(c=>`<div class="autocomplete-item" onmousedown="relCtrlSelectCliente('${c.replace(/'/g,"\\'")}')">${c}</div>`).join('');
  dd.classList.remove('hidden');
}
function relCtrlSelectCliente(v){
  document.getElementById('relCtrlCliente').value=v;
  document.getElementById('relCtrlClienteDd').classList.add('hidden');
}

function relCtrlPaisInput(v){
  const dd=document.getElementById('relCtrlPaisDd');
  const lista=[...new Set((CONTROLE||[]).map(r=>r.pais_destino||'').filter(Boolean))].sort();
  const m=v?lista.filter(c=>c.toLowerCase().includes(v.toLowerCase())):lista.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.map(c=>`<div class="autocomplete-item" onmousedown="relCtrlSelectPais('${c.replace(/'/g,"\\'")}')">${c}</div>`).join('');
  dd.classList.remove('hidden');
}
function relCtrlSelectPais(v){
  document.getElementById('relCtrlPais').value=v;
  document.getElementById('relCtrlPaisDd').classList.add('hidden');
}

function setRelCtrlTransporte(v){
  ['relCtrlTrTodos','relCtrlTrMar','relCtrlTrRod'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  const btnId = v===''?'relCtrlTrTodos':v==='maritimo'?'relCtrlTrMar':'relCtrlTrRod';
  document.getElementById(btnId)?.classList.add('active');
  relCtrlFiltros.transporte = v;
}

function limparFiltrosCtrl(){
  relCtrlFiltros={dataIni:'',dataFim:'',cliente:'',pais:'',transporte:''};
  ['relCtrlDataIni','relCtrlDataFim','relCtrlCliente','relCtrlPais'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setRelCtrlTransporte('');
  document.querySelectorAll('#subRelControle .rel-shortcut-btn').forEach(b=>b.classList.remove('active-shortcut'));
}

function _parseBR(s){
  if(!s) return null;
  const p=String(s).trim().split('/');
  if(p.length===3){const d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));return isNaN(d.getTime())?null:d;}
  return null;
}
function _mesLabel(ano,mes){
  return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes]+'/'+String(ano).slice(2);
}

function gerarRelatorioControle(){
  const ini = document.getElementById('relCtrlDataIni').value;
  const fim = document.getElementById('relCtrlDataFim').value;
  relCtrlFiltros.dataIni = ini;
  relCtrlFiltros.dataFim = fim;
  relCtrlFiltros.cliente = document.getElementById('relCtrlCliente').value.trim();
  relCtrlFiltros.pais    = document.getElementById('relCtrlPais').value.trim();

  document.getElementById('relCtrlLoading').classList.remove('hidden');
  document.getElementById('relCtrlEmpty').classList.add('hidden');
  document.getElementById('relCtrlResultado').classList.add('hidden');

  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    const todasNFs = d.success ? d.data : [];
    _processarRelatorioControle(todasNFs, ini, fim);
  }).withFailureHandler(e=>{
    document.getElementById('relCtrlLoading').classList.add('hidden');
    showToast('Erro ao buscar NFs: '+e.message,'error');
  }).getTodasNFs();
}

// NFs com incluir_relatorio===false não entram no Relatório de Controle: nem nas somas
// (KPIs, totais por mês, por país, exportação PDF/XLSX — todos derivam de
// nfsNoPeriodo/nfsTodas abaixo), nem na listagem — ficam completamente fora, como se
// não existissem no relatório (ex.: NF reemitida por troca de porto, cuja venda já foi
// contabilizada na NF original devolvida).
function _aplicarInclusaoRelatorio(lista){
  return (lista||[]).filter(n => n.incluir_relatorio !== false);
}

function _processarRelatorioControle(todasNFsRaw, ini, fim){
  const todasNFs = _aplicarInclusaoRelatorio(todasNFsRaw);
  const iniD = ini ? new Date(ini+'T00:00:00') : null;
  const fimD = fim ? new Date(fim+'T23:59:59') : null;

  const nfsNoPeriodo = (todasNFs||[]).filter(nf=>{
    // Proforma sem NF lançada (linha sintética com Comissão Manual) NÃO entra no faturado:
    // aparece apenas em "Pagamentos Recebidos", pela data de pagamento.
    if(nf.manual) return false;
    const d=_parseBR(nf.data_faturamento); if(!d) return false;
    if(iniD && d<iniD) return false;
    if(fimD && d>fimD) return false;
    return true;
  }).filter(nf=>{
    const reg = (CONTROLE||[]).find(r=>r.numero_proforma===nf.numero_proforma);
    if(reg && (reg.transporte||'').toLowerCase()==='amostra') return false; // amostras nunca entram no relatório
    if(relCtrlFiltros.cliente && !((reg&&reg.cliente_nome)||'').toLowerCase().includes(relCtrlFiltros.cliente.toLowerCase())) return false;
    const dest = (reg&&reg.pais_destino)||'';
    if(relCtrlFiltros.pais && !dest.toLowerCase().includes(relCtrlFiltros.pais.toLowerCase())) return false;
    if(relCtrlFiltros.transporte && reg && (reg.transporte||'').toLowerCase()!==relCtrlFiltros.transporte) return false;
    return true;
  });

  setTimeout(()=>{
    document.getElementById('relCtrlLoading').classList.add('hidden');
    if(!nfsNoPeriodo.length){ document.getElementById('relCtrlEmpty').classList.remove('hidden'); return; }
    // Passa todasNFs (sem filtro de período) para permitir o cálculo de comissão dos
    // Pagamentos Recebidos mesmo quando a NF foi faturada fora do período do relatório.
    renderRelatorioControle(nfsNoPeriodo, ini, fim, todasNFs);
  }, 60);
}

function renderRelatorioControle(nfsTodas, ini, fim, nfsCompletas){
  document.getElementById('relCtrlResultado').classList.remove('hidden');
  const fmtN2 = n => isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtBR = s => s ? s.split('-').reverse().join('/') : '—';
  const buscaReg = proforma => (CONTROLE||[]).find(r=>r.numero_proforma===proforma) || {};

  // Separa Pontas de Produção / Classe B do restante — são exibidas em seção própria.
  // 03/11/2026: quando a NF traz a parte Ponta/Classe B (colunas S/T da aba NF, lidas do XML),
  // a NF é dividida pelos itens dela (uma NF pode misturar Extra e Ponta/Classe B).
  // NF sem essas colunas (lançada antes) segue a marcação Ponta/Classe B da proforma.
  const nfsPontas = [], nfsNoPeriodo = [];
  nfsTodas.forEach(n=>{
    const reg = buscaReg(n.numero_proforma);
    const temNF = n.ponta_rs !== null && n.ponta_rs !== undefined;
    if(!temNF){
      if(reg.ponta==='SIM'||reg.classe_b==='SIM') nfsPontas.push(n); else nfsNoPeriodo.push(n);
      return;
    }
    const vRS = n.valor_rs||0, pRS = n.ponta_rs||0, pSq = n.ponta_sqmt||0;
    if(Math.abs(pRS) < 0.005 && Math.abs(pSq) < 0.005){ nfsNoPeriodo.push(n); return; }
    const f = vRS ? Math.min(1, Math.max(0, pRS/vRS)) : 1;
    if(f > 0.9999){ nfsPontas.push(n); return; }
    const parte = (fr, rs, sq) => Object.assign({}, n, {
      valor_rs: rs, sqmt: sq, valor_us: (n.valor_us||0)*fr,
      comissao_valor: (n.comissao_valor||0)*fr, comissao_valor_rs: (n.comissao_valor_rs||0)*fr
    });
    nfsPontas.push(parte(f, pRS, pSq));
    nfsNoPeriodo.push(parte(1-f, vRS-pRS, (n.sqmt||0)-pSq));
  });

  const proformasUnicas = new Set(nfsTodas.map(n=>n.numero_proforma));
  document.getElementById('relCtrlPeriodoBadge').textContent =
    (ini?fmtBR(ini):'—') + ' → ' + (fim?fmtBR(fim):'—') + ' · ' + proformasUnicas.size + ' proforma'+(proformasUnicas.size!==1?'s':'');

  // KPIs do topo = totais SOMADOS (geral + pontas)
  const totalValor = nfsTodas.reduce((a,n)=>a+(n.valor_us||0),0);
  const totalValorRS = nfsTodas.reduce((a,n)=>a+(n.valor_rs||0),0);
  const totalCom   = nfsTodas.reduce((a,n)=>a+(n.comissao_valor||0),0);
  const totalComRS = nfsTodas.reduce((a,n)=>a+(n.comissao_valor_rs||0),0);
  const totalSqmt  = nfsTodas.reduce((a,n)=>a+(n.sqmt||0),0);
  document.getElementById('ctrlKpiValor').textContent = 'US$ '+fmtN2(totalValor);
  document.getElementById('ctrlKpiValor').nextElementSibling.textContent = 'R$ '+fmtN2(totalValorRS);
  document.getElementById('ctrlKpiCom').textContent   = 'US$ '+fmtN2(totalCom);
  document.getElementById('ctrlKpiCom').nextElementSibling.textContent = 'R$ '+fmtN2(totalComRS);
  document.getElementById('ctrlKpiSqmt').textContent  = fmtN2(totalSqmt);
  document.getElementById('ctrlKpiTot').textContent   = proformasUnicas.size;
  document.getElementById('ctrlKpiTotSub').textContent = 'proformas com NF (geral + pontas)';

  // Preço médio e cotação média do dólar (também sobre o total combinado)
  const cotacoesGeral = nfsTodas.map(n=>n.cotacao).filter(c=>c>0);
  const cotacaoMediaGeral = cotacoesGeral.length ? cotacoesGeral.reduce((a,b)=>a+b,0)/cotacoesGeral.length : 0;
  // 03/11/2026: Preço Médio separado — o principal exclui Pontas de Produção / Classe B
  // (vendas pontuais, fora do padrão da fábrica), que ganham um preço médio próprio.
  const normValor = nfsNoPeriodo.reduce((a,n)=>a+(n.valor_us||0),0);
  const normValorRS = nfsNoPeriodo.reduce((a,n)=>a+(n.valor_rs||0),0);
  const pontaValorRS = nfsPontas.reduce((a,n)=>a+(n.valor_rs||0),0);
  const normSqmt  = nfsNoPeriodo.reduce((a,n)=>a+(n.sqmt||0),0);
  const pontaValor = nfsPontas.reduce((a,n)=>a+(n.valor_us||0),0);
  const pontaSqmt  = nfsPontas.reduce((a,n)=>a+(n.sqmt||0),0);
  const precoMedioUSD = normSqmt ? (normValor/normSqmt) : 0;
  // 03/11/2026: Preço Médio R$ = valor R$ real das NFs ÷ m² (mesmo critério do Relatório de Metas)
  const precoMedioRS  = normSqmt ? (normValorRS/normSqmt) : 0;
  const precoMedioPontaUSD = pontaSqmt ? (pontaValor/pontaSqmt) : 0;
  const precoMedioPontaRS  = pontaSqmt ? (pontaValorRS/pontaSqmt) : 0;
  const precoMedioEl = document.getElementById('ctrlPrecoMedioWrap');
  if(precoMedioEl){
    precoMedioEl.innerHTML = `
      <div class="kpi-card" style="--kpi-color:var(--accent2)"><div class="kpi-label">Cotação Média US$/R$</div><div class="kpi-value">${cotacaoMediaGeral?'R$ '+fmtN2(cotacaoMediaGeral):'—'}</div><div class="kpi-sub">R$ por US$</div></div>
      <div class="kpi-card" style="--kpi-color:var(--accent)"><div class="kpi-label">Preço Médio US$</div><div class="kpi-value">${precoMedioUSD?'US$ '+fmtN2(precoMedioUSD):'—'}</div><div class="kpi-sub">por unidade · sem Pontas/Classe B</div></div>
      <div class="kpi-card" style="--kpi-color:var(--success)"><div class="kpi-label">Preço Médio R$</div><div class="kpi-value">${precoMedioRS?'R$ '+fmtN2(precoMedioRS):'—'}</div><div class="kpi-sub">por unidade · sem Pontas/Classe B</div></div>
      <div class="kpi-card" style="--kpi-color:var(--warn)"><div class="kpi-label">Preço médio Pontas/Classe B</div><div class="kpi-value">${precoMedioPontaUSD?'US$ '+fmtN2(precoMedioPontaUSD):'—'}</div><div class="kpi-sub">${precoMedioPontaRS?'R$ '+fmtN2(precoMedioPontaRS)+' · ':''}por unidade</div></div>`;
  }

  // Agrupar por mês (data_faturamento da NF), com sub-agrupamento por proforma
  function agruparPorMes(lista){
    const porMes = {};
    lista.forEach(n=>{
      const d = _parseBR(n.data_faturamento);
      if(!d) return;
      const key = d.getFullYear()+'-'+(d.getMonth()+1);
      if(!porMes[key]) porMes[key]={ano:d.getFullYear(),mes:d.getMonth(),label:_mesLabel(d.getFullYear(),d.getMonth()),nfs:[]};
      porMes[key].nfs.push(n);
    });
    return Object.values(porMes).sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.mes-b.mes);
  }
  const mesesOrdenados = agruparPorMes(nfsNoPeriodo);

  function linhaNF(n, indentada){
    const reg = buscaReg(n.numero_proforma);
    const style = (n.devolvida||n.eh_devolucao) ? 'background:var(--danger-soft);' : '';
    // Selo de devolução: na NF original marcada Devolvida, e na linha sintética de abatimento
    // gerada automaticamente no mês da devolução.
    let seloDevolucao = '';
    if(n.devolvida){
      seloDevolucao = `<br><span class="selo selo-perigo">Devolvida${n.nf_devolucao?' · NF Dev: '+esc(n.nf_devolucao):''}${n.data_nf_devolucao?' · '+esc(n.data_nf_devolucao):' · sem data'}${n.abater_relatorio===false?' · sem abatimento':''}</span>`;
    } else if(n.eh_devolucao){
      seloDevolucao = `<br><span class="selo selo-perigo">Abatimento (devolução)</span>`;
    }
    return `<tr style="${style}">
      <td style="${indentada?'padding-left:22px;color:var(--text3);':''}">${indentada?'↳ ':''}${esc(n.numero_proforma)}</td>
      <td>${esc(reg.cliente_nome||'—')}</td>
      <td>${esc(n.numero_nf)||'—'}${seloDevolucao}</td>
      <td style="color:var(--text3);">${esc(n.data_faturamento)||'—'}</td>
      <td style="text-align:right;"><div style="color:var(--accent);font-weight:700;">US$ ${fmtN2(n.valor_us)}</div><div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(n.valor_rs)}</div></td>
      <td style="text-align:right;">${fmtComissaoPct(n.comissao_pct_raw)}</td>
      <td style="text-align:right;"><div style="color:var(--success);font-weight:700;">${fmtComissaoUS(n.comissao_pct_raw,n.comissao_valor)}</div><div style="color:var(--text3);font-size:11px;">${fmtComissaoRS(n.comissao_pct_raw,n.comissao_valor_rs)}</div></td>
      <td style="text-align:right;">${n.sqmt?fmtN2(n.sqmt):'—'}</td>
    </tr>`;
  }

  // Compara números de proforma no formato NNNNN/AA (ano, depois sequência)
  function _compararProforma(a, b){
    const parse = s => { const m=String(s||'').match(/(\d+)\D*(\d+)?/); return m ? (parseInt(m[2]||0)*1000000+parseInt(m[1])) : 0; };
    return parse(a) - parse(b);
  }

  // Renderiza um bloco "por mês" (usado tanto para Faturado por Mês quanto para Pontas de Produção)
  function renderBlocoMeses(mesesLista){
    return mesesLista.map(m=>{
      const totMes  = m.nfs.reduce((a,n)=>a+(n.valor_us||0),0);
      const totMesRS = m.nfs.reduce((a,n)=>a+(n.valor_rs||0),0);
      const comMes  = m.nfs.reduce((a,n)=>a+(n.comissao_valor||0),0);
      const comMesRS = m.nfs.reduce((a,n)=>a+(n.comissao_valor_rs||0),0);
      const sqmtMes = m.nfs.reduce((a,n)=>a+(n.sqmt||0),0);
      const cotacoes = m.nfs.map(n=>n.cotacao).filter(c=>c>0);
      const cotacaoMedia = cotacoes.length ? cotacoes.reduce((a,b)=>a+b,0)/cotacoes.length : 0;

      // Agrupa as NFs do mês por proforma, ordenadas da menor para a maior, mostrando total + detalhamento quando houver >1 NF
      const porProforma = {};
      m.nfs.forEach(n=>{ (porProforma[n.numero_proforma]=porProforma[n.numero_proforma]||[]).push(n); });
      const proformasOrdenadas = Object.keys(porProforma).sort(_compararProforma);
      const rows = proformasOrdenadas.map(proforma=>{
        const nfs = porProforma[proforma];
        if(nfs.length === 1) return linhaNF(nfs[0], false);
        const reg = buscaReg(proforma);
        const tValor=nfs.reduce((a,n)=>a+(n.valor_us||0),0), tValorRS=nfs.reduce((a,n)=>a+(n.valor_rs||0),0);
        const tCom=nfs.reduce((a,n)=>a+(n.comissao_valor||0),0), tComRS=nfs.reduce((a,n)=>a+(n.comissao_valor_rs||0),0);
        const tSqmt=nfs.reduce((a,n)=>a+(n.sqmt||0),0);
        const totalRow = `<tr style="background:var(--accent-soft);">
          <td style="font-weight:700;">${esc(proforma)}<br><span style="font-size:10px;color:var(--text3);font-weight:400;">(${nfs.length} NFs)</span></td>
          <td style="font-weight:700;">${esc(reg.cliente_nome||'—')}</td>
          <td>—</td>
          <td>—</td>
          <td style="text-align:right;"><div style="color:var(--accent);font-weight:700;">US$ ${fmtN2(tValor)}</div><div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(tValorRS)}</div></td>
          <td>—</td>
          <td style="text-align:right;"><div style="color:var(--success);font-weight:700;">US$ ${fmtN2(tCom)}</div><div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(tComRS)}</div></td>
          <td style="text-align:right;font-weight:700;">${fmtN2(tSqmt)}</td>
        </tr>`;
        return totalRow + nfs.map(n=>linhaNF(n,true)).join('');
      }).join('');

      const precoMedioMesUS = sqmtMes ? (totMes/sqmtMes) : 0;
      const precoMedioMesRS = sqmtMes ? (totMesRS/sqmtMes) : 0;

      return `<div style="margin-bottom:20px;">
        <div class="bloco-mes-titulo">${m.label}</div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:10px;font-size:12px;color:var(--text);">
          <div>NF(s): <strong>${m.nfs.length}</strong></div>
          <div>Valor: <strong>US$ ${fmtN2(totMes)}</strong> (R$ ${fmtN2(totMesRS)})</div>
          <div>Comissão: <strong>US$ ${fmtN2(comMes)}</strong> (R$ ${fmtN2(comMesRS)})</div>
          <div>Qtd: <strong>${fmtN2(sqmtMes)}</strong></div>
          <div>Cotação média: <strong>${cotacaoMedia?'R$ '+fmtN2(cotacaoMedia):'—'}</strong></div>
          <div>Preço médio: <strong>${precoMedioMesUS?'US$ '+fmtN2(precoMedioMesUS):'—'}</strong> / <strong>${precoMedioMesRS?'R$ '+fmtN2(precoMedioMesRS):'—'}</strong></div>
        </div>
        <div style="overflow-x:auto;">
          <table class="pedidos-det-table" style="min-width:640px;">
            <thead><tr><th>Proforma</th><th>Cliente</th><th>Nº NF</th><th>Data Faturamento</th><th style="text-align:right;">Valor US$/R$</th><th style="text-align:right;">Com. %</th><th style="text-align:right;">Com. US$/R$</th><th style="text-align:right;">Qtd</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="border-top:2px solid var(--border);">
              <td colspan="4" style="font-weight:700;">Total ${m.label}</td>
              <td style="text-align:right;"><div style="color:var(--accent);font-weight:700;">US$ ${fmtN2(totMes)}</div><div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(totMesRS)}</div></td>
              <td></td>
              <td style="text-align:right;"><div style="color:var(--success);font-weight:700;">US$ ${fmtN2(comMes)}</div><div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(comMesRS)}</div></td>
              <td style="text-align:right;font-weight:700;color:var(--accent2);">${fmtN2(sqmtMes)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>`;
    }).join('');
  }

  // ── FATURADO POR MÊS (exclui Pontas) ──
  const fatMesEl = document.getElementById('relCtrlFatMes');
  document.getElementById('ctrlFatMesBadge').textContent = mesesOrdenados.length+' mês(es)';
  fatMesEl.innerHTML = renderBlocoMeses(mesesOrdenados) || '<p style="color:var(--text3);">Nenhuma NF no período.</p>';

  // Agrupar por País Destino (coluna AO)
  function agruparPorPaisDestino(lista){
    const porDest = {};
    lista.forEach(n=>{
      const reg = buscaReg(n.numero_proforma);
      const dest = (reg.pais_destino||'Não informado').trim() || 'Não informado';
      if(!porDest[dest]) porDest[dest]={dest,valor:0,valorRS:0,comissao:0,comissaoRS:0,sqmt:0,meses:{},cotacoes:[],percentuais:new Set()};
      porDest[dest].valor+=(n.valor_us||0); porDest[dest].valorRS+=(n.valor_rs||0);
      porDest[dest].comissao+=(n.comissao_valor||0); porDest[dest].comissaoRS+=(n.comissao_valor_rs||0);
      porDest[dest].sqmt+=(n.sqmt||0);
      if(n.cotacao>0) porDest[dest].cotacoes.push(n.cotacao);
      if(n.comissao_pct_raw!==null && n.comissao_pct_raw!==undefined) porDest[dest].percentuais.add(n.comissao_pct_raw);
      const d=_parseBR(n.data_faturamento);
      if(d){
        const ml=_mesLabel(d.getFullYear(),d.getMonth());
        if(!porDest[dest].meses[ml]) porDest[dest].meses[ml]={valor:0,valorRS:0,comissao:0,comissaoRS:0,sqmt:0};
        porDest[dest].meses[ml].valor+=(n.valor_us||0); porDest[dest].meses[ml].valorRS+=(n.valor_rs||0);
        porDest[dest].meses[ml].comissao+=(n.comissao_valor||0); porDest[dest].meses[ml].comissaoRS+=(n.comissao_valor_rs||0);
        porDest[dest].meses[ml].sqmt+=(n.sqmt||0);
      }
    });
    return Object.values(porDest).map(d=>{
      d.cotacaoMedia = d.cotacoes.length ? d.cotacoes.reduce((a,b)=>a+b,0)/d.cotacoes.length : 0;
      d.percentuaisOrdenados = Array.from(d.percentuais).sort((a,b)=>a-b);
      return d;
    }).sort((a,b)=>b.valor-a.valor);
  }
  const destOrdenados = agruparPorPaisDestino(nfsNoPeriodo);
  document.getElementById('ctrlComPaisBadge').textContent = destOrdenados.length+' país(es) destino';

  // ── COMISSÃO POR PAÍS DESTINO ──
  const destPontasOrdenados = agruparPorPaisDestino(nfsPontas);
  // 04/11/2026: país que só teve Pontas/Classe B no período também aparece (com a linha 📌)
  const destComPais = destOrdenados.concat(destPontasOrdenados
    .filter(p=>!destOrdenados.some(d=>d.dest===p.dest))
    .map(p=>({dest:p.dest,valor:0,valorRS:0,comissao:0,comissaoRS:0,sqmt:0,meses:{},percentuaisOrdenados:[]})));
  document.getElementById('relCtrlComPais').innerHTML = destComPais.map(d=>{
    const percTxt = d.percentuaisOrdenados.length ? d.percentuaisOrdenados.map(p=>fmtN2(p)+'%').join(' / ') : '-,-';
    const dPontas = destPontasOrdenados.find(x=>x.dest===d.dest);
    return `
    <tr style="background:var(--surface2);">
      <td style="font-weight:700;">${esc(d.dest)}</td>
      <td style="text-align:right;font-weight:700;">
        <div style="color:var(--accent);">US$ ${fmtN2(d.valor)}</div>
        <div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(d.valorRS)}</div>
      </td>
      <td style="text-align:right;font-weight:700;">
        <div style="color:var(--success);">US$ ${fmtN2(d.comissao)}</div>
        <div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(d.comissaoRS)}</div>
      </td>
      <td style="text-align:right;">${percTxt}</td>
    </tr>
    ${mesesOrdenados.length > 1 ? Object.entries(d.meses).map(([mes,mv])=>`<tr>
      <td style="padding-left:20px;color:var(--text3);font-size:12px;">${mes}</td>
      <td style="text-align:right;font-size:12px;">
        <div>US$ ${fmtN2(mv.valor)}</div>
        <div style="color:var(--text3);">R$ ${fmtN2(mv.valorRS)}</div>
      </td>
      <td style="text-align:right;font-size:12px;color:var(--success);">
        <div>US$ ${fmtN2(mv.comissao)}</div>
        <div style="color:var(--text3);">R$ ${fmtN2(mv.comissaoRS)}</div>
      </td>
      <td></td>
    </tr>`).join('') : ''}
    ${dPontas ? `<tr style="background:var(--warn-soft);">
      <td style="padding-left:16px;color:var(--warn);font-size:12px;">Pontas</td>
      <td style="text-align:right;font-size:12px;">
        <div style="color:var(--warn);">US$ ${fmtN2(dPontas.valor)}</div>
        <div style="color:var(--text3);">R$ ${fmtN2(dPontas.valorRS)}</div>
      </td>
      <td style="text-align:right;font-size:12px;">
        <div style="color:var(--warn);">US$ ${fmtN2(dPontas.comissao)}</div>
        <div style="color:var(--text3);">R$ ${fmtN2(dPontas.comissaoRS)}</div>
      </td>
      <td style="text-align:right;font-size:12px;">${dPontas.percentuaisOrdenados.length?dPontas.percentuaisOrdenados.map(p=>fmtN2(p)+'%').join(' / '):'-,-'}</td>
    </tr>` : ''}`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text3);">Nenhum dado</td></tr>';
  if(destComPais.length){
    document.getElementById('relCtrlComPais').innerHTML += `<tr style="border-top:2px solid var(--border);">
      <td style="font-weight:700;">Total Geral</td>
      <td style="text-align:right;font-weight:700;">
        <div style="color:var(--accent);">US$ ${fmtN2(totalValor)}</div>
        <div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(totalValorRS)}</div>
      </td>
      <td style="text-align:right;font-weight:700;">
        <div style="color:var(--success);">US$ ${fmtN2(totalCom)}</div>
        <div style="color:var(--text3);font-size:11px;">R$ ${fmtN2(totalComRS)}</div>
      </td>
      <td></td>
    </tr>`;
  }

  // ── FATURAMENTO POR MÊS × PAÍS DESTINO ──
  const allDests = destOrdenados.map(d=>d.dest);
  const fatTotalEl = document.getElementById('relCtrlFatTotal');
  if(fatTotalEl){
    if(mesesOrdenados.length && allDests.length){
      const rows = allDests.map(dest=>{
        const destObj = destOrdenados.find(d=>d.dest===dest);
        const cells = mesesOrdenados.map(m=>{
          const nfsDest = m.nfs.filter(n=>(buscaReg(n.numero_proforma).pais_destino||'Não informado').trim()===dest);
          const valUS = nfsDest.reduce((a,n)=>a+(n.valor_us||0),0);
          const valRS = nfsDest.reduce((a,n)=>a+(n.valor_rs||0),0);
          if(!valUS) return `<td style="text-align:right;font-size:12px;">—</td>`;
          return `<td style="text-align:right;font-size:12px;"><div>US$ ${fmtN2(valUS)}</div><div style="color:var(--text3);">R$ ${fmtN2(valRS)}</div></td>`;
        }).join('');
        const percTotal = totalSqmt ? (destObj.sqmt/totalSqmt*100) : 0;
        const precoMedioUS = destObj.sqmt ? (destObj.valor/destObj.sqmt) : 0;
        const precoMedioRS = destObj.sqmt ? (destObj.valorRS/destObj.sqmt) : 0;
        const linhaPrincipal = `<tr>
          <td style="font-size:12px;">${esc(dest)}</td>${cells}
          <td style="text-align:right;font-weight:700;color:var(--accent);font-size:12px;"><div>US$ ${fmtN2(destObj.valor)}</div><div style="color:var(--text3);font-weight:400;">R$ ${fmtN2(destObj.valorRS)}</div></td>
          <td style="text-align:right;font-size:12px;">${fmtN2(destObj.sqmt)}</td>
          <td style="text-align:right;font-size:12px;">${precoMedioUS?'US$ '+fmtN2(precoMedioUS):'—'}<br><span style="color:var(--text3);">${precoMedioRS?'R$ '+fmtN2(precoMedioRS):'—'}</span></td>
          <td style="text-align:right;font-size:12px;">${fmtN2(percTotal)}%</td>
        </tr>`;

        // 📌 Pontas desse país (se houver), exibidas abaixo da linha principal
        const nfsPontasDest = nfsPontas.filter(n=>(buscaReg(n.numero_proforma).pais_destino||'Não informado').trim()===dest);
        let linhaPontas = '';
        if(nfsPontasDest.length){
          const cellsPontas = mesesOrdenados.map(m=>{
            const nfsMesDest = nfsPontasDest.filter(n=>{ const d=_parseBR(n.data_faturamento); return d && _mesLabel(d.getFullYear(),d.getMonth())===m.label; });
            const valUS = nfsMesDest.reduce((a,n)=>a+(n.valor_us||0),0);
            const valRS = nfsMesDest.reduce((a,n)=>a+(n.valor_rs||0),0);
            if(!valUS) return `<td style="text-align:right;font-size:11px;">—</td>`;
            return `<td style="text-align:right;font-size:11px;"><div>US$ ${fmtN2(valUS)}</div><div style="color:var(--text3);">R$ ${fmtN2(valRS)}</div></td>`;
          }).join('');
          const pValor = nfsPontasDest.reduce((a,n)=>a+(n.valor_us||0),0);
          const pValorRS = nfsPontasDest.reduce((a,n)=>a+(n.valor_rs||0),0);
          const pSqmt = nfsPontasDest.reduce((a,n)=>a+(n.sqmt||0),0);
          const pCotacoes = nfsPontasDest.map(n=>n.cotacao).filter(c=>c>0);
          const pCotacaoMedia = pCotacoes.length ? pCotacoes.reduce((a,b)=>a+b,0)/pCotacoes.length : 0;
          const pPrecoMedioUS = pSqmt ? (pValor/pSqmt) : 0;
          const pPrecoMedioRS = pSqmt ? (pValorRS/pSqmt) : 0;
          const pPercTotal = totalSqmt ? (pSqmt/totalSqmt*100) : 0;
          linhaPontas = `<tr style="background:var(--warn-soft);">
            <td style="font-size:11px;color:var(--warn);padding-left:16px;">Pontas</td>${cellsPontas}
            <td style="text-align:right;font-size:11px;color:var(--warn);"><div>US$ ${fmtN2(pValor)}</div><div style="color:var(--text3);">R$ ${fmtN2(pValorRS)}</div></td>
            <td style="text-align:right;font-size:11px;">${fmtN2(pSqmt)}</td>
            <td style="text-align:right;font-size:11px;">${pPrecoMedioUS?'US$ '+fmtN2(pPrecoMedioUS):'—'}<br><span style="color:var(--text3);">${pPrecoMedioRS?'R$ '+fmtN2(pPrecoMedioRS):'—'}</span></td>
            <td style="text-align:right;font-size:11px;">${fmtN2(pPercTotal)}%</td>
          </tr>`;
        }
        return linhaPrincipal + linhaPontas;
      }).join('');
      const totalRow = mesesOrdenados.map(m=>{
        const nfsPontasMes = nfsPontas.filter(n=>{ const d=_parseBR(n.data_faturamento); return d && _mesLabel(d.getFullYear(),d.getMonth())===m.label; });
        const t=m.nfs.reduce((a,n)=>a+(n.valor_us||0),0) + nfsPontasMes.reduce((a,n)=>a+(n.valor_us||0),0);
        const tRS=m.nfs.reduce((a,n)=>a+(n.valor_rs||0),0) + nfsPontasMes.reduce((a,n)=>a+(n.valor_rs||0),0);
        return `<td style="text-align:right;font-weight:700;color:var(--accent2);font-size:12px;"><div>US$ ${fmtN2(t)}</div><div style="color:var(--text3);font-weight:400;">R$ ${fmtN2(tRS)}</div></td>`;
      }).join('');
      // Preço médio do Total Geral = mesmo critério do KPI (sem Pontas/Classe B, que têm linha própria)
      const precoMedioUSGeral = precoMedioUSD;
      const precoMedioRSGeral = precoMedioRS;
      fatTotalEl.innerHTML = `<div style="overflow-x:auto;"><table class="pedidos-det-table" style="min-width:700px;">
        <thead><tr><th>País Destino</th>${mesesOrdenados.map(m=>`<th style="text-align:right;">${m.label}</th>`).join('')}<th style="text-align:right;">Total</th><th style="text-align:right;">Qtd</th><th style="text-align:right;">Preço Médio US$/R$</th><th style="text-align:right;">% do Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:2px solid var(--border);">
          <td style="font-weight:700;">Total Geral</td>${totalRow}
          <td style="text-align:right;font-weight:700;color:var(--accent);"><div>US$ ${fmtN2(totalValor)}</div><div style="color:var(--text3);font-weight:400;">R$ ${fmtN2(totalValorRS)}</div></td>
          <td style="text-align:right;font-weight:700;">${fmtN2(totalSqmt)}</td>
          <td style="text-align:right;font-weight:700;">${precoMedioUSGeral?'US$ '+fmtN2(precoMedioUSGeral):'—'}<br><span style="color:var(--text3);font-weight:400;">${precoMedioRSGeral?'R$ '+fmtN2(precoMedioRSGeral):'—'}</span></td>
          <td style="text-align:right;font-weight:700;">100%</td>
        </tr></tfoot>
      </table></div>`;
    } else {
      fatTotalEl.innerHTML = '<p style="color:var(--text3);">Dados insuficientes para a matriz.</p>';
    }
  }

  // ── PAGAMENTOS RECEBIDOS NO PERÍODO ──
  // (com base na data de pagamento da própria aba CONTROLE, não nas NFs — exclui amostras)
  const iniPagD = ini ? new Date(ini+'T00:00:00') : null;
  const fimPagD = fim ? new Date(fim+'T23:59:59') : null;
  const pagamentosRecebidos = (CONTROLE||[]).filter(r=>{
    if((r.transporte||'').toLowerCase()==='amostra') return false;
    if(!r.data_pagamento) return false;
    const dp = _parseBR(r.data_pagamento);
    if(!dp) return false;
    if(iniPagD && dp<iniPagD) return false;
    if(fimPagD && dp>fimPagD) return false;
    return true;
  }).sort((a,b)=>(_parseBR(a.data_pagamento)||0)-(_parseBR(b.data_pagamento)||0));

  // Comissão por proforma — soma todas as NFs daquela proforma (sem filtro de período,
  // já que o pagamento pode ocorrer em mês diferente do faturamento da NF).
  const comissaoPorProformaPagos = {};
  (nfsCompletas||[]).forEach(nf=>{
    const pf = nf.numero_proforma;
    if(!comissaoPorProformaPagos[pf]) comissaoPorProformaPagos[pf] = {comUS:0, comRS:0, valorRS:0, percentuais:new Set(), manual:false, datasFat:new Set()};
    comissaoPorProformaPagos[pf].comUS += (nf.comissao_valor||0);
    comissaoPorProformaPagos[pf].comRS += (nf.comissao_valor_rs||0);
    comissaoPorProformaPagos[pf].valorRS += (nf.valor_rs||0);
    if(nf.comissao_pct_raw!==null && nf.comissao_pct_raw!==undefined) comissaoPorProformaPagos[pf].percentuais.add(nf.comissao_pct_raw);
    if(nf.manual) comissaoPorProformaPagos[pf].manual = true;
    if(nf.data_faturamento) comissaoPorProformaPagos[pf].datasFat.add(nf.data_faturamento);
  });

  document.getElementById('ctrlPagosBadge').textContent = pagamentosRecebidos.length+' pagamento(s)';
  const totalPagamentos = pagamentosRecebidos.reduce((a,r)=>a+(r.valor||0),0);
  const totalPagamentosRS = pagamentosRecebidos.reduce((a,r)=>{
    const c = comissaoPorProformaPagos[r.numero_proforma];
    return a + (c ? c.valorRS : 0);
  },0);
  const totalComissaoPagos = pagamentosRecebidos.reduce((a,r)=>{
    const c = comissaoPorProformaPagos[r.numero_proforma];
    return a + (c ? c.comUS : 0);
  },0);
  const totalComissaoPagosRS = pagamentosRecebidos.reduce((a,r)=>{
    const c = comissaoPorProformaPagos[r.numero_proforma];
    return a + (c ? c.comRS : 0);
  },0);
  document.getElementById('relCtrlPagos').innerHTML = pagamentosRecebidos.length
    ? pagamentosRecebidos.map(r=>{
        const c = comissaoPorProformaPagos[r.numero_proforma];
        const percTxt = c && c.percentuais.size ? Array.from(c.percentuais).sort((a,b)=>a-b).map(p=>fmtN2(p)+'%').join(' / ') : '-,-';
        const comUS = c ? c.comUS : 0;
        const comRS = c ? c.comRS : 0;
        const dataFatTxt = c && c.datasFat.size ? Array.from(c.datasFat).join(' / ') : '—';
        const iconManual = c && c.manual ? ' <span class="chip" title="Comissão manual (sem NF lançada): valores em R$ estimados pela cotação média">Manual</span>' : '';
        const dataPgtoComissaoCell = r.data_pagamento_comissao
          ? `<span style="color:var(--success);">${esc(r.data_pagamento_comissao)}</span>`
          : `<span style="color:var(--text3);">pendente</span>`;
        return `<tr>
        <td style="font-size:12px;">${esc(r.cliente_nome)||'—'}</td>
        <td style="font-size:12px;">${esc(r.numero_proforma)}${iconManual}</td>
        <td style="font-size:12px;color:var(--text3);">${esc(dataFatTxt)}</td>
        <td style="font-size:12px;color:var(--success);">${esc(r.data_pagamento)}</td>
        <td style="text-align:right;font-size:12px;color:var(--accent);font-weight:700;">US$ ${fmtN2(r.valor)}</td>
        <td style="text-align:right;font-size:12px;">${percTxt}</td>
        <td style="text-align:right;font-size:12px;color:var(--success);font-weight:700;">US$ ${fmtN2(comUS)}<br><span style="color:var(--text3);font-weight:400;">R$ ${fmtN2(comRS)}</span></td>
        <td style="font-size:12px;">${dataPgtoComissaoCell}</td>
      </tr>`;}).join('') + `<tr style="border-top:2px solid var(--border);">
        <td colspan="4" style="font-weight:700;font-size:12px;">Total Recebido</td>
        <td style="text-align:right;font-weight:700;color:var(--accent);font-size:12px;">US$ ${fmtN2(totalPagamentos)}<br><span style="color:var(--text3);font-weight:400;">R$ ${fmtN2(totalPagamentosRS)}</span></td>
        <td></td>
        <td style="text-align:right;font-weight:700;color:var(--success);font-size:12px;">US$ ${fmtN2(totalComissaoPagos)}<br><span style="color:var(--text3);font-weight:400;">R$ ${fmtN2(totalComissaoPagosRS)}</span></td>
        <td></td>
      </tr>`
    : '<tr><td colspan="8" style="text-align:center;color:var(--text3);">Nenhum pagamento recebido no período</td></tr>';

  // ── FATURAS VENCIDAS ──
  // (referência = data final do período selecionado no relatório, não "hoje")
  const hojeVenc = fimPagD ? new Date(fimPagD) : new Date(); hojeVenc.setHours(0,0,0,0);
  const faturasVencidas = (CONTROLE||[]).filter(r=>{
    if((r.transporte||'').toLowerCase()==='amostra') return false;
    if(r.data_pagamento) return false;
    const dprev = _parseBR(r.data_prev_pagamento);
    return dprev && dprev<=hojeVenc;
  }).map(r=>{
    const dprev = _parseBR(r.data_prev_pagamento);
    return { ...r, diasVencido: Math.round((hojeVenc-dprev)/86400000) };
  }).sort((a,b)=>b.diasVencido-a.diasVencido);
  document.getElementById('ctrlVencidasBadge').textContent = faturasVencidas.length+' fatura(s) vencida(s)';
  const totalVencido = faturasVencidas.reduce((a,r)=>a+(r.valor||0),0);
  document.getElementById('relCtrlVencidas').innerHTML = faturasVencidas.length
    ? faturasVencidas.map(r=>`<tr>
        <td style="font-size:12px;">${esc(r.cliente_nome)||'—'}</td>
        <td style="font-size:12px;">${esc(r.numero_proforma)}</td>
        <td style="font-size:12px;color:var(--text3);">${esc(r.data_prev_pagamento)}</td>
        <td style="text-align:right;font-size:12px;color:var(--danger);font-weight:700;">${r.diasVencido} dia${r.diasVencido!==1?'s':''}</td>
        <td style="text-align:right;font-size:12px;color:var(--danger);font-weight:700;">US$ ${fmtN2(r.valor)}</td>
      </tr>`).join('') + `<tr style="border-top:2px solid var(--border);">
        <td colspan="4" style="font-weight:700;font-size:12px;">Total Vencido</td>
        <td style="text-align:right;font-weight:700;color:var(--danger);font-size:12px;">US$ ${fmtN2(totalVencido)}</td>
      </tr>`
    : '<tr><td colspan="5" style="text-align:center;color:var(--text3);">Nenhuma fatura vencida</td></tr>';

  // ── TOP CLIENTES ──
  const porCli = {};
  nfsNoPeriodo.forEach(n=>{
    const reg = buscaReg(n.numero_proforma);
    const k = reg.cliente_nome||'Não informado';
    if(!porCli[k]) porCli[k]={nome:k,valor:0,valorRS:0,qtd:0,comissao:0,comissaoRS:0,sqmt:0};
    porCli[k].valor+=(n.valor_us||0); porCli[k].valorRS+=(n.valor_rs||0); porCli[k].qtd++;
    porCli[k].comissao+=(n.comissao_valor||0); porCli[k].comissaoRS+=(n.comissao_valor_rs||0); porCli[k].sqmt+=(n.sqmt||0);
  });
  const topCli = Object.values(porCli).sort((a,b)=>b.valor-a.valor).slice(0,15);
  const maxCli = topCli[0]?.valor||1;
  document.getElementById('ctrlRankClientes').innerHTML = topCli.map((c,i)=>{
    const precoMedioUSCli = c.sqmt ? (c.valor/c.sqmt) : 0;
    const precoMedioRSCli = c.sqmt ? (c.valorRS/c.sqmt) : 0;
    return `<tr>
    <td class="rank-pos ${i<3?'top':''}" style="padding:10px 12px;">${i+1}</td>
    <td style="padding:10px 4px;">
      <div class="rank-name">${esc(c.nome)}</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;font-size:12px;color:var(--text);">
        <div>NFs: <strong>${c.qtd}</strong></div>
        <div>Comissão: <strong>US$ ${fmtN2(c.comissao)}</strong> (R$ ${fmtN2(c.comissaoRS)})</div>
        <div>Qtd: <strong>${fmtN2(c.sqmt)}</strong></div>
        <div>Preço médio: <strong>${precoMedioUSCli?'US$ '+fmtN2(precoMedioUSCli):'—'}</strong> / <strong>${precoMedioRSCli?'R$ '+fmtN2(precoMedioRSCli):'—'}</strong></div>
      </div>
      <div style="margin-top:6px;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;">
        <div style="height:100%;background:var(--accent);border-radius:2px;width:${Math.round(c.valor/maxCli*100)}%"></div>
      </div>
    </td>
    <td class="rank-val" style="padding:10px 12px;">US$ ${fmtN2(c.valor)}<br><span style="color:var(--text3);">R$ ${fmtN2(c.valorRS)}</span></td>
  </tr>`;
  }).join('');

  // ── 📌 PONTAS DE ESTOQUE (mesma estrutura agrupada por mês do Faturado por Mês) ──
  const pontasEl = document.getElementById('relCtrlPontas');
  let mesesPontas = [];
  if(pontasEl){
    if(!nfsPontas.length){
      pontasEl.innerHTML = '<p style="color:var(--text3);font-size:12px;">Nenhuma Ponta de Produção / Classe B faturada no período.</p>';
    } else {
      mesesPontas = agruparPorMes(nfsPontas);
      pontasEl.innerHTML = renderBlocoMeses(mesesPontas) || '<p style="color:var(--text3);">Nenhuma NF no período.</p>';
    }
  }

  // ── Captura uma versão "achatada" dos dados, para exportação em PDF/XLSX ──
  function flatten(mesesLista){
    const out = [];
    mesesLista.forEach(m=>{
      const porProforma = {};
      m.nfs.forEach(n=>{ (porProforma[n.numero_proforma]=porProforma[n.numero_proforma]||[]).push(n); });
      Object.keys(porProforma).sort(_compararProforma).forEach(proforma=>{
        const nfs = porProforma[proforma];
        const reg = buscaReg(proforma);
        nfs.forEach(n=>out.push({
          mes:m.label, proforma, cliente:reg.cliente_nome||'—', nf:n.numero_nf||'—',
          valorUS:n.valor_us||0, valorRS:n.valor_rs||0,
          comPct:n.comissao_pct_raw, comUS:n.comissao_valor||0, comRS:n.comissao_valor_rs||0,
          qtd:n.sqmt||0
        }));
      });
    });
    return out;
  }

  window._ultimoRelControleExport = {
    periodo: { ini: ini?fmtBR(ini):'—', fim: fim?fmtBR(fim):'—' },
    secoesVisiveis: Object.assign({}, ...REL_CTRL_SECOES.map(s=>({[s.id]: _relCtrlSecoesState[s.id]!==false}))),
    kpis: {
      valorUS: totalValor, valorRS: totalValorRS, comissaoUS: totalCom, comissaoRS: totalComRS,
      qtd: totalSqmt, registros: proformasUnicas.size,
      cotacaoMedia: cotacaoMediaGeral, precoMedioUS: precoMedioUSD, precoMedioRS: precoMedioRS,
      precoMedioPontaUS: precoMedioPontaUSD, precoMedioPontaRS: precoMedioPontaRS,
    },
    faturadoPorMes: flatten(mesesOrdenados),
    pontas: flatten(mesesPontas),
    comissaoPorPais: destComPais.map(d=>{
      const dp = destPontasOrdenados.find(x=>x.dest===d.dest);
      return {
        pais:d.dest, valorUS:d.valor, valorRS:d.valorRS, comUS:d.comissao, comRS:d.comissaoRS,
        percentuais: d.percentuaisOrdenados.map(p=>fmtN2(p)+'%').join(' / ')||'-,-',
        // 04/11/2026: Pontas/Classe B do país (linha 📌 abaixo do país, igual à tela)
        pontas: dp ? { valorUS:dp.valor, valorRS:dp.valorRS, comUS:dp.comissao, comRS:dp.comissaoRS,
          percentuais: dp.percentuaisOrdenados.map(p=>fmtN2(p)+'%').join(' / ')||'-,-' } : null
      };
    }),
    comissaoPorPaisTotal: { valorUS: totalValor, valorRS: totalValorRS, comUS: totalCom, comRS: totalComRS },
    matrizMesPais: {
      meses: mesesOrdenados.map(m=>m.label),
      linhas: destOrdenados.map(d=>{
        const porMes = mesesOrdenados.map(m=>{
          const nfsDest = m.nfs.filter(n=>(buscaReg(n.numero_proforma).pais_destino||'Não informado').trim()===d.dest);
          return { us: nfsDest.reduce((a,n)=>a+(n.valor_us||0),0), rs: nfsDest.reduce((a,n)=>a+(n.valor_rs||0),0) };
        });
        return {
          pais:d.dest, porMes, totalUS:d.valor, totalRS:d.valorRS, qtd:d.sqmt,
          percTotal: totalSqmt?(d.sqmt/totalSqmt*100):0,
          precoMedioUS: d.sqmt?(d.valor/d.sqmt):0,
          precoMedioRS: d.sqmt?(d.valorRS/d.sqmt):0,
          // 📌 Pontas/Classe B desse país (linha extra no PDF/XLSX, igual à tela)
          pontas: (()=>{
            const nfsP = nfsPontas.filter(n=>(buscaReg(n.numero_proforma).pais_destino||'Não informado').trim()===d.dest);
            if(!nfsP.length) return null;
            const pUS = nfsP.reduce((a,n)=>a+(n.valor_us||0),0), pRS = nfsP.reduce((a,n)=>a+(n.valor_rs||0),0), pQ = nfsP.reduce((a,n)=>a+(n.sqmt||0),0);
            const porMesP = mesesOrdenados.map(m=>{
              const nm = nfsP.filter(n=>{ const dt=_parseBR(n.data_faturamento); return dt && _mesLabel(dt.getFullYear(),dt.getMonth())===m.label; });
              return { us: nm.reduce((a,n)=>a+(n.valor_us||0),0), rs: nm.reduce((a,n)=>a+(n.valor_rs||0),0) };
            });
            return { porMes: porMesP, totalUS:pUS, totalRS:pRS, qtd:pQ, percTotal: totalSqmt?(pQ/totalSqmt*100):0,
              precoMedioUS: pQ?pUS/pQ:0, precoMedioRS: pQ?pRS/pQ:0 };
          })(),
        };
      }),
      totalGeral: { valorUS: totalValor, valorRS: totalValorRS, qtd: totalSqmt, precoMedioUS: precoMedioUSD, precoMedioRS: precoMedioRS,
        porMes: mesesOrdenados.map(m=>{
          const nm = nfsTodas.filter(n=>{ const dt=_parseBR(n.data_faturamento); return dt && _mesLabel(dt.getFullYear(),dt.getMonth())===m.label; });
          return { us: nm.reduce((a,n)=>a+(n.valor_us||0),0), rs: nm.reduce((a,n)=>a+(n.valor_rs||0),0) };
        }) }
    },
    topClientes: topCli.map(c=>({ nome:c.nome, qtd:c.qtd, valorUS:c.valor, valorRS:c.valorRS, comUS:c.comissao, comRS:c.comissaoRS })),
    pagamentosRecebidos: pagamentosRecebidos.map(r=>{
      const c = comissaoPorProformaPagos[r.numero_proforma];
      const percTxt = c && c.percentuais.size ? Array.from(c.percentuais).sort((a,b)=>a-b).map(p=>fmtN2(p)+'%').join(' / ') : '-,-';
      return { cliente:r.cliente_nome, proforma:r.numero_proforma, dataFaturamento:(c && c.datasFat.size ? Array.from(c.datasFat).join(' / ') : ''), dataPagamento:r.data_pagamento, valorUS:r.valor, valorRS:c?c.valorRS:0, comissaoPct:percTxt, comissaoUS:c?c.comUS:0, comissaoRS:c?c.comRS:0, dataPagamentoComissao:r.data_pagamento_comissao||'' };
    }),
    faturasVencidas: faturasVencidas.map(r=>({ cliente:r.cliente_nome, proforma:r.numero_proforma, dataPrev:r.data_prev_pagamento, diasVencido:r.diasVencido, valorUS:r.valor })),
  };
}

function exportarPdfControle(){
  const dados = window._ultimoRelControleExport;
  if(!dados){ showToast('Gere o relatório antes de exportar','error'); return; }
  // 03/11/2026: lê a seleção de campos no momento da exportação (antes valia a seleção
  // de quando o relatório foi gerado, e um campo desmarcado depois ainda saía no PDF)
  dados.secoesVisiveis = Object.assign({}, ...REL_CTRL_SECOES.map(s=>({[s.id]: _relCtrlSecoesState[s.id]!==false})));
  const btn = document.getElementById('btnExportPdfCtrl');
  if(btn){ btn.disabled=true; }
  showToast('Gerando PDF do relatório...','');
  google.script.run.withSuccessHandler(r=>{
    if(btn) btn.disabled=false;
    const d = JSON.parse(r);
    if(d.success){ showToast('PDF salvo!','success'); window.open(d.url,'_blank'); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>{ if(btn) btn.disabled=false; showToast('Erro: '+e.message,'error'); })
  .gerarPdfRelatorioControleV2(JSON.stringify(dados));
}

function exportarXlsxRelatorioControle(){
  const dados = window._ultimoRelControleExport;
  if(!dados){ showToast('Gere o relatório antes de exportar','error'); return; }
  // 03/11/2026: mesma regra do PDF — usa a seleção de campos do momento da exportação
  dados.secoesVisiveis = Object.assign({}, ...REL_CTRL_SECOES.map(s=>({[s.id]: _relCtrlSecoesState[s.id]!==false})));
  const btn = document.getElementById('btnExportXlsxCtrl');
  if(btn){ btn.disabled=true; }
  showToast('Gerando XLSX do relatório...','');
  google.script.run.withSuccessHandler(r=>{
    if(btn) btn.disabled=false;
    const d = JSON.parse(r);
    if(d.success){ showToast('XLSX salvo!','success'); window.open(d.url,'_blank'); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>{ if(btn) btn.disabled=false; showToast('Erro: '+e.message,'error'); })
  .gerarXlsxRelatorioControle(JSON.stringify(dados));
}
