// ============================================================
// ABA RELATÓRIOS > METAS: metas por país, realizado (das NFs ou
// editado à mão), comparativo com outro ano, gráficos e exportação
// ============================================================
let METAS_PAISES = [];
let METAS_DATA = {};          // {pais:{mes:{valor,qtd}}} + GLOBAL
let METAS_REALIZADO_CALC = { porPais:{}, global:{} };      // ano selecionado, calculado das NFs: {pais:{mes:{valorRS,valorUS,sqmt}}}
let METAS_REALIZADO_CALC_COMP = { porPais:{}, global:{} }; // ano de comparação
let METAS_REALIZADO_MANUAL = {};      // overrides manuais (ano selecionado): {pais:{mes:valor}}
let METAS_REALIZADO_MANUAL_COMP = {}; // overrides manuais (ano de comparação)
let METAS_REALIZADO_MANUAL_QTD = {};      // overrides manuais de m² (ano selecionado): {pais:{mes:qtd}}
let METAS_REALIZADO_MANUAL_QTD_COMP = {}; // overrides manuais de m² (ano de comparação)
let METAS_ANOS_DISPONIVEIS = [];      // anos que têm NFs válidas (para o seletor "Comparar com")
// Período APLICADO (o que está na tela). Os seletores só valem depois do botão Aplicar.
let METAS_ANO = null, METAS_MES = null, METAS_ANO_COMP = null;
let _metasReqId = 0;
const MESES_LABEL = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABREV = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Quais gráficos exibem o ano de comparação (salvo no navegador)
const METAS_COMP_CHARTS_KEY = 'adexport_metas_comp_charts_v1';
let METAS_COMP_CHARTS = (function(){ try{ return JSON.parse(localStorage.getItem(METAS_COMP_CHARTS_KEY))||{}; }catch(e){ return {}; } })();
function _salvarCompCharts(){ try{ localStorage.setItem(METAS_COMP_CHARTS_KEY, JSON.stringify(METAS_COMP_CHARTS)); }catch(e){} }

function initMetas(){
  const now = new Date();
  const elAno = document.getElementById('metasAno');
  if(!elAno.value) elAno.value = now.getFullYear();
  if(METAS_ANO===null){
    // Primeira abertura: mês atual, comparando com o ano anterior
    document.getElementById('metasMes').value = now.getMonth()+1;
    const ano = parseInt(elAno.value)||now.getFullYear();
    _metasPopularAnosComp(ano, ano-1);
    METAS_ANO = ano;
    METAS_MES = now.getMonth()+1;
    METAS_ANO_COMP = ano-1;
  }
  _metasAtualizarPendente();
  carregarMetasPaises();
}

// Monta o seletor "Comparar com": anos com dados + ano anterior ao selecionado (nunca o próprio ano)
function _metasPopularAnosComp(anoSel, valorDesejado){
  const sel = document.getElementById('metasAnoComp'); if(!sel) return;
  const atual = valorDesejado!==undefined ? valorDesejado : parseInt(sel.value);
  const anos = new Set((METAS_ANOS_DISPONIVEIS||[]).map(Number));
  if(anoSel) anos.add(anoSel-1);
  if(atual) anos.add(atual);
  if(METAS_ANO_COMP) anos.add(METAS_ANO_COMP);
  anos.delete(anoSel);
  const lista = Array.from(anos).filter(a=>a>1999&&a<2101).sort((a,b)=>b-a);
  sel.innerHTML = lista.map(a=>`<option value="${a}">${a}</option>`).join('');
  if(atual && lista.includes(atual)) sel.value = atual;
  else if(anoSel && lista.includes(anoSel-1)) sel.value = anoSel-1;
}

function onMetasAnoInput(){
  const ano = parseInt(document.getElementById('metasAno').value);
  if(ano && ano>1999 && ano<2101) _metasPopularAnosComp(ano, ano-1);
  _metasAtualizarPendente();
}

function _metasSelecao(){
  return {
    ano: parseInt(document.getElementById('metasAno').value)||0,
    mes: parseInt(document.getElementById('metasMes').value)||1,
    comp: parseInt(document.getElementById('metasAnoComp').value)||0,
  };
}
function _metasPendente(){
  const s = _metasSelecao();
  return s.ano!==METAS_ANO || s.mes!==METAS_MES || s.comp!==METAS_ANO_COMP;
}
function _metasAtualizarPendente(){
  const msg = document.getElementById('metasPendenteMsg');
  const btn = document.getElementById('btnAplicarMetas');
  const pend = METAS_ANO!==null && _metasPendente();
  if(msg) msg.textContent = pend ? 'Seleção alterada. Clique em Aplicar para atualizar a tela.' : '';
  if(btn) btn.style.boxShadow = pend ? '0 0 0 2px var(--warn)' : '';
}

function aplicarMetasPeriodo(){
  const s = _metasSelecao();
  if(!s.ano || s.ano<2000 || s.ano>2100){ showToast('Ano inválido','error'); return; }
  if(!s.comp) s.comp = s.ano-1;
  if(s.comp===s.ano){ showToast('Escolha um ano de comparação diferente do ano selecionado','warn'); return; }
  const recarregar = s.ano!==METAS_ANO || s.comp!==METAS_ANO_COMP;
  METAS_ANO = s.ano; METAS_MES = s.mes; METAS_ANO_COMP = s.comp;
  _metasAtualizarPendente();
  if(recarregar) carregarMetasEDados();
  else { renderMetasInputs(); renderMetasResultado(); }
}

function carregarMetasPaises(){
  google.script.run.withSuccessHandler(r=>{
    const d=JSON.parse(r);
    METAS_PAISES = d.success ? d.data : [];
    carregarMetasEDados();
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).getMetasPaises();
}

// Modal "Adicionar País" (substitui o prompt() nativo do navegador)
function abrirAddPaisMeta(){
  document.getElementById('addPaisMetaInput').value='';
  document.getElementById('modalAddPaisMeta').classList.remove('hidden');
  setTimeout(()=>document.getElementById('addPaisMetaInput').focus(),50);
}
function confirmarAddPaisMeta(){
  const nome = document.getElementById('addPaisMetaInput').value.trim();
  if(!nome){ showToast('Digite o nome do país','warn'); return; }
  if(METAS_PAISES.includes(nome)){ showToast('País já existe na lista','warn'); return; }
  METAS_PAISES.push(nome);
  document.getElementById('modalAddPaisMeta').classList.add('hidden');
  google.script.run.withSuccessHandler(()=>{ carregarMetasEDados(); }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarMetasPaises(JSON.stringify(METAS_PAISES));
}
function removerPaisMeta(nome){
  if(!confirm('Remover "'+nome+'" da lista de metas? (as metas já lançadas não são apagadas)')) return;
  METAS_PAISES = METAS_PAISES.filter(p=>p!==nome);
  google.script.run.withSuccessHandler(()=>{ carregarMetasEDados(); }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarMetasPaises(JSON.stringify(METAS_PAISES));
}

// Diagnóstico: mostra os nomes de País Destino usados no Controle, para conferir
// se batem com os países cadastrados nas Metas (o casamento é por nome, tolerante a acento/maiúscula).
function verPaisesControle(){
  google.script.run.withSuccessHandler(r=>{
    const d=JSON.parse(r);
    if(!d.success){ showToast('Erro: '+d.error,'error'); return; }
    if(!d.data.length){ alert('Nenhum País Destino preenchido ainda no Controle.'); return; }
    alert('Países usados no campo "País Destino" do Controle:\n\n'+d.data.join('\n'));
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).getPaisesDestinoControle();
}

// Carrega tudo do período aplicado numa única chamada ao servidor:
// metas do ano, realizado do ano e do ano de comparação, overrides manuais dos dois anos.
function carregarMetasEDados(){
  const ano = METAS_ANO || new Date().getFullYear();
  const comp = METAS_ANO_COMP || (ano-1);
  const reqId = ++_metasReqId;
  const btn = document.getElementById('btnAplicarMetas');
  if(btn){ btn.disabled = true; btn.textContent = 'Carregando...'; }
  const fim = ()=>{ if(btn && reqId===_metasReqId){ btn.disabled = false; btn.textContent = 'Aplicar'; } };
  google.script.run.withSuccessHandler(r=>{
    if(reqId!==_metasReqId) return; // resposta antiga (usuário aplicou outro período depois)
    fim();
    const d=JSON.parse(r);
    if(!d.success){ showToast('Erro: '+d.error,'error'); return; }
    METAS_DATA = d.metas || {};
    METAS_REALIZADO_CALC = d.realizado || {porPais:{},global:{}};
    METAS_REALIZADO_CALC_COMP = d.realizadoComp || {porPais:{},global:{}};
    METAS_REALIZADO_MANUAL = d.manual || {};
    METAS_REALIZADO_MANUAL_COMP = d.manualComp || {};
    METAS_REALIZADO_MANUAL_QTD = d.manualQtd || {};
    METAS_REALIZADO_MANUAL_QTD_COMP = d.manualQtdComp || {};
    METAS_ANOS_DISPONIVEIS = d.anosDisponiveis || [];
    _metasPopularAnosComp(parseInt(document.getElementById('metasAno').value)||ano);
    _metasAtualizarPendente();
    renderMetasInputs();
    renderMetasResultado();
  }).withFailureHandler(e=>{ if(reqId!==_metasReqId) return; fim(); showToast('Erro: '+e.message,'error'); })
  .getDadosMetasCompletos(ano, comp, JSON.stringify(METAS_PAISES));
}

// ── Helpers de leitura ──
function _calcDado(calc, pais, mes){
  const src = pais==='GLOBAL' ? (calc && calc.global) : (calc && calc.porPais && calc.porPais[pais]);
  return (src && src[mes]) || {valorRS:0, valorUS:0, sqmt:0, valorRSPonta:0, valorUSPonta:0, sqmtPonta:0};
}
// 03/11/2026: separa o dado de um país/mês em vendas normais e Pontas de Produção / Classe B.
// O Preço Médio "normal" exclui Pontas/Classe B; elas têm preço médio próprio.
function _dadoNormal(d){
  d = d || {};
  return { valorRS:(d.valorRS||0)-(d.valorRSPonta||0), valorUS:(d.valorUS||0)-(d.valorUSPonta||0), sqmt:(d.sqmt||0)-(d.sqmtPonta||0) };
}
function _dadoPonta(d){
  d = d || {};
  return { valorRS:d.valorRSPonta||0, valorUS:d.valorUSPonta||0, sqmt:d.sqmtPonta||0 };
}
function _preco(d){ return { rs: d.sqmt ? d.valorRS/d.sqmt : 0, us: d.sqmt ? d.valorUS/d.sqmt : 0 }; }
// País tem alguma Ponta/Classe B no ano (para decidir se mostra a sub-linha)
function _temPontaNoAno(calc, pais){ for(let m=1;m<=12;m++){ if(_calcDado(calc,pais,m).sqmtPonta) return true; } return false; }
// Realizado "efetivo" de um país/mês: override manual se existir, senão o calculado das NFs.
function _realizadoEfetivo(pais, mes){
  if(METAS_REALIZADO_MANUAL[pais] && METAS_REALIZADO_MANUAL[pais][mes]!==undefined) return METAS_REALIZADO_MANUAL[pais][mes];
  return _calcDado(METAS_REALIZADO_CALC, pais, mes).valorRS;
}
function _realizadoEfetivoComp(pais, mes){
  if(METAS_REALIZADO_MANUAL_COMP[pais] && METAS_REALIZADO_MANUAL_COMP[pais][mes]!==undefined) return METAS_REALIZADO_MANUAL_COMP[pais][mes];
  return _calcDado(METAS_REALIZADO_CALC_COMP, pais, mes).valorRS;
}
// Realizado em m²: override manual se existir, senão o calculado das NFs.
function _realizadoQtdEfetivo(pais, mes){
  if(METAS_REALIZADO_MANUAL_QTD[pais] && METAS_REALIZADO_MANUAL_QTD[pais][mes]!==undefined) return METAS_REALIZADO_MANUAL_QTD[pais][mes];
  return _calcDado(METAS_REALIZADO_CALC, pais, mes).sqmt;
}
function _realizadoQtdEfetivoComp(pais, mes){
  if(METAS_REALIZADO_MANUAL_QTD_COMP[pais] && METAS_REALIZADO_MANUAL_QTD_COMP[pais][mes]!==undefined) return METAS_REALIZADO_MANUAL_QTD_COMP[pais][mes];
  return _calcDado(METAS_REALIZADO_CALC_COMP, pais, mes).sqmt;
}
function _temOverrideManualQtd(pais, mes){
  return !!(METAS_REALIZADO_MANUAL_QTD[pais] && METAS_REALIZADO_MANUAL_QTD[pais][mes]!==undefined);
}
function _temOverrideManual(pais, mes){
  return !!(METAS_REALIZADO_MANUAL[pais] && METAS_REALIZADO_MANUAL[pais][mes]!==undefined);
}
// Valor calculado automaticamente a partir das NFs, ignorando qualquer override manual —
// usado para saber se o que está no campo é só o valor automático (não precisa virar override).
function _realizadoCalculado(pais, mes){
  return _calcDado(METAS_REALIZADO_CALC, pais, mes).valorRS;
}

// Variação percentual atual x anterior. null quando não há base de comparação.
function _varPct(atual, anterior){
  if(!anterior) return null;
  return (atual-anterior)/Math.abs(anterior)*100;
}
// Selo ▲/▼ verde/vermelho com a variação
function _badgeVar(atual, anterior, rotulo){
  if(!atual && !anterior) return `<span class="metas-var metas-var-nd">—</span>`;
  const v = _varPct(atual, anterior);
  if(v===null) return `<span class="metas-var metas-var-nd">sem dados${rotulo?' em '+rotulo:''}</span>`;
  const up = v>=0;
  return `<span class="metas-var ${up?'metas-var-up':'metas-var-dn'}">${up?'▲':'▼'} ${fmtN(Math.abs(v))}%${rotulo?' vs '+rotulo:''}</span>`;
}

function _metasLabelMesAno(mes, ano){ return MESES_LABEL[mes]+'/'+ano; }
function _metasLabelMesAnoCurto(mes, ano){ return MESES_ABREV[mes]+'/'+String(ano).slice(2); }
function _metasLabelAcum(mes, ano){ return mes===1 ? 'Jan/'+ano : 'Jan a '+MESES_ABREV[mes]+'/'+ano; }

// Atualiza todos os rótulos de período da tela (sempre o período APLICADO)
function _metasAtualizarLabels(){
  const mes=METAS_MES||1, ano=METAS_ANO, comp=METAS_ANO_COMP;
  const set=(sel,txt)=>document.querySelectorAll(sel).forEach(el=>el.textContent=txt);
  set('.metasMesAnoLabel', _metasLabelMesAno(mes,ano));
  set('.metasMesAnoCompLabel', _metasLabelMesAno(mes,comp));
  set('.metasAnoLabel', String(ano));
  set('.metasAnoCompLabel', String(comp));
  set('.metasAcumLabel', _metasLabelAcum(mes,ano));
  set('.metasAcumCompLabel', _metasLabelAcum(mes,comp));
  const badge=document.getElementById('metasPeriodoBadge');
  if(badge) badge.textContent=_metasLabelMesAno(mes,ano)+' · comparando com '+_metasLabelMesAno(mes,comp);
  document.querySelectorAll('input[data-chart]').forEach(i=>i.checked=!!METAS_COMP_CHARTS[i.dataset.chart]);
  document.querySelectorAll('select[data-chart-modo]').forEach(sel=>sel.value=_chartModo(sel.dataset.chartModo));
  _initMetasSecoes();
}

// 04/11/2026: seletor de campos do Relatório de Metas (tela, PDF e XLSX), igual ao Controle
const METAS_SECOES = [
  {id:'metasKpisMes', label:'Indicadores do mês'},
  {id:'metasSecAcum', label:'Acumulado do ano'},
  {id:'metasSecComp', label:'Comparativo por país'},
  {id:'metasSecMR', label:'Meta x realizado'},
  {id:'metasSecPreco', label:'Preço médio por país'},
  {id:'metasSecGrafRS', label:'Evolução meta x realizado (R$)'},
  {id:'metasSecAnualRS', label:'Anual · financeiro (R$)'},
  {id:'metasSecGrafPreco', label:'Evolução preço médio'},
  {id:'metasSecAnualPreco', label:'Anual · preço médio'},
  {id:'metasSecGrafQtd', label:'Evolução quantidade (m²)'},
  {id:'metasSecAnualQtd', label:'Anual · quantidade (m²)'},
];
const METAS_SECOES_STORAGE_KEY = 'adexport_metas_secoes_v1';
let _metasSecoesState = (function(){ try{ return JSON.parse(localStorage.getItem(METAS_SECOES_STORAGE_KEY))||{}; }catch(e){ return {}; } })();
function _salvarMetasSecoesStorage(){ try{ localStorage.setItem(METAS_SECOES_STORAGE_KEY, JSON.stringify(_metasSecoesState)); }catch(e){} }
function _metasSecaoVisivel(id){ return _metasSecoesState[id]!==false; }
function _metasSecoesVisiveis(){ return Object.assign({}, ...METAS_SECOES.map(s=>({[s.id]: _metasSecaoVisivel(s.id)}))); }
function _initMetasSecoes(){
  const wrap = document.getElementById('metasSecoesWrap');
  if(!wrap) return;
  if(!wrap.children.length){
    METAS_SECOES.forEach(sec=>{
      if(_metasSecoesState[sec.id]===undefined) _metasSecoesState[sec.id]=true;
      const btn=document.createElement('button');
      btn.className='col-toggle-btn'+(_metasSecoesState[sec.id]?' visible':'');
      btn.textContent=sec.label;
      btn.dataset.id=sec.id;
      btn.onclick=()=>{
        _metasSecoesState[sec.id]=!_metasSecoesState[sec.id];
        btn.classList.toggle('visible',_metasSecoesState[sec.id]);
        _salvarMetasSecoesStorage();
        _aplicarMetasSecoesVisibilidade(true);
      };
      wrap.appendChild(btn);
    });
  }
  _aplicarMetasSecoesVisibilidade(false);
}
function _aplicarMetasSecoesVisibilidade(redesenhar){
  METAS_SECOES.forEach(sec=>{
    const el = document.getElementById(sec.id);
    if(el) el.style.display = _metasSecaoVisivel(sec.id) ? '' : 'none';
  });
  // Gráfico que estava oculto é redesenhado ao reaparecer (a largura depende da tela)
  if(redesenhar && METAS_ANO){ renderMetasChartGlobal(); renderMetasChartQtd(); renderMetasChartPreco(); }
}

// Todos os números de um país (ou GLOBAL) para o mês aplicado, o acumulado do ano e a comparação
function _metasDadosPais(pais){
  const mes = METAS_MES||1;
  const mo = (METAS_DATA[pais] && METAS_DATA[pais][mes]) || {};
  const d  = _calcDado(METAS_REALIZADO_CALC, pais, mes);
  const dc = _calcDado(METAS_REALIZADO_CALC_COMP, pais, mes);
  const realRS = _realizadoEfetivo(pais, mes), realRSComp = _realizadoEfetivoComp(pais, mes);
  const realQtd = _realizadoQtdEfetivo(pais, mes), realQtdComp = _realizadoQtdEfetivoComp(pais, mes);
  let acumRS=0, acumRSComp=0, acumQtd=0, acumQtdComp=0, acumMetaRS=0, acumMetaQtd=0;
  for(let m=1;m<=mes;m++){
    acumRS += _realizadoEfetivo(pais, m);
    acumRSComp += _realizadoEfetivoComp(pais, m);
    acumQtd += _realizadoQtdEfetivo(pais, m);
    acumQtdComp += _realizadoQtdEfetivoComp(pais, m);
    const mm = (METAS_DATA[pais] && METAS_DATA[pais][m]) || {};
    acumMetaRS += mm.valor||0; acumMetaQtd += mm.qtd||0;
  }
  const metaRS = mo.valor||0, metaQtd = mo.qtd||0;
  return {
    pais, metaRS, metaQtd, realRS, realQtd, realUS:d.valorUS, realRSComp, realQtdComp,
    atingRS: metaRS ? realRS/metaRS*100 : null, atingQtd: metaQtd ? realQtd/metaQtd*100 : null,
    varRS: _varPct(realRS, realRSComp), varQtd: _varPct(realQtd, realQtdComp),
    acumRS, acumRSComp, acumQtd, acumQtdComp, acumMetaRS, acumMetaQtd,
    atingAcumRS: acumMetaRS ? acumRS/acumMetaRS*100 : null, atingAcumQtd: acumMetaQtd ? acumQtd/acumMetaQtd*100 : null,
    varAcumRS: _varPct(acumRS, acumRSComp), varAcumQtd: _varPct(acumQtd, acumQtdComp),
    // Preço médio sem Pontas/Classe B + preço médio só das Pontas/Classe B
    qtdNormal: _dadoNormal(d).sqmt, precoUS: _preco(_dadoNormal(d)).us, precoRS: _preco(_dadoNormal(d)).rs,
    qtdPonta: _dadoPonta(d).sqmt, precoPontaUS: _preco(_dadoPonta(d)).us, precoPontaRS: _preco(_dadoPonta(d)).rs,
  };
}

function renderMetasInputs(){
  const mes = METAS_MES||1;
  _metasAtualizarLabels();
  const wrap = document.getElementById('metasInputsWrap');
  const corPct = p => p===null ? 'var(--text3)' : (p>=100 ? 'var(--success)' : 'var(--warn)');
  function linha(pais, isGlobal){
    const mo = (METAS_DATA[pais] && METAS_DATA[pais][mes]) || {};
    const valMeta = mo.valor||'';
    const valMetaQtd = mo.qtd||'';
    const valReal = _realizadoEfetivo(pais, mes) || '';
    const override = _temOverrideManual(pais, mes);
    const overrideQtd = _temOverrideManualQtd(pais, mes);
    const dp = _metasDadosPais(pais);
    const attrPais = pais.replace(/"/g,'&quot;');
    return `<div class="metas-grid-row">
      <div class="metas-pais${isGlobal?' global':''}">${isGlobal?'GLOBAL':esc(pais)}</div>
      <div style="position:relative;">
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text3);">m²</span>
        <input type="text" inputmode="decimal" class="metas-metaqtd-input" data-pais="${attrPais}" value="${valMetaQtd?fmtMilharBR(valMetaQtd):''}" placeholder="0,00" style="padding-right:30px;" onblur="_metasInputBlur(this)" onfocus="this.select()">
      </div>
      <div style="position:relative;">
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--text3);">m²</span>
        <input type="text" inputmode="decimal" class="metas-realqtd-input" data-pais="${attrPais}" data-calc="${_calcDado(METAS_REALIZADO_CALC, pais, mes).sqmt}" data-override="${overrideQtd?1:0}" value="${dp.realQtd?fmtMilharBR(dp.realQtd):''}" placeholder="0,00" style="padding-right:30px;${overrideQtd?'border-color:var(--accent2);':''}" title="${overrideQtd?'Valor editado manualmente':'Valor calculado automaticamente a partir das NFs'}" onblur="_metasInputBlur(this)" onfocus="this.select()">
      </div>
      <div style="position:relative;">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text3);">R$</span>
        <input type="text" inputmode="decimal" class="metas-meta-input" data-pais="${attrPais}" value="${valMeta?fmtMilharBR(valMeta):''}" placeholder="0,00" style="padding-left:32px;" onblur="_metasInputBlur(this)" onfocus="this.select()">
      </div>
      <div style="position:relative;">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text3);">R$</span>
        <input type="text" inputmode="decimal" class="metas-real-input" data-pais="${attrPais}" data-calc="${_realizadoCalculado(pais, mes)}" data-override="${override?1:0}" value="${valReal?fmtMilharBR(valReal):''}" placeholder="0,00" style="padding-left:32px;${override?'border-color:var(--accent2);':''}" title="${override?'Valor editado manualmente':'Valor calculado automaticamente a partir das NFs'}" onblur="_metasInputBlur(this)" onfocus="this.select()">
      </div>
      <div style="font-size:11px;line-height:1.5;">
        <div>m²: <strong style="color:${corPct(dp.atingQtd)};">${dp.atingQtd===null?'—':fmtN(dp.atingQtd)+'%'}</strong></div>
        <div>R$: <strong style="color:${corPct(dp.atingRS)};">${dp.atingRS===null?'—':fmtN(dp.atingRS)+'%'}</strong></div>
      </div>
      ${isGlobal?'<div></div>':`<button class="btn btn-icon btn-danger" onclick="removerPaisMeta('${pais.replace(/'/g,"\\'")}')" title="Remover país" aria-label="Remover país">🗑️</button>`}
    </div>`;
  }
  wrap.innerHTML = linha('GLOBAL', true) + METAS_PAISES.map(p=>linha(p,false)).join('');
}

// Formata número com separador de milhar (ponto) e decimal com vírgula, padrão BR.
function fmtMilharBR(v){
  const n = Number(v);
  if(isNaN(n)) return '';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
// Converte texto no formato BR (1.234,56) de volta para número.
function parseMilharBR(v){
  if(v===undefined||v===null) return 0;
  const s = String(v).trim();
  if(s==='') return 0;
  const limpo = s.replace(/\./g,'').replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}
function _metasInputBlur(el){
  const n = parseMilharBR(el.value);
  el.value = n ? fmtMilharBR(n) : '';
}

function salvarMetasMes(){
  // Salva sempre no período APLICADO (o que está na tela), não no que está só selecionado
  const ano = METAS_ANO || new Date().getFullYear();
  const mes = METAS_MES || 1;
  const metas = {};
  document.querySelectorAll('#metasInputsWrap .metas-meta-input').forEach(inp=>{
    if(!metas[inp.dataset.pais]) metas[inp.dataset.pais] = {valor:0, qtd:0};
    metas[inp.dataset.pais].valor = parseMilharBR(inp.value);
  });
  document.querySelectorAll('#metasInputsWrap .metas-metaqtd-input').forEach(inp=>{
    if(!metas[inp.dataset.pais]) metas[inp.dataset.pais] = {valor:0, qtd:0};
    metas[inp.dataset.pais].qtd = parseMilharBR(inp.value);
  });
  const realizados = {};
  document.querySelectorAll('#metasInputsWrap .metas-real-input').forEach(inp=>{
    const v = inp.value.trim();
    const calc = parseFloat(inp.dataset.calc)||0;
    const tinhaOverride = inp.dataset.override === '1';
    if(v===''){
      // Campo vazio: remove o override, se houver, para voltar a calcular automaticamente.
      if(tinhaOverride) realizados[inp.dataset.pais] = null;
      return;
    }
    const val = parseMilharBR(v);
    if(Math.abs(val-calc) < 0.005){
      // Valor igual ao calculado automaticamente: se havia override, remove; senão não mexe
      // (não cria override à toa, para o campo continuar se atualizando sozinho conforme fatura).
      if(tinhaOverride) realizados[inp.dataset.pais] = null;
    } else {
      // Valor diferente do automático: usuário editou de propósito, salva como override.
      realizados[inp.dataset.pais] = val;
    }
  });
  // Mesma regra para o realizado em m²
  const realizadosQtd = {};
  document.querySelectorAll('#metasInputsWrap .metas-realqtd-input').forEach(inp=>{
    const v = inp.value.trim();
    const calc = parseFloat(inp.dataset.calc)||0;
    const tinhaOverride = inp.dataset.override === '1';
    if(v===''){ if(tinhaOverride) realizadosQtd[inp.dataset.pais] = null; return; }
    const val = parseMilharBR(v);
    if(Math.abs(val-calc) < 0.005){ if(tinhaOverride) realizadosQtd[inp.dataset.pais] = null; }
    else realizadosQtd[inp.dataset.pais] = val;
  });
  google.script.run.withSuccessHandler(r=>{
    const d=JSON.parse(r);
    if(!d.success){ showToast('Erro: '+d.error,'error'); return; }
    google.script.run.withSuccessHandler(r2=>{
      const d2=JSON.parse(r2);
      if(d2.success){
        document.getElementById('metasSalvoMsg').textContent='Salvo em '+_metasLabelMesAno(mes,ano);
        setTimeout(()=>document.getElementById('metasSalvoMsg').textContent='',2500);
        carregarMetasEDados();
      } else showToast('Erro: '+d2.error,'error');
    }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarRealizadoManualLote(JSON.stringify({ano,mes,valores:realizados,valoresQtd:realizadosQtd}));
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarMetasLote(JSON.stringify({ano,mes,metas}));
}

function renderMetasResultado(){
  const mes = METAS_MES||1, ano = METAS_ANO, comp = METAS_ANO_COMP;
  const fmt = n => isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtRS = n => 'R$ '+fmt(n);
  const fmtPctOuTraco = p => p===null ? '—' : fmt(p)+'%';
  const fmtSinal = n => (n>=0?'+':'−')+fmt(Math.abs(n));
  _metasAtualizarLabels();
  const rotComp = _metasLabelMesAnoCurto(mes, comp);

  // ── KPIs do mês (Global) ──
  const g = _metasDadosPais('GLOBAL');
  const corAting = p => p===null ? 'var(--text3)' : (p>=100 ? 'var(--success)' : 'var(--warn)');
  document.getElementById('metasKpisMes').innerHTML = `
    <div class="kpi-card" style="--kpi-color:var(--accent2)">
      <div class="kpi-label">Realizado R$ · ${_metasLabelMesAno(mes,ano)}</div>
      <div class="kpi-value" style="font-size:22px;">${fmtRS(g.realRS)}</div>
      <div class="kpi-sub">Meta ${g.metaRS?fmtRS(g.metaRS):'—'} · <strong style="color:${corAting(g.atingRS)};">${fmtPctOuTraco(g.atingRS)}</strong></div>
      <div style="margin-top:8px;">${_badgeVar(g.realRS, g.realRSComp, rotComp)}</div>
    </div>
    <div class="kpi-card" style="--kpi-color:var(--accent)">
      <div class="kpi-label">Realizado m² · ${_metasLabelMesAno(mes,ano)}</div>
      <div class="kpi-value" style="font-size:22px;">${fmt(g.realQtd)} m²</div>
      <div class="kpi-sub">Meta ${g.metaQtd?fmt(g.metaQtd)+' m²':'—'} · <strong style="color:${corAting(g.atingQtd)};">${fmtPctOuTraco(g.atingQtd)}</strong></div>
      <div style="margin-top:8px;">${_badgeVar(g.realQtd, g.realQtdComp, rotComp)}</div>
    </div>
    <div class="kpi-card" style="--kpi-color:var(--success)">
      <div class="kpi-label">Realizado US$</div>
      <div class="kpi-value" style="font-size:22px;">US$ ${fmt(g.realUS)}</div>
      <div class="kpi-sub">valor faturado no mês</div>
    </div>
    <div class="kpi-card" style="--kpi-color:${(g.realRS-g.metaRS)>=0?'var(--success)':'var(--danger)'}">
      <div class="kpi-label">Déficit/Superávit</div>
      <div class="kpi-value" style="font-size:20px;">${fmtRS(g.realRS-g.metaRS)}</div>
      <div class="kpi-sub">m²: ${fmtSinal(g.realQtd-g.metaQtd)}</div>
    </div>`;

  // ── Acumulado do ano x mesmo período do ano de comparação ──
  const rotAcumComp = _metasLabelAcum(mes, comp);
  document.getElementById('metasKpisAcum').innerHTML = `
    <div class="kpi-card" style="--kpi-color:var(--accent2)">
      <div class="kpi-label">Realizado R$ acumulado · ${_metasLabelAcum(mes,ano)}</div>
      <div class="kpi-value" style="font-size:22px;">${fmtRS(g.acumRS)}</div>
      <div class="kpi-sub">${rotAcumComp}: ${fmtRS(g.acumRSComp)}</div>
      <div class="kpi-sub">Meta acumulada ${g.acumMetaRS?fmtRS(g.acumMetaRS):'—'} · <strong style="color:${corAting(g.atingAcumRS)};">${fmtPctOuTraco(g.atingAcumRS)}</strong></div>
      <div style="margin-top:8px;">${_badgeVar(g.acumRS, g.acumRSComp, String(comp))}</div>
    </div>
    <div class="kpi-card" style="--kpi-color:var(--accent)">
      <div class="kpi-label">Realizado m² acumulado · ${_metasLabelAcum(mes,ano)}</div>
      <div class="kpi-value" style="font-size:22px;">${fmt(g.acumQtd)} m²</div>
      <div class="kpi-sub">${rotAcumComp}: ${fmt(g.acumQtdComp)} m²</div>
      <div class="kpi-sub">Meta acumulada ${g.acumMetaQtd?fmt(g.acumMetaQtd)+' m²':'—'} · <strong style="color:${corAting(g.atingAcumQtd)};">${fmtPctOuTraco(g.atingAcumQtd)}</strong></div>
      <div style="margin-top:8px;">${_badgeVar(g.acumQtd, g.acumQtdComp, String(comp))}</div>
    </div>`;

  // ── Comparativo por país (mês e acumulado, m² e R$) ──
  const linhasComp = [g].concat(METAS_PAISES.map(p=>_metasDadosPais(p)));
  const celVal = (v, sufixo) => v ? fmt(v)+(sufixo||'') : '—';
  document.getElementById('metasCompPaisBody').innerHTML = linhasComp.map(r=>{
    const nome = r.pais==='GLOBAL' ? 'GLOBAL' : esc(r.pais);
    const bold = r.pais==='GLOBAL' ? 'font-weight:700;' : '';
    return `<tr style="${r.pais==='GLOBAL'?'background:var(--surface2);':''}">
      <td style="font-size:12px;${bold}white-space:nowrap;">${nome}</td>
      <td style="text-align:right;font-size:12px;${bold}">${celVal(r.realQtd)}</td>
      <td style="text-align:right;font-size:12px;color:var(--text3);">${celVal(r.realQtdComp)}</td>
      <td style="text-align:right;">${_badgeVar(r.realQtd, r.realQtdComp)}</td>
      <td style="text-align:right;font-size:12px;${bold}">${celVal(r.realRS)}</td>
      <td style="text-align:right;font-size:12px;color:var(--text3);">${celVal(r.realRSComp)}</td>
      <td style="text-align:right;">${_badgeVar(r.realRS, r.realRSComp)}</td>
      <td style="text-align:right;font-size:12px;${bold}">${celVal(r.acumQtd)}</td>
      <td style="text-align:right;font-size:12px;color:var(--text3);">${celVal(r.acumQtdComp)}</td>
      <td style="text-align:right;">${_badgeVar(r.acumQtd, r.acumQtdComp)}</td>
      <td style="text-align:right;font-size:12px;${bold}">${celVal(r.acumRS)}</td>
      <td style="text-align:right;font-size:12px;color:var(--text3);">${celVal(r.acumRSComp)}</td>
      <td style="text-align:right;">${_badgeVar(r.acumRS, r.acumRSComp)}</td>
    </tr>`;
  }).join('');

  // Gráficos de linhas: Meta x Realizado, Quantidade (m²) e Preço Médio, Global + por país
  renderMetasChartGlobal();
  renderMetasChartQtd();
  renderMetasChartPreco();

  // Barras meta x realizado por país (mês selecionado)
  const coresBarras = _metasCoresPaises();
  function barraLinha(label, meta, real, cor){
    const maxV = Math.max(meta, real, 1);
    const pctMeta = meta/maxV*100, pctReal = real/maxV*100;
    const ating = meta ? (real/meta*100) : 0;
    return `<div class="bar-row">
      <div class="bar-label"><span>${label} <span style="color:${ating>=100?'var(--success)':'var(--warn)'};font-size:11px;">(${fmt(ating)}%)</span></span><span>${fmtRS(real)} / ${fmtRS(meta)}</span></div>
      <div class="bar-track" style="position:relative;"><div class="bar-fill" style="width:${pctMeta}%;background:var(--text3);opacity:.35;position:absolute;"></div><div class="bar-fill" style="width:${pctReal}%;background:${cor};position:absolute;"></div></div>
    </div>`;
  }
  let html = barraLinha('GLOBAL', g.metaRS, g.realRS, 'var(--accent2)');
  METAS_PAISES.forEach((pais,idx)=>{
    const meta = (METAS_DATA[pais] && METAS_DATA[pais][mes]) ? METAS_DATA[pais][mes].valor : 0;
    const real = _realizadoEfetivo(pais, mes);
    html += barraLinha(pais, meta, real, coresBarras[idx%coresBarras.length]);
  });
  document.getElementById('metasBarras').innerHTML = html;

  // Preço médio por país (informativo, calculado a partir das NFs — sem meta)
  renderMetasPrecoMedio(mes);

  // Tabelas anuais
  renderMetasTabelaAno();
  renderMetasTabelaAnoQtd();
  renderMetasTabelaAnoPreco();
}

// Tabela anual Financeiro (R$) — Meta x Realizado, Global + por país
function renderMetasTabelaAno(){
  const fmt = n => isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const linhas = [{nome:'GLOBAL', key:'GLOBAL'}].concat(METAS_PAISES.map(p=>({nome:esc(p), key:p})));
  let thead = '<thead><tr><th>País</th>' + MESES_ABREV.slice(1).map(m=>`<th style="text-align:left;min-width:96px;">${m}</th>`).join('') + '<th style="text-align:left;min-width:96px;">Total</th></tr></thead>';
  let tbody = '<tbody>';
  linhas.forEach(l=>{
    let totMeta=0, totReal=0, totRealUS=0;
    const cellsMeta = [];
    for(let m=1;m<=12;m++){
      const meta = (METAS_DATA[l.key] && METAS_DATA[l.key][m]) ? METAS_DATA[l.key][m].valor : 0;
      const real = _realizadoEfetivo(l.key, m);
      const realUS = _calcDado(METAS_REALIZADO_CALC, l.key, m).valorUS;
      totMeta+=meta; totReal+=real; totRealUS+=realUS;
      const ating = meta ? (real/meta*100) : null;
      const cor = ating===null ? 'var(--text3)' : (ating>=100?'var(--success)':'var(--warn)');
      cellsMeta.push(`<td style="text-align:left;font-size:11px;white-space:nowrap;"><div style="color:var(--text3);">${meta?'R$ '+fmt(meta):'—'}</div><div style="color:${cor};font-weight:700;">${real?'R$ '+fmt(real):'—'}</div><div style="color:var(--accent);font-weight:400;">${realUS?'US$ '+fmt(realUS):'—'}</div></td>`);
    }
    const atingTot = totMeta ? (totReal/totMeta*100) : null;
    tbody += `<tr><td style="font-weight:700;font-size:12px;">${l.nome}</td>${cellsMeta.join('')}<td style="text-align:left;font-size:11px;font-weight:700;white-space:nowrap;"><div style="color:var(--text3);">${totMeta?'R$ '+fmt(totMeta):'—'}</div><div style="color:${atingTot>=100?'var(--success)':'var(--warn)'};">${'R$ '+fmt(totReal)}</div><div style="color:var(--accent);font-weight:400;">${totRealUS?'US$ '+fmt(totRealUS):'—'}</div></td></tr>`;
  });
  tbody += '</tbody>';
  document.getElementById('metasTabelaAno').innerHTML = thead+tbody;
}

// Preço médio por país (US$ e R$) = valor faturado / qtd faturada (m²), só informativo — sem meta.
function renderMetasPrecoMedio(mes){
  const fmt = n => isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  // Linha principal = vendas normais (sem Pontas/Classe B). Abaixo, se houver no mês,
  // a sub-linha 📌 Pontas/Classe B com o preço médio próprio delas.
  function linhaPreco(label, dados, ehPonta){
    const sqmt = dados.sqmt, p = _preco(dados);
    const estiloTr = ehPonta ? ' style="background:var(--warn-soft);"' : '';
    const estiloLbl = ehPonta ? 'font-size:11px;color:var(--warn);padding-left:16px;' : 'font-weight:700;font-size:12px;';
    return `<tr${estiloTr}>
      <td style="${estiloLbl}">${label}</td>
      <td style="text-align:right;font-size:12px;">${sqmt?fmt(sqmt):'—'}</td>
      <td style="text-align:right;font-size:12px;color:${ehPonta?'var(--warn)':'var(--accent)'};font-weight:700;">${p.us?'US$ '+fmt(p.us):'—'}</td>
      <td style="text-align:right;font-size:12px;color:${ehPonta?'var(--warn)':'var(--accent2)'};font-weight:700;">${p.rs?'R$ '+fmt(p.rs):'—'}</td>
    </tr>`;
  }
  function blocoPais(label, pais){
    const d = _calcDado(METAS_REALIZADO_CALC, pais, mes);
    let h = linhaPreco(label, _dadoNormal(d), false);
    // 04/11/2026: sub-linha 📌 só abaixo dos países que tiveram Pontas/Classe B (não no Global)
    if(d.sqmtPonta && pais!=='GLOBAL') h += linhaPreco('Pontas/Classe B', _dadoPonta(d), true);
    return h;
  }
  let html = blocoPais('GLOBAL', 'GLOBAL');
  METAS_PAISES.forEach(pais=>{ html += blocoPais(esc(pais), pais); });
  document.getElementById('metasPrecoMedioBody').innerHTML = html;
}

// Estado (por sessão) de quais séries estão visíveis em cada gráfico, pelo NOME da série —
// assim o toggle da legenda não se perde ao trocar o período ou ligar/desligar o ano de comparação.
let _chartSeriesVisible = {};
function _toggleSerieChart(containerId, idx){
  const wrap = document.getElementById(containerId);
  if(!wrap || !wrap._series || !wrap._series[idx]) return;
  if(!_chartSeriesVisible[containerId]) _chartSeriesVisible[containerId] = {};
  const estado = _chartSeriesVisible[containerId];
  const label = wrap._series[idx].label;
  estado[label] = (estado[label]===false) ? true : false;
  const g = wrap.querySelector(`g[data-serie="${idx}"]`);
  if(g) g.style.display = estado[label]===false ? 'none' : '';
  const leg = wrap.querySelector(`.legend-item[data-serie="${idx}"]`);
  if(leg) leg.style.opacity = estado[label]===false ? '0.35' : '1';
}

// Liga/desliga o ano de comparação num gráfico (checkbox no cabeçalho do card)
function toggleCompChart(el){
  const id = el.dataset.chart;
  METAS_COMP_CHARTS[id] = el.checked;
  _salvarCompCharts();
  if(id==='metasChartWrap') renderMetasChartGlobal();
  else if(id==='metasChartQtdWrap') renderMetasChartQtd();
  else if(id==='metasChartPrecoWrap') renderMetasChartPreco();
}
function _compAtivo(id){ return !!METAS_COMP_CHARTS[id] && !!METAS_ANO_COMP; }

// 04/11/2026: modo de cada gráfico de evolução — 'agrupado' (todos juntos) ou 'separado' (um por país)
const METAS_CHART_MODO_KEY = 'adexport_metas_chart_modo_v1';
let METAS_CHART_MODO = (function(){ try{ return JSON.parse(localStorage.getItem(METAS_CHART_MODO_KEY))||{}; }catch(e){ return {}; } })();
function _chartModo(id){ return METAS_CHART_MODO[id]==='separado' ? 'separado' : 'agrupado'; }
function toggleModoChart(el){
  const id = el.dataset.chartModo;
  METAS_CHART_MODO[id] = el.value;
  try{ localStorage.setItem(METAS_CHART_MODO_KEY, JSON.stringify(METAS_CHART_MODO)); }catch(e){}
  if(id==='metasChartWrap') renderMetasChartGlobal();
  else if(id==='metasChartQtdWrap') renderMetasChartQtd();
  else if(id==='metasChartPrecoWrap') renderMetasChartPreco();
}
// Desenha o gráfico no modo escolhido. No modo 'separado', as séries são agrupadas pelo campo
// "grupo" (GLOBAL ou nome do país) e cada grupo vira um gráfico próprio, com a sua meta e o
// ano de comparação (quando "Mostrar" estiver marcado). País sem nenhum valor no ano é omitido.
function _renderChartModo(containerId, series, opts){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  if(_chartModo(containerId)!=='separado'){
    wrap._multi = null;
    // Todos juntos: as metas por país têm a mesma cor; começam ocultas (só a Meta Global aparece).
    // Clique na legenda para exibir.
    const estado = _chartSeriesVisible[containerId] || (_chartSeriesVisible[containerId] = {});
    series.forEach(s=>{ if(_ehMetaSerie(s) && s.grupo && s.grupo!=='GLOBAL' && estado[s.label]===undefined) estado[s.label] = false; });
    renderLinhasMultiSerie(containerId, series, opts);
    return;
  }
  const grupos = [];
  series.forEach(s=>{
    const g = s.grupo || 'GLOBAL';
    let x = grupos.find(y=>y.g===g);
    if(!x){ x = {g, series:[]}; grupos.push(x); }
    x.series.push(s);
  });
  const comDados = grupos.filter(x=>x.series.some(s=>(s.values||[]).some(v=>v)));
  wrap._series = null;
  wrap.style.position = '';
  wrap.innerHTML = '<div class="metas-subchart-grid">' + comDados.map((x,i)=>
    `<div><div class="metas-subchart-tit">${x.g==='GLOBAL'?'Global':esc(x.g)}</div><div id="${containerId}__${i}" style="min-height:200px;"></div></div>`
  ).join('') + '</div>' + (comDados.length ? '' : '<div style="color:var(--text3);font-size:12px;padding:20px;text-align:center;">Sem dados no ano</div>');
  wrap._multi = comDados.map((x,i)=>({id: containerId+'__'+i, titulo: x.g==='GLOBAL'?'Global':x.g}));
  comDados.forEach((x,i)=>renderLinhasMultiSerie(containerId+'__'+i, x.series, Object.assign({}, opts, {height:200})));
}

// Tooltip ao clicar num ponto de qualquer gráfico de linha (Metas). Some sozinho após alguns segundos.
function _chartTooltipShow(containerId, evt, el){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  let tip = wrap.querySelector('.chart-tooltip');
  if(!tip){
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    tip.style.cssText = 'position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:11px;line-height:1.4;color:var(--text);white-space:nowrap;z-index:30;box-shadow:var(--shadow);transform:translate(-50%,-115%);display:none;';
    wrap.appendChild(tip);
  }
  const rect = wrap.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const label = el.dataset.label||'', mes = el.dataset.mes||'', valor = el.dataset.valor||'';
  const prefix = el.dataset.prefix||'', suffix = el.dataset.suffix||'';
  let html = '<strong>'+label+'</strong><br>'+mes+': '+prefix+valor+suffix;
  if(el.dataset.valor2){
    html += '<br>'+mes+': '+(el.dataset.prefix2||'')+el.dataset.valor2+(el.dataset.suffix2||'');
  }
  tip.innerHTML = html;
  tip.style.left = x+'px';
  tip.style.top = y+'px';
  tip.style.display = 'block';
  clearTimeout(wrap._tipTimer);
  wrap._tipTimer = setTimeout(()=>{ tip.style.display='none'; }, 3500);
  if(evt.stopPropagation) evt.stopPropagation();
}

// Paleta de cores para diferenciar os países nos gráficos de múltiplas séries
function _metasCoresPaises(){
  // 1ª cor diferente do azul da linha Global, para o país não se confundir com ela
  return ['#4fc1a6','#ff6b6b','#ffd93d','#a78bfa','#00b894','#fd79a8','#0984e3','#fdcb6e','#e17055','#00cec9'];
}

// Gráfico de linhas genérico com múltiplas séries, com legenda clicável para exibir/ocultar
// cada linha, e suporte a um segundo valor (ex: US$) exibido junto no tooltip.
// Série: {label, values, values2?, color, width?, dash? (tracejado = meta), dot? (pontilhado = ano de comparação)}
// 04/11/2026: padrão visual dos gráficos de evolução —
//   ano de comparação = cinza, linha fina contínua, sem bolinhas (só a cor do ano atual é do país);
//   meta = cor própria (cor do texto do tema), tracejada, para não se confundir com nenhum país nem com o ano anterior.
const COR_CHART_COMP = '#9a9aae';
function _ehMetaSerie(s){ return !!s.dash && /^Meta /.test(s.label||''); }
function _corSerieChart(s){ return s.dot ? COR_CHART_COMP : (_ehMetaSerie(s) ? 'var(--text)' : s.color); }
function _estiloSerieChart(s){ return s.dot ? 'solid' : (s.dash ? 'dashed' : 'solid'); }
// Último mês com valor: meses depois dele (ex.: Nov/Dez ainda sem faturamento) não são desenhados
function _ultimoMesComValor(vals){ for(let i=vals.length-1;i>=0;i--){ if(vals[i]) return i; } return -1; }
// Ano atual: todas as linhas de realizado vão até o último mês com faturamento no Global
// (um país com zero no mês continua mostrando o zero; os meses futuros não aparecem)
function _aplicarLimiteAnoAtual(series, valoresGlobal){
  const lim = _ultimoMesComValor(valoresGlobal);
  series.forEach(s=>{ if(!s.dot && !_ehMetaSerie(s) && !s.gaps) s.limite = lim; });
  return series;
}

function renderLinhasMultiSerie(containerId, series, opts){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  opts = opts || {};
  const W = wrap.clientWidth || 600, H = opts.height || 240;
  const PL=70, PR=16, PT=16, PB=28;
  const cW = W-PL-PR, cH = H-PT-PB;
  const allVals = series.reduce((a,s)=>a.concat(s.values),[]);
  const maxV = Math.max(...allVals, 1);
  const fmtSh = n => n>=1000000 ? (n/1000000).toFixed(1)+'M' : n>=1000 ? (n/1000).toFixed(0)+'k' : n.toFixed(0);
  const yLines = [0,.25,.5,.75,1].map(f=>({y:PT+cH-f*cH, val:maxV*f}));
  const xStep = cW/11;
  const ptX = i => PL + i*xStep;
  const ptY = v => PT + cH - (v/maxV*cH);
  // gaps=true: meses com valor 0 não são desenhados (a linha é interrompida) — usado nas séries de Pontas/Classe B
  const limiteSerie = s => (s.limite!==undefined && s.limite!==null) ? s.limite : _ultimoMesComValor(s.values);
  function pathFrom(vals, gaps, lim){
    let d='', novo=true;
    vals.forEach((v,i)=>{
      if(i>lim) return;
      if(gaps && !v){ novo=true; return; }
      d += (novo?'M':'L') + ptX(i).toFixed(1) + ',' + ptY(v).toFixed(1) + ' ';
      novo=false;
    });
    return d.trim();
  }
  const grid = yLines.map(l=>`<line x1="${PL}" y1="${l.y.toFixed(1)}" x2="${W-PR}" y2="${l.y.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/><text x="${(PL-6).toFixed(1)}" y="${(l.y+4).toFixed(1)}" text-anchor="end" fill="var(--text3)" font-size="10" font-family="Segoe UI,system-ui,sans-serif">${fmtSh(l.val)}</text>`).join('');
  const xLabels = MESES_ABREV.slice(1).map((m,i)=>`<text x="${ptX(i).toFixed(1)}" y="${(PT+cH+18).toFixed(1)}" text-anchor="middle" fill="var(--text3)" font-size="10" font-family="Segoe UI,system-ui,sans-serif">${m}</text>`).join('');
  const prefix = opts.prefix || '', suffix = opts.suffix || '';
  const prefix2 = opts.prefix2 || '', suffix2 = opts.suffix2 || '';
  const fmtPonto = n => Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const estado = _chartSeriesVisible[containerId] || {};

  const grupos = series.map((s,idx)=>{
    const visivel = estado[s.label]!==false;
    const cor = _corSerieChart(s);
    const ehMeta = _ehMetaSerie(s);
    const dashAttr = s.dot ? '' : (s.dash ? (ehMeta ? 'stroke-dasharray="6,4"' : 'stroke-dasharray="5,4"') : '');
    const largura = s.dot ? 1.5 : (ehMeta ? 1.75 : (s.width||1.75));
    const lim = limiteSerie(s);
    const path = `<path d="${pathFrom(s.values, s.gaps, lim)}" fill="none" stroke="${cor}" stroke-width="${largura}" ${dashAttr}/>`;
    const dots = s.values.map((v,i)=>{
      if(i>lim) return '';
      if(s.gaps && !v) return '';
      const v2 = s.values2 ? s.values2[i] : null;
      const attrsV2 = v2!==null ? ` data-valor2="${fmtPonto(v2)}" data-prefix2="${prefix2}" data-suffix2="${suffix2}"` : '';
      // ano de comparação: ponto invisível (só para o clique/tooltip)
      const fillPt = s.dot ? 'transparent' : cor;
      const rPt = s.dot ? 4 : ((s.width||1.75)>2?3.5:2.5);
      return `<circle cx="${ptX(i).toFixed(1)}" cy="${ptY(v).toFixed(1)}" r="${rPt}" fill="${fillPt}" style="cursor:pointer;" data-label="${esc(s.label)}" data-mes="${MESES_ABREV[i+1]}" data-valor="${fmtPonto(v)}" data-prefix="${prefix}" data-suffix="${suffix}"${attrsV2} onclick="_chartTooltipShow('${containerId}',event,this)"/>`;
    }).join('');
    return `<g data-serie="${idx}" style="display:${visivel?'':'none'}">${path}${dots}</g>`;
  }).join('');

  const legend = series.map((s,idx)=>{
    const visivel = estado[s.label]!==false;
    const estilo = _estiloSerieChart(s);
    return `<span class="legend-item" data-serie="${idx}" onclick="_toggleSerieChart('${containerId}',${idx})" style="cursor:pointer;user-select:none;opacity:${visivel?1:0.35};display:inline-flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:14px;height:0;border-top:2px ${estilo} ${_corSerieChart(s)};"></span>${esc(s.label)}
    </span>`;
  }).join('');

  wrap.style.position = 'relative';
  wrap._series = series;
  wrap._dims = {W, H};
  wrap.innerHTML = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${grid}${xLabels}
      ${grupos}
    </svg>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:8px;padding-bottom:2px;font-size:11px;color:var(--text2);">${legend}</div>`;
}

// Monta 12 valores mensais a partir de uma função (mes) => valor
function _serie12(fn){ const v=[]; for(let m=1;m<=12;m++) v.push(fn(m)||0); return v; }

// Meta x Realizado (Global + por país), nos 12 meses do ano selecionado
function renderMetasChartGlobal(){
  const cores = _metasCoresPaises();
  const comp = _compAtivo('metasChartWrap') ? METAS_ANO_COMP : null;
  const series = [];
  series.push({grupo:'GLOBAL', label:'Meta Global', values:_serie12(m=>(METAS_DATA['GLOBAL']&&METAS_DATA['GLOBAL'][m])?METAS_DATA['GLOBAL'][m].valor:0), color:'var(--text3)', dash:true, width:2});
  series.push({grupo:'GLOBAL', label:'Global', values:_serie12(m=>_realizadoEfetivo('GLOBAL',m)), values2:_serie12(m=>_calcDado(METAS_REALIZADO_CALC,'GLOBAL',m).valorUS), color:'var(--accent2)', width:3});
  if(comp) series.push({grupo:'GLOBAL', label:'Global '+comp, values:_serie12(m=>_realizadoEfetivoComp('GLOBAL',m)), values2:_serie12(m=>_calcDado(METAS_REALIZADO_CALC_COMP,'GLOBAL',m).valorUS), color:'var(--accent2)', width:2, dot:true});
  METAS_PAISES.forEach((pais,idx)=>{
    const cor = cores[idx%cores.length];
    series.push({grupo:pais, label:'Meta '+pais, values:_serie12(m=>(METAS_DATA[pais]&&METAS_DATA[pais][m])?METAS_DATA[pais][m].valor:0), color:cor, dash:true, width:1.5});
    series.push({grupo:pais, label:pais, values:_serie12(m=>_realizadoEfetivo(pais,m)), values2:_serie12(m=>_calcDado(METAS_REALIZADO_CALC,pais,m).valorUS), color:cor, width:2});
    if(comp) series.push({grupo:pais, label:pais+' '+comp, values:_serie12(m=>_realizadoEfetivoComp(pais,m)), values2:_serie12(m=>_calcDado(METAS_REALIZADO_CALC_COMP,pais,m).valorUS), color:cor, width:1.75, dot:true});
  });
  _aplicarLimiteAnoAtual(series, _serie12(m=>_realizadoEfetivo('GLOBAL',m)));
  _renderChartModo('metasChartWrap', series, {height:240, prefix:'R$ ', prefix2:'US$ '});
}

// Quantidade (m²) mensal — Meta Global (tracejada) + Realizado Global (destaque) + Realizado por país
function renderMetasChartQtd(){
  const cores = _metasCoresPaises();
  const comp = _compAtivo('metasChartQtdWrap') ? METAS_ANO_COMP : null;
  const series = [
    {grupo:'GLOBAL', label:'Meta Global', values:_serie12(m=>(METAS_DATA['GLOBAL']&&METAS_DATA['GLOBAL'][m])?METAS_DATA['GLOBAL'][m].qtd:0), color:'var(--text3)', dash:true, width:2},
    {grupo:'GLOBAL', label:'Global', values:_serie12(m=>_realizadoQtdEfetivo('GLOBAL',m)), color:'var(--accent2)', width:3},
  ];
  if(comp) series.push({grupo:'GLOBAL', label:'Global '+comp, values:_serie12(m=>_realizadoQtdEfetivoComp('GLOBAL',m)), color:'var(--accent2)', width:2, dot:true});
  METAS_PAISES.forEach((pais,idx)=>{
    const cor = cores[idx%cores.length];
    // 04/11/2026: meta de m² do país, quando cadastrada (tracejada)
    const metaQtdPais = _serie12(m=>(METAS_DATA[pais]&&METAS_DATA[pais][m])?METAS_DATA[pais][m].qtd:0);
    if(metaQtdPais.some(v=>v)) series.push({grupo:pais, label:'Meta '+pais, values:metaQtdPais, color:cor, dash:true, width:1.5});
    series.push({grupo:pais, label:pais, values:_serie12(m=>_realizadoQtdEfetivo(pais,m)), color:cor, width:1.75});
    if(comp) series.push({grupo:pais, label:pais+' '+comp, values:_serie12(m=>_realizadoQtdEfetivoComp(pais,m)), color:cor, width:1.75, dot:true});
  });
  _aplicarLimiteAnoAtual(series, _serie12(m=>_realizadoQtdEfetivo('GLOBAL',m)));
  _renderChartModo('metasChartQtdWrap', series, {height:240, suffix:' m²'});
}

// Preço Médio (R$/m²) mensal — Global (destaque) + por país. Sem meta (não há preço-alvo cadastrado).
function renderMetasChartPreco(){
  const cores = _metasCoresPaises();
  const comp = _compAtivo('metasChartPrecoWrap') ? METAS_ANO_COMP : null;
  // Linhas principais = preço médio SEM Pontas/Classe B. As Pontas/Classe B entram como séries
  // próprias (tracejadas, só nos meses em que houve venda delas).
  const precoRS = (calc,pais) => _serie12(m=>_preco(_dadoNormal(_calcDado(calc,pais,m))).rs);
  const precoUS = (calc,pais) => _serie12(m=>_preco(_dadoNormal(_calcDado(calc,pais,m))).us);
  const precoPontaRS = (calc,pais) => _serie12(m=>_preco(_dadoPonta(_calcDado(calc,pais,m))).rs);
  const precoPontaUS = (calc,pais) => _serie12(m=>_preco(_dadoPonta(_calcDado(calc,pais,m))).us);
  const series = [{grupo:'GLOBAL', label:'Global', values:precoRS(METAS_REALIZADO_CALC,'GLOBAL'), values2:precoUS(METAS_REALIZADO_CALC,'GLOBAL'), color:'var(--accent2)', width:3}];
  if(comp) series.push({grupo:'GLOBAL', label:'Global '+comp, values:precoRS(METAS_REALIZADO_CALC_COMP,'GLOBAL'), values2:precoUS(METAS_REALIZADO_CALC_COMP,'GLOBAL'), color:'var(--accent2)', width:2, dot:true});
  METAS_PAISES.forEach((pais,idx)=>{
    const cor = cores[idx%cores.length];
    series.push({grupo:pais, label:pais, values:precoRS(METAS_REALIZADO_CALC,pais), values2:precoUS(METAS_REALIZADO_CALC,pais), color:cor, width:1.75});
    if(comp) series.push({grupo:pais, label:pais+' '+comp, values:precoRS(METAS_REALIZADO_CALC_COMP,pais), values2:precoUS(METAS_REALIZADO_CALC_COMP,pais), color:cor, width:1.75, dot:true});
  });
  // 📌 Pontas/Classe B — Global visível; por país começa oculto (clique na legenda para exibir)
  const estadoPreco = _chartSeriesVisible['metasChartPrecoWrap'] || (_chartSeriesVisible['metasChartPrecoWrap'] = {});
  if(_temPontaNoAno(METAS_REALIZADO_CALC,'GLOBAL')){
    series.push({grupo:'GLOBAL', label:'Pontas/Classe B Global', values:precoPontaRS(METAS_REALIZADO_CALC,'GLOBAL'), values2:precoPontaUS(METAS_REALIZADO_CALC,'GLOBAL'), color:'var(--warn)', width:2.5, dash:true, gaps:true});
  }
  if(comp && _temPontaNoAno(METAS_REALIZADO_CALC_COMP,'GLOBAL')){
    series.push({grupo:'GLOBAL', label:'Pontas/Classe B Global '+comp, values:precoPontaRS(METAS_REALIZADO_CALC_COMP,'GLOBAL'), values2:precoPontaUS(METAS_REALIZADO_CALC_COMP,'GLOBAL'), color:'var(--warn)', width:2, dot:true, gaps:true});
  }
  METAS_PAISES.forEach((pais,idx)=>{
    if(!_temPontaNoAno(METAS_REALIZADO_CALC,pais)) return;
    const cor = cores[idx%cores.length];
    const lbl = pais+' Pontas/Classe B';
    if(estadoPreco[lbl]===undefined) estadoPreco[lbl] = false;
    series.push({grupo:pais, label:lbl, values:precoPontaRS(METAS_REALIZADO_CALC,pais), values2:precoPontaUS(METAS_REALIZADO_CALC,pais), color:cor, width:1.75, dash:true, gaps:true});
  });
  series.forEach(s=>{ s.gaps = true; });   // mês sem venda não tem preço: a linha é interrompida
  _renderChartModo('metasChartPrecoWrap', series, {height:240, prefix:'R$ ', suffix:'/m²', prefix2:'US$ ', suffix2:'/m²'});
}

// Tabela anual de Quantidade (m²) — Meta x Realizado, Global + por país
function renderMetasTabelaAnoQtd(){
  const fmt = n => (!n && n!==0) || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const linhas = [{nome:'GLOBAL', key:'GLOBAL'}].concat(METAS_PAISES.map(p=>({nome:esc(p), key:p})));
  let thead = '<thead><tr><th>País</th>' + MESES_ABREV.slice(1).map(m=>`<th style="text-align:left;min-width:96px;">${m}</th>`).join('') + '<th style="text-align:left;min-width:96px;">Total</th></tr></thead>';
  let tbody = '<tbody>';
  linhas.forEach(l=>{
    let totMeta=0, totReal=0;
    const cells = [];
    for(let m=1;m<=12;m++){
      const meta = (METAS_DATA[l.key] && METAS_DATA[l.key][m]) ? METAS_DATA[l.key][m].qtd : 0;
      const real = _realizadoQtdEfetivo(l.key, m);
      totMeta+=meta; totReal+=real;
      const ating = meta ? (real/meta*100) : null;
      const cor = ating===null ? 'var(--text3)' : (ating>=100?'var(--success)':'var(--warn)');
      cells.push(`<td style="text-align:left;font-size:11px;white-space:nowrap;"><div style="color:var(--text3);">${meta?fmt(meta):'—'}</div><div style="color:${cor};font-weight:700;">${real?fmt(real):'—'}</div></td>`);
    }
    const atingTot = totMeta ? (totReal/totMeta*100) : null;
    tbody += `<tr><td style="font-weight:700;font-size:12px;">${l.nome}</td>${cells.join('')}<td style="text-align:left;font-size:11px;font-weight:700;white-space:nowrap;"><div style="color:var(--text3);">${fmt(totMeta)}</div><div style="color:${atingTot>=100?'var(--success)':'var(--warn)'};">${fmt(totReal)}</div></td></tr>`;
  });
  tbody += '</tbody>';
  document.getElementById('metasTabelaAnoQtd').innerHTML = thead+tbody;
}

// Tabela anual de Preço Médio (R$/m²) — informativo, sem meta, Global + por país
function renderMetasTabelaAnoPreco(){
  const fmt = n => (!n && n!==0) || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const linhas = [{nome:'GLOBAL', key:'GLOBAL'}].concat(METAS_PAISES.map(p=>({nome:esc(p), key:p})));
  let thead = '<thead><tr><th>País</th>' + MESES_ABREV.slice(1).map(m=>`<th style="text-align:left;min-width:96px;">${m}</th>`).join('') + '<th style="text-align:left;min-width:96px;">Média Ano</th></tr></thead>';
  let tbody = '<tbody>';
  // Linha principal = sem Pontas/Classe B; sub-linha 📌 Pontas/Classe B abaixo do país que teve.
  function linhaAno(nome, extrair, ehPonta){
    let totValorRS=0, totValorUS=0, totSqmt=0;
    const corRS = ehPonta ? 'var(--warn)' : 'var(--accent2)';
    const corUS = ehPonta ? 'var(--text3)' : 'var(--accent)';
    const cells = [];
    for(let m=1;m<=12;m++){
      const d = extrair(m);
      const p = _preco(d);
      totValorRS += d.valorRS; totValorUS += d.valorUS; totSqmt += d.sqmt;
      cells.push(`<td style="text-align:left;font-size:11px;white-space:nowrap;"><div style="color:${corRS};font-weight:700;">${p.rs?'R$ '+fmt(p.rs):'—'}</div><div style="color:${corUS};font-weight:400;">${p.us?'US$ '+fmt(p.us):'—'}</div></td>`);
    }
    const precoMedioAnoRS = totSqmt ? (totValorRS/totSqmt) : null;
    const precoMedioAnoUS = totSqmt ? (totValorUS/totSqmt) : null;
    const trAttr = ehPonta ? ' style="background:var(--warn-soft);"' : '';
    const lblStyle = ehPonta ? 'font-size:11px;color:var(--warn);padding-left:16px;' : 'font-weight:700;font-size:12px;';
    return `<tr${trAttr}><td style="${lblStyle}">${nome}</td>${cells.join('')}<td style="text-align:left;font-size:11px;white-space:nowrap;"><div style="color:${corRS};font-weight:700;">${precoMedioAnoRS?'R$ '+fmt(precoMedioAnoRS):'—'}</div><div style="color:${corUS};font-weight:400;">${precoMedioAnoUS?'US$ '+fmt(precoMedioAnoUS):'—'}</div></td></tr>`;
  }
  linhas.forEach(l=>{
    tbody += linhaAno(l.nome, m=>_dadoNormal(_calcDado(METAS_REALIZADO_CALC, l.key, m)), false);
    if(_temPontaNoAno(METAS_REALIZADO_CALC, l.key)){
      tbody += linhaAno('Pontas/Classe B', m=>_dadoPonta(_calcDado(METAS_REALIZADO_CALC, l.key, m)), true);
    }
  });
  tbody += '</tbody>';
  document.getElementById('metasTabelaAnoPreco').innerHTML = thead+tbody;
}

// ═══ METAS — EXPORTAÇÃO (PDF e XLSX do período aplicado) ═══
// Cores fixas (tema claro) para os gráficos no PDF, que não entende as variáveis CSS da tela
const METAS_PDF_CORES = {'--text3':'#8a8aa0','--text2':'#4a4a60','--text':'#1a1a2e','--border':'#dddddd','--accent2':'#1a9990','--accent':'#b89200','--success':'#2d9e3a','--danger':'#d93030','--warn':'#c07000'};
function _corPdf(c){ return String(c||'').replace(/var\((--[a-z0-9]+)\)/gi,(m,v)=>METAS_PDF_CORES[v]||'#888888'); }

// Captura o gráfico como está na tela (só as séries visíveis), pronto para o PDF
function _graficoParaPdf(containerId, titulo){
  const wrap = document.getElementById(containerId);
  const svg = wrap && wrap.querySelector('svg');
  if(!svg || !wrap._series) return null;
  const estado = _chartSeriesVisible[containerId] || {};
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('g[data-serie]').forEach(g=>{ if(g.style.display==='none') g.remove(); else g.removeAttribute('style'); });
  clone.querySelectorAll('circle').forEach(c=>{ c.removeAttribute('onclick'); c.removeAttribute('style'); });
  const dims = wrap._dims || {W:600,H:240};
  clone.setAttribute('viewBox', '0 0 '+dims.W+' '+dims.H);
  clone.setAttribute('width', '100%');
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const legenda = wrap._series.filter(s=>estado[s.label]!==false).map(s=>({label:s.label, cor:_corPdf(_corSerieChart(s)), estilo:_estiloSerieChart(s)}));
  return { titulo, svg: _corPdf(clone.outerHTML), legenda };
}

function _montarExportMetas(incluirGraficos){
  const mes = METAS_MES||1, ano = METAS_ANO, comp = METAS_ANO_COMP;
  const paises = ['GLOBAL'].concat(METAS_PAISES);
  const nome = p => p==='GLOBAL' ? 'GLOBAL' : p;
  const linhas = paises.map(p=>_metasDadosPais(p));
  const g = linhas[0];
  const dados = {
    ano, mes, anoComp: comp,
    mesLabel: _metasLabelMesAno(mes,ano), mesCompLabel: _metasLabelMesAno(mes,comp),
    acumLabel: _metasLabelAcum(mes,ano), acumCompLabel: _metasLabelAcum(mes,comp),
    kpis: {
      realRS:g.realRS, metaRS:g.metaRS, atingRS:g.atingRS, realRSComp:g.realRSComp, varRS:g.varRS,
      realQtd:g.realQtd, metaQtd:g.metaQtd, atingQtd:g.atingQtd, realQtdComp:g.realQtdComp, varQtd:g.varQtd,
      realUS:g.realUS, deficitRS:g.realRS-g.metaRS, deficitQtd:g.realQtd-g.metaQtd,
    },
    acumulado: {
      rs:g.acumRS, rsComp:g.acumRSComp, varRS:g.varAcumRS, metaRS:g.acumMetaRS, atingRS:g.atingAcumRS,
      qtd:g.acumQtd, qtdComp:g.acumQtdComp, varQtd:g.varAcumQtd, metaQtd:g.acumMetaQtd, atingQtd:g.atingAcumQtd,
    },
    metaRealizado: linhas.map(r=>({pais:nome(r.pais), metaQtd:r.metaQtd, realQtd:r.realQtd, atingQtd:r.atingQtd, metaRS:r.metaRS, realRS:r.realRS, atingRS:r.atingRS, realUS:r.realUS})),
    comparativo: linhas.map(r=>({pais:nome(r.pais),
      realQtd:r.realQtd, realQtdComp:r.realQtdComp, varQtd:r.varQtd,
      realRS:r.realRS, realRSComp:r.realRSComp, varRS:r.varRS,
      acumQtd:r.acumQtd, acumQtdComp:r.acumQtdComp, varAcumQtd:r.varAcumQtd,
      acumRS:r.acumRS, acumRSComp:r.acumRSComp, varAcumRS:r.varAcumRS})),
    // Preço médio sem Pontas/Classe B; sub-linha 📌 Pontas/Classe B logo abaixo do país que teve
    precoMedio: linhas.reduce((arr,r)=>{
      arr.push({pais:nome(r.pais), qtd:r.qtdNormal, precoUS:r.precoUS, precoRS:r.precoRS});
      if(r.qtdPonta && r.pais!=='GLOBAL') arr.push({pais:'   Pontas/Classe B', qtd:r.qtdPonta, precoUS:r.precoPontaUS, precoRS:r.precoPontaRS});
      return arr;
    },[]),
    anualRS: paises.map(p=>{
      let tm=0,tr=0,tu=0;
      const meses = [];
      for(let m=1;m<=12;m++){
        const meta=(METAS_DATA[p]&&METAS_DATA[p][m])?METAS_DATA[p][m].valor:0, real=_realizadoEfetivo(p,m), us=_calcDado(METAS_REALIZADO_CALC,p,m).valorUS;
        tm+=meta; tr+=real; tu+=us; meses.push({meta, real, us});
      }
      return {pais:nome(p), meses, total:{meta:tm, real:tr, us:tu}};
    }),
    anualQtd: paises.map(p=>{
      let tm=0,tr=0;
      const meses = [];
      for(let m=1;m<=12;m++){
        const meta=(METAS_DATA[p]&&METAS_DATA[p][m])?METAS_DATA[p][m].qtd:0, real=_realizadoQtdEfetivo(p,m);
        tm+=meta; tr+=real; meses.push({meta, real});
      }
      return {pais:nome(p), meses, total:{meta:tm, real:tr}};
    }),
    anualPreco: paises.reduce((arr,p)=>{
      const linhaAno = (label, extrair) => {
        let trs=0,tus=0,tq=0;
        const meses = [];
        for(let m=1;m<=12;m++){
          const d=extrair(m);
          trs+=d.valorRS; tus+=d.valorUS; tq+=d.sqmt;
          meses.push({rs: d.sqmt?d.valorRS/d.sqmt:0, us: d.sqmt?d.valorUS/d.sqmt:0});
        }
        return {pais:label, meses, media:{rs: tq?trs/tq:0, us: tq?tus/tq:0}};
      };
      arr.push(linhaAno(nome(p), m=>_dadoNormal(_calcDado(METAS_REALIZADO_CALC,p,m))));
      if(_temPontaNoAno(METAS_REALIZADO_CALC,p)) arr.push(linhaAno('   Pontas/Classe B', m=>_dadoPonta(_calcDado(METAS_REALIZADO_CALC,p,m))));
      return arr;
    },[]),
  };
  dados.secoesVisiveis = _metasSecoesVisiveis();
  if(incluirGraficos){
    // 04/11/2026: só os gráficos marcados no seletor; no modo "um por país" vai um gráfico por país
    const graf = (containerId, secao, titulo) => {
      if(!_metasSecaoVisivel(secao)) return null;
      const wrap = document.getElementById(containerId);
      if(wrap && wrap._multi && wrap._multi.length){
        const multi = wrap._multi.map(m=>{ const g=_graficoParaPdf(m.id, m.titulo); return g; }).filter(Boolean);
        return multi.length ? { titulo, secao, multi } : null;
      }
      const g = _graficoParaPdf(containerId, titulo);
      if(g) g.secao = secao;
      return g;
    };
    dados.graficos = [
      graf('metasChartWrap', 'metasSecGrafRS', 'Evolução Mensal · Meta x Realizado (R$) · '+ano),
      graf('metasChartPrecoWrap', 'metasSecGrafPreco', 'Evolução Mensal · Preço Médio (R$/m²) · '+ano),
      graf('metasChartQtdWrap', 'metasSecGrafQtd', 'Evolução Mensal · Quantidade (m²) · '+ano),
    ].filter(Boolean);
  }
  return dados;
}

function _metasPodeExportar(){
  if(!METAS_ANO){ showToast('Abra a aba Metas e clique em Aplicar antes de exportar','error'); return false; }
  if(_metasPendente()){ showToast('A seleção foi alterada. Clique em Aplicar antes de exportar','warn'); return false; }
  return true;
}

function exportarPdfMetas(){
  if(!_metasPodeExportar()) return;
  const dados = _montarExportMetas(true);
  const btn = document.getElementById('btnExportPdfMetas');
  if(btn) btn.disabled = true;
  showToast('Gerando PDF das Metas...','');
  google.script.run.withSuccessHandler(r=>{
    if(btn) btn.disabled = false;
    const d = JSON.parse(r);
    if(d.success){ showToast('PDF salvo!','success'); window.open(d.url,'_blank'); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>{ if(btn) btn.disabled = false; showToast('Erro: '+e.message,'error'); })
  .gerarPdfMetas(JSON.stringify(dados));
}

function exportarXlsxMetas(){
  if(!_metasPodeExportar()) return;
  const dados = _montarExportMetas(false);
  const btn = document.getElementById('btnExportXlsxMetas');
  if(btn) btn.disabled = true;
  showToast('Gerando XLSX das Metas...','');
  google.script.run.withSuccessHandler(r=>{
    if(btn) btn.disabled = false;
    const d = JSON.parse(r);
    if(d.success){ showToast('XLSX salvo!','success'); window.open(d.url,'_blank'); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>{ if(btn) btn.disabled = false; showToast('Erro: '+e.message,'error'); })
  .gerarXlsxMetas(JSON.stringify(dados));
}
