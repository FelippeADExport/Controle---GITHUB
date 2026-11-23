// ============================================================
// ABA CONTROLE: carregamento, tabelas (Marítimo, Rodoviário,
// Amostra, Não informado), filtros e "Vincular arquivos"
// ============================================================

let CONTROLE=[], controleEditId=null, ctrlPdfProformaB64=null;
let TODAS_NFS=[], _comissaoPorProformaCache=null;
let ctrlTabAtual = 'maritimo';

// Classe visual de cada status (usada nas tabelas e nos menus de status)
const STATUS_CLASSE = {
  'ag. pagamento':'s-ag-pag','ag. informações':'s-ag-inf','ag. documentação':'s-ag-doc',
  'ag. cadastro':'s-ag-doc','ag. liberação financeiro':'s-ag-pag',
  'proforma enviada':'s-ag-inf','ag. embarque':'s-ag-emb',
  'embarcou na fábrica':'s-ag-emb','transferência de navio':'s-transferencia',
  'embarcado':'s-pago','finalizado':'s-fin',
  'ag. instrução de embarque':'s-ag-inst','ag. nomeação agente':'s-ag-nom',
  'ag. reserva/booking':'s-ag-res','ag. aprovação cliente':'s-ag-aprov',
  'cancelado':'s-cancelado','ag. produção':'s-ag-prod',
};
const ETQ_CLASSE  = {'aprovada':'etq-aprovada','reprovada':'etq-reprovada','aguardando aprovação':'etq-aguardando'};
const INSP_CLASSE = {'aprovada':'etq-aprovada','reprovada':'etq-reprovada','fora da vigência':'etq-aguardando'};

function loadControle(){
  document.getElementById('controleLoading').style.display='';
  document.getElementById('controleTableWrap').classList.add('hidden');
  document.getElementById('controleEmpty').classList.add('hidden');

  let _ctrlPronto=false, _nfsPronto=false;
  const _finalizarLoadControle=()=>{
    if(!_ctrlPronto || !_nfsPronto) return;
    document.getElementById('controleLoading').style.display='none';
    // Popula os selects antes de filtrar e reaplica os filtros ativos
    // (mantém Proforma/Cliente/etc. digitados após salvar uma edição)
    _populaFiltrosSelect();
    _populaEmpresaFiltroGlobal();
    filtrarControle();
    atualizarBadgeNotif();
    // Inicializar barras de colunas após dados carregados
    _initColToggle('mar');
    _initColToggle('rod');
    _initColToggle('amo');
    _initColToggle('nin');
    // Garante que só a barra da aba ativa fique visível
    const barras={maritimo:'colToggleMar',rodoviario:'colToggleRod',amostra:'colToggleAmo',nao_informado:'colToggleNIN'};
    Object.keys(barras).forEach(t=>{const el=document.getElementById(barras[t]);if(el)el.style.display=(ctrlTabAtual===t)?'flex':'none';});
  };

  google.script.run
    .withSuccessHandler(r=>{
      try {
        const d=JSON.parse(r);
        if(d.success) CONTROLE=d.data;
        else showToast('Erro: '+d.error,'error');
      } catch(e) {
        showToast('Erro interno: '+e.message,'error');
      }
      _ctrlPronto=true; _finalizarLoadControle();
    })
    .withFailureHandler(e=>{
      showToast('Erro: '+e.message,'error');
      _ctrlPronto=true; _finalizarLoadControle();
    })
    .getControle();

  // NFs: usadas para calcular percentual/valor da comissão por proforma (coluna Comissão)
  google.script.run
    .withSuccessHandler(r=>{
      try {
        const d=JSON.parse(r);
        TODAS_NFS = d.success ? (d.data||[]) : [];
      } catch(e) { TODAS_NFS=[]; }
      _comissaoPorProformaCache=null;
      _nfsPronto=true; _finalizarLoadControle();
    })
    .withFailureHandler(()=>{
      TODAS_NFS=[];
      _comissaoPorProformaCache=null;
      _nfsPronto=true; _finalizarLoadControle();
    })
    .getTodasNFs();
}

// Agrega as NFs por proforma (soma comissão em US$/R$, junta percentuais distintos).
// Regra única (igual ao Relatório de Controle, Metas e modal de NFs): soma as NFs no
// relatório e os abatimentos automáticos de devolução gerados pelo servidor.
// NFs "Fora do Relatório" não somam nem geram abatimento.
function _comissaoPorProforma(){
  if(_comissaoPorProformaCache) return _comissaoPorProformaCache;
  const map = {};
  (TODAS_NFS||[]).forEach(nf=>{
    if(nf.incluir_relatorio===false) return;
    const pf = nf.numero_proforma;
    if(!map[pf]) map[pf] = {comUS:0, comRS:0, percentuais:new Set()};
    map[pf].comUS += (nf.comissao_valor||0);
    map[pf].comRS += (nf.comissao_valor_rs||0);
    if(nf.comissao_pct_raw!==null && nf.comissao_pct_raw!==undefined) map[pf].percentuais.add(nf.comissao_pct_raw);
  });
  _comissaoPorProformaCache = map;
  return map;
}

// ── Células repetidas nas quatro tabelas ──
const _temComissaoManual = r => r.faturado!=='SIM' && r.comissao_manual!==null && r.comissao_manual!==undefined;
const _dataPrev = v => v ? `<span class="dt-prev">${esc(v)}</span>` : '—';
const _dataReal = v => v ? `<span class="dt-real">${esc(v)}</span>` : '—';

function _celEditar(r){
  return `<td class="col-freeze col-freeze-0 cel-acao"><button class="btn btn-secondary btn-icon" onclick="abrirModalControle('${esc(r.numero_proforma)}')" title="Editar registro" aria-label="Editar registro">✏️</button></td>`;
}
function _celExcluir(r){
  return `<td><div class="ctrl-actions"><button class="btn btn-danger btn-icon" onclick="excluirControleById('${esc(r.numero_proforma)}')" title="Excluir registro" aria-label="Excluir registro">🗑️</button></div></td>`;
}
// Proforma + marcações (Ponta, Classe B, comissão manual) + links dos PDFs
function _celProforma(r){
  const marcas = (r.ponta==='SIM'?' <span class="chip chip-amarelo" title="Ponta de Produção">Ponta A</span>':'')
    + (r.classe_b==='SIM'?' <span class="chip chip-danger" title="Classe B">Classe B</span>':'')
    + (_temComissaoManual(r)?' <span class="chip" title="Comissão manual (sem NF lançada): valores em R$ estimados pela cotação média">Com. Manual</span>':'');
  const links = (r.pdf_proforma?`<a class="link-doc" href="${esc(r.pdf_proforma)}" target="_blank" title="Abrir proforma">Proforma</a>`:'')
    + (r.pdf_invoice?`<a class="link-doc" href="${esc(r.pdf_invoice)}" target="_blank" title="Abrir invoice">Invoice</a>`:'');
  return `<td class="col-freeze col-freeze-3 cel-proforma">${esc(r.numero_proforma)}${marcas}${links?'<div class="links-doc">'+links+'</div>':''}</td>`;
}
function _celNumeroAd(r){
  const pdfA = r.pdf_ad?`<br><a class="link-icone" href="${esc(r.pdf_ad)}" target="_blank" title="Abrir PDF do pedido AD" aria-label="Abrir PDF do pedido AD">📄</a>`:'';
  return `<td><span class="ctrl-num">${esc(r.numero_ad)}</span>${pdfA}</td>`;
}
function _celValor(r, comQtd){
  return `${r.valor?`<span class="ctrl-valor">US$ ${fmtN(r.valor)}</span>`:'—'}${comQtd&&r.sqmt_total?`<br><span class="sub-num">${fmtN(r.sqmt_total)}</span>`:''}`;
}
function _celFaturamento(r){
  const fat = r.faturado==='SIM';
  return `<td><button class="fat-check ${fat?'fat-sim':'chip'}" title="${fat?'Faturado: ver':'Ver / lançar'} notas fiscais" aria-label="${fat?'Faturado: ver':'Ver / lançar'} notas fiscais" onclick="abrirModalNF('${esc(r.numero_proforma)}','${esc(r.empresa)}')">${fat?'✅':'Não'}</button></td>`;
}
function _celStatus(r){
  return `<div class="status-inline-wrap" data-rid="${esc(r.numero_proforma)}"><span class="status-chip ${STATUS_CLASSE[r.status]||''} clickable" data-inline-status="1">${r.status?esc(r.status):'—'}</span></div>`;
}
function _celObs(r, largura){
  const obs = r.observacoes?`<span class="obs-texto" style="max-width:${largura}px;">${esc(r.observacoes)}</span>`:'—';
  return `<td class="cel-obs" style="max-width:${largura}px;" title="Clique para ver/editar as observações" onclick="abrirObsRapida('${esc(r.numero_proforma)}')">${obs}</td>`;
}
// Etiquetas/Inspeção (SIM/NÃO) + status da aprovação, editáveis direto na tabela
function _celEtiquetas(r){
  return `<td class="col-etq-insp">
    <div class="inline-edit-wrap" data-rid="${esc(r.numero_proforma)}">
      <span class="chip ${r.etiquetas==='SIM'?'chip-success':'chip-warn'} clickable" data-inline-campo="etiquetas">${r.etiquetas||'—'}</span>
      ${r.status_etiquetas
        ?`<span class="status-chip ${ETQ_CLASSE[r.status_etiquetas.toLowerCase()]||''} clickable" data-inline-campo="status_etiquetas">${esc(r.status_etiquetas).replace(/aguardando aprovação/i,'Ag. aprovação')}</span>`
        :`<span class="status-chip vazio clickable" data-inline-campo="status_etiquetas">Ag. aprov.</span>`}
    </div>
  </td>`;
}
function _celInspecao(r){
  return `<td class="col-etq-insp">
    <div class="inline-edit-wrap" data-rid="${esc(r.numero_proforma)}">
      <span class="chip ${r.inspecao==='SIM'?'chip-success':'chip-warn'} clickable" data-inline-campo="inspecao">${r.inspecao||'—'}</span>
      ${r.aprovacao_inspecao
        ?`<span class="status-chip ${INSP_CLASSE[r.aprovacao_inspecao.toLowerCase()]||''} clickable" data-inline-campo="aprovacao_inspecao">${esc(r.aprovacao_inspecao).replace(/fora da vigência/i,'Fora vigência').replace(/aguardando aprovação/i,'Ag. aprovação')}</span>`
        :`<span class="status-chip vazio clickable" data-inline-campo="aprovacao_inspecao">Aprovação</span>`}
    </div>
  </td>`;
}
// Célula da coluna "Comissão" (percentual, valor e data de pagamento da comissão).
// Clique na data abre o mesmo modal rápido usado para marcar a comissão como paga.
function _celulaComissaoCol(r){
  const ag = _comissaoPorProforma()[r.numero_proforma];
  let pctTxt = null, valorUS = 0, valorRS = 0;
  if(ag && ag.percentuais.size){
    pctTxt = Array.from(ag.percentuais).sort((a,b)=>a-b).map(p=>fmtN(p)+'%').join(' / ');
    valorUS = ag.comUS; valorRS = ag.comRS;
  } else if(r.comissao_manual!==null && r.comissao_manual!==undefined){
    pctTxt = fmtN(r.comissao_manual)+'%';
    valorUS = (r.valor||0) * (r.comissao_manual||0) / 100;
  }
  const linhaPct = pctTxt
    ? `<span class="forte">${pctTxt}</span>`
    : `<span class="muted">—</span>`;
  const linhaValor = valorUS
    ? `<br><span class="com-valor">US$ ${fmtN(valorUS)}</span>${valorRS?`<br><span class="sub-num">R$ ${fmtN(valorRS)}</span>`:''}`
    : '';
  const linhaData = r.data_pagamento_comissao
    ? `<br><button class="link-btn" onclick="abrirComissaoPagaRapida('${esc(r.numero_proforma)}')" title="Comissão paga: editar a data">${esc(r.data_pagamento_comissao)}</button>`
    : `<br><button class="link-btn muted" onclick="abrirComissaoPagaRapida('${esc(r.numero_proforma)}')" title="Comissão não paga: marcar como paga" aria-label="Marcar a comissão como paga">-</button>`;
  return `<td class="num cel-comissao">${linhaPct + linhaValor + linhaData}</td>`;
}

// Ordena pelo número da proforma (NNN/AA), maior primeiro
function _ordenarPorProforma(lista){
  const parse=s=>{
    const m=(s||'').match(/(\d+)\/(\d+)/);
    if(m) return parseInt(m[2])*1000000+parseInt(m[1]);
    return parseInt((s||'').replace(/\D/g,''))||0;
  };
  return [...lista].sort((a,b)=>parse(b.numero_proforma)-parse(a.numero_proforma));
}

// ── Sub-abas ──
function switchCtrlTab(tab){
  ctrlTabAtual = tab;
  const abas = {
    maritimo:      {btn:'tabCtrlMarBtn', painel:'ctrlPainelMaritimo',     barra:'colToggleMar'},
    rodoviario:    {btn:'tabCtrlRodBtn', painel:'ctrlPainelRodoviario',   barra:'colToggleRod'},
    amostra:       {btn:'tabCtrlAmoBtn', painel:'ctrlPainelAmostra',      barra:'colToggleAmo'},
    nao_informado: {btn:'tabCtrlNINBtn', painel:'ctrlPainelNaoInformado', barra:'colToggleNIN'},
  };
  Object.keys(abas).forEach(t=>{
    const a=abas[t], ativa=(t===tab);
    document.getElementById(a.btn)?.classList.toggle('active', ativa);
    document.getElementById(a.painel)?.classList.toggle('hidden', !ativa);
    // Barras de colunas: cada uma só aparece na sua aba (e só depois de inicializada com botões)
    const barra=document.getElementById(a.barra);
    if(barra) barra.style.display = (ativa && barra.children.length>1) ? 'flex' : 'none';
  });
  // Filtros específicos: Agente/Porto Origem/Pagamento só no Marítimo, Transportador/Pagamento só no Rodoviário
  document.querySelectorAll('#ctrlFiltrosBar .flt-mar').forEach(el=>el.classList.toggle('hidden', tab!=='maritimo'));
  document.querySelectorAll('#ctrlFiltrosBar .flt-rod').forEach(el=>el.classList.toggle('hidden', tab!=='rodoviario'));
  filtrarControle();
}

function renderControle(lista){
  const mar = lista.filter(r=>(r.transporte||'').toLowerCase()==='maritimo');
  const rod = lista.filter(r=>(r.transporte||'').toLowerCase()==='rodoviario');
  const amo = lista.filter(r=>(r.transporte||'').toLowerCase()==='amostra');
  const nin = lista.filter(r=>{const t=(r.transporte||'').toLowerCase();return t!=='maritimo'&&t!=='rodoviario'&&t!=='amostra';});

  document.getElementById('ctrlMarCount').textContent = mar.length ? mar.length : '';
  document.getElementById('ctrlRodCount').textContent = rod.length ? rod.length : '';
  document.getElementById('ctrlAmoCount').textContent = amo.length ? amo.length : '';
  document.getElementById('ctrlNINCount').textContent = nin.length ? nin.length : '';
  document.getElementById('controleSubtitle').textContent = lista.length+' registro'+(lista.length!==1?'s':'');
  document.getElementById('tabControleCount').textContent = lista.length;
  _renderMar(mar);
  _renderRod(rod);
  _renderAmo(amo);
  _renderNIN(nin);
}

function _mostrarTabela(wrapId, vazioId, temLinhas){
  document.getElementById(wrapId).classList.toggle('hidden', !temLinhas);
  document.getElementById(vazioId).classList.toggle('hidden', temLinhas);
  return temLinhas;
}

function _renderMar(lista){
  if(!_mostrarTabela('controleTableWrap','controleEmpty',lista.length>0)) return;
  lista = _ordenarPorProforma(lista.filter(r=>!r.id_pai));
  document.getElementById('controleTbody').innerHTML=lista.map(r=>`<tr data-proforma="${esc(r.numero_proforma)}">
      ${_celEditar(r)}
      <td class="col-freeze col-freeze-1 cel-cliente">${esc(r.cliente_nome)||'—'}</td>
      <td class="col-freeze col-freeze-2 cel-peq">${esc(r.empresa)||'—'}</td>
      ${_celProforma(r)}
      ${_celNumeroAd(r)}
      <td class="nowrap">${_celValor(r,true)}</td>
      <td>${_celStatus(r)}</td>
      ${_celEtiquetas(r)}
      ${_celInspecao(r)}
      ${_celFaturamento(r)}
      <td>${esc(r.prazo_pagamento)||'—'}</td>
      <td>${_dataPrev(r.data_prev_pagamento)}${r.data_pagamento?'<br>'+_dataReal(r.data_pagamento):''}</td>
      <td>${_dataPrev(r.data_bl)}</td>
      <td>${_dataPrev(r.etd)}${r.saida?'<br>'+_dataReal(r.saida):''}</td>
      <td>${_dataPrev(r.eta_maritimo)}${r.chegada?'<br>'+_dataReal(r.chegada):''}</td>
      <td>${[r.courrier,r.booking].filter(Boolean).map(esc).join(' / ')||'—'}</td>
      <td>${[r.agente,r.armador].filter(Boolean).map(esc).join(' / ')||'—'}</td>
      <td class="cel-peq">${esc(r.navio)||'—'}</td>
      <td class="cel-peq">${esc(r.porto_origem)||'—'}</td>
      <td class="cel-peq">${esc(r.porto_destino)||'—'}${r.pais_destino?'<br><span class="sub-num">'+esc(r.pais_destino)+'</span>':''}</td>
      ${_celObs(r,140)}
      ${_celulaComissaoCol(r)}
      ${_celExcluir(r)}
    </tr>`).join('');
  _bindInlineChips(document.getElementById('controleTbody'));
  _reaplicarToggle('mar');
}

function _renderRod(lista){
  if(!_mostrarTabela('controleTableWrapRod','controleEmptyRod',lista.length>0)) return;
  lista = _ordenarPorProforma(lista);
  document.getElementById('controleTbodyRod').innerHTML=lista.map(r=>`<tr data-proforma="${esc(r.numero_proforma)}">
      ${_celEditar(r)}
      <td class="col-freeze col-freeze-1 cel-cliente">${esc(r.cliente_nome)||'—'}</td>
      <td class="col-freeze col-freeze-2 cel-peq">${esc(r.empresa)||'—'}</td>
      ${_celProforma(r)}
      ${_celNumeroAd(r)}
      <td class="nowrap">${_celValor(r,true)}</td>
      <td>${_celStatus(r)}</td>
      ${_celEtiquetas(r)}
      ${_celInspecao(r)}
      ${_celFaturamento(r)}
      <td>${esc(r.prazo_pagamento)||'—'}</td>
      <td>${_dataPrev(r.data_prev_pagamento)}${r.data_pagamento?'<br>'+_dataReal(r.data_pagamento):''}</td>
      <td>${_dataPrev(r.data_carregamento)}${r.data_embarque_real?'<br>'+_dataReal(r.data_embarque_real):''}</td>
      <td>${esc(r.numero_crt)||'—'}</td>
      <td>${_dataPrev(r.data_crt)}</td>
      <td class="cel-peq">${esc(r.transportador)||'—'}</td>
      <td class="cel-peq">${esc(r.destino_rod)||'—'}${r.pais_destino?'<br><span class="sub-num">'+esc(r.pais_destino)+'</span>':''}</td>
      ${_celObs(r,140)}
      ${_celulaComissaoCol(r)}
      ${_celExcluir(r)}
    </tr>`).join('');
  _bindInlineChips(document.getElementById('controleTbodyRod'));
  _reaplicarToggle('rod');
}

function _renderAmo(lista){
  if(!_mostrarTabela('controleTableWrapAmo','controleEmptyAmo',lista.length>0)) return;
  lista = _ordenarPorProforma(lista);
  document.getElementById('controleTbodyAmo').innerHTML=lista.map(r=>`<tr>
      ${_celEditar(r)}
      <td class="col-freeze col-freeze-1 cel-cliente">${esc(r.cliente_nome)||'—'}</td>
      <td class="col-freeze col-freeze-2 cel-peq">${esc(r.empresa)||'—'}</td>
      ${_celProforma(r)}
      ${_celNumeroAd(r)}
      <td><div class="status-inline-wrap"><span class="status-chip ${STATUS_CLASSE[r.status]||''} clickable" onclick="abrirStatusInlineDD(event,'${esc(r.numero_proforma)}')">${r.status?esc(r.status):'—'}</span></div></td>
      <td class="nowrap">${_celValor(r,true)}</td>
      ${_celFaturamento(r)}
      <td>${esc(r.courrier)||'—'}</td>
      <td class="cel-peq">${esc(r.transportador)||'—'}</td>
      <td class="cel-peq">${esc(r.destino_rod)||'—'}</td>
      ${_celExcluir(r)}
    </tr>`).join('');
  _reaplicarToggle('amo');
}

function _renderNIN(lista){
  if(!_mostrarTabela('controleTableWrapNIN','controleEmptyNIN',lista.length>0)) return;
  document.getElementById('controleTbodyNIN').innerHTML=lista.map(r=>`<tr>
      ${_celEditar(r)}
      <td class="col-freeze col-freeze-1 cel-cliente">${esc(r.cliente_nome)||'—'}</td>
      <td class="col-freeze col-freeze-2 cel-peq">${esc(r.empresa)||'—'}</td>
      ${_celProforma(r)}
      ${_celNumeroAd(r)}
      <td>${_celStatus(r)}</td>
      <td class="nowrap">${_celValor(r,false)}</td>
      ${_celFaturamento(r)}
      <td class="muted">${esc(r.data_registro)||'—'}</td>
      ${_celObs(r,200)}
      ${_celExcluir(r)}
    </tr>`).join('');
  _reaplicarToggle('nin');
}

// ═══ FILTRO GLOBAL DE PERÍODO ═══
let ctrlPeriodoIni = null;
let ctrlPeriodoFim = null;

function setCtrlPeriodoGlobal(tipo, btnEl){
  const barra = btnEl ? btnEl.parentElement : null;
  if(barra) barra.querySelectorAll('.rel-shortcut-btn').forEach(b=>b.classList.remove('active-shortcut'));
  if(btnEl) btnEl.classList.add('active-shortcut');

  const now = new Date();
  let ini = new Date(), fim = new Date();
  if(tipo==='semana'){ ini.setDate(now.getDate()-7); }
  else if(tipo==='quinzena'){ ini.setDate(now.getDate()-15); }
  else if(tipo==='mes'){ ini.setDate(now.getDate()-30); }
  else if(tipo==='ano'){ ini.setFullYear(now.getFullYear()-1); }
  // 'hoje': mesmo dia

  ini.setHours(0,0,0,0);
  fim.setHours(23,59,59,999);
  ctrlPeriodoIni = ini;
  ctrlPeriodoFim = fim;

  const pad=n=>String(n).padStart(2,'0');
  const toISO=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  document.getElementById('ctrlPeriodoIni').value = toISO(ini);
  document.getElementById('ctrlPeriodoFim').value = toISO(fim);

  filtrarControle();
}

function setCtrlPeriodoCustom(){
  const iniStr = document.getElementById('ctrlPeriodoIni').value;
  const fimStr = document.getElementById('ctrlPeriodoFim').value;
  if(!iniStr && !fimStr){ ctrlPeriodoIni=null; ctrlPeriodoFim=null; filtrarControle(); return; }
  ctrlPeriodoIni = iniStr ? new Date(iniStr+'T00:00:00') : null;
  ctrlPeriodoFim = fimStr ? new Date(fimStr+'T23:59:59') : null;
  filtrarControle();
}

function limparPeriodoGlobal(){
  ctrlPeriodoIni = null; ctrlPeriodoFim = null;
  document.getElementById('ctrlPeriodoIni').value = '';
  document.getElementById('ctrlPeriodoFim').value = '';
  filtrarControle();
}

function _aplicarFiltroPeriodo(lista){
  if(!ctrlPeriodoIni && !ctrlPeriodoFim) return lista;
  return lista.filter(r=>{
    const dr = String(r.data_registro || '').trim();
    if(!dr) return false;

    let d = null;
    let m = dr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(m){
      d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
    } else {
      m = dr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(m){
        d = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
      } else {
        const tmp = new Date(dr);
        if(!isNaN(tmp)) d = tmp;
      }
    }

    if(!d || isNaN(d)) return false;
    d.setHours(12,0,0,0);

    if(ctrlPeriodoIni && d < ctrlPeriodoIni) return false;
    if(ctrlPeriodoFim && d > ctrlPeriodoFim) return false;
    return true;
  });
}

// ═══ FILTROS ═══
function _populaFiltrosSelect(){
  // Popular selects com valores únicos dos dados carregados
  function populaSelect(id, dados, campo){
    const sel = document.getElementById(id); if(!sel) return;
    const cur = sel.value;
    const vals = [...new Set(dados.map(r=>(r[campo]||'').trim()).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todos</option>' + vals.map(v=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(v)}</option>`).join('');
  }
  const mar = CONTROLE.filter(r=>(r.transporte||'').toLowerCase()==='maritimo');
  const rod = CONTROLE.filter(r=>(r.transporte||'').toLowerCase()==='rodoviario');
  populaSelect('fMarAgente',     mar, 'agente');
  populaSelect('fMarPortoOrig',  mar, 'porto_origem');
  populaSelect('fRodTransportador', rod, 'transportador');
}

function ctrlFiltroClienteInput(inputId, dropdownId){
  const dd=document.getElementById(dropdownId), v=(document.getElementById(inputId)?.value||'').toLowerCase().trim();
  const lista=[...new Set((CONTROLE||[]).map(r=>r.cliente_nome).filter(Boolean))].sort();
  const m=v?lista.filter(c=>c.toLowerCase().includes(v)):lista.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.map(c=>`<div class="autocomplete-item" onmousedown="document.getElementById('${inputId}').value='${esc(c.replace(/'/g,"\\'"))}';document.getElementById('${dropdownId}').classList.add('hidden');filtrarControle();">${esc(c)}</div>`).join('');
  dd.classList.remove('hidden');
}

// Destino unificado: junta Porto Destino (marítimo), Destino (rodoviário/amostra) e País Destino
function _destinosRegistro(r){
  return [r.porto_destino, r.destino_rod, r.pais_destino].map(x=>(x||'').trim()).filter(Boolean);
}
function ctrlFiltroDestinoInput(){
  const dd=document.getElementById('ddFDestino'), v=(document.getElementById('fDestino')?.value||'').toLowerCase().trim();
  const lista=[...new Set((CONTROLE||[]).flatMap(_destinosRegistro))].sort();
  const m=v?lista.filter(c=>c.toLowerCase().includes(v)):lista.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.map(c=>`<div class="autocomplete-item" onmousedown="document.getElementById('fDestino').value='${esc(c.replace(/'/g,"\\'"))}';document.getElementById('ddFDestino').classList.add('hidden');filtrarControle();">${esc(c)}</div>`).join('');
  dd.classList.remove('hidden');
}

// Limpar: zera os filtros comuns e os específicos de todas as sub-abas
const CTRL_FILTRO_IDS = ['fProforma','fCliente','fDestino','fStatus','fFaturamento','fMarAgente','fMarPortoOrig','fMarPagamento','fRodTransportador','fRodPagamento'];
function limparFiltrosCtrl2(){
  CTRL_FILTRO_IDS.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  filtrarControle();
}

// Ocultar/exibir a barra de filtros (mesmo sistema da barra de colunas), estado salvo no navegador
const CTRL_FILTROS_COLLAPSED_KEY = 'adexport_filtros_collapsed_v1';
function _filtrosRecolhidos(){ try{ return localStorage.getItem(CTRL_FILTROS_COLLAPSED_KEY)==='1'; }catch(e){ return false; } }
function toggleBarraFiltros(){
  const novo = !_filtrosRecolhidos();
  try{ localStorage.setItem(CTRL_FILTROS_COLLAPSED_KEY, novo?'1':'0'); }catch(e){}
  _aplicarEstadoBarraFiltros();
}
function _aplicarEstadoBarraFiltros(){
  const rec = _filtrosRecolhidos();
  const cont = document.getElementById('ctrlFiltrosContents');
  const btn = document.getElementById('btnToggleFiltros');
  if(cont) cont.style.display = rec ? 'none' : 'flex';
  if(btn){
    const ativos = CTRL_FILTRO_IDS.filter(id=>{const el=document.getElementById(id);return el && el.value;}).length;
    btn.textContent = (rec?'▸':'▾')+' Filtros'+(ativos?' ('+ativos+' ativo'+(ativos!==1?'s':'')+')':'');
    btn.setAttribute('aria-expanded', rec?'false':'true');
  }
}

let ctrlEmpresaFiltro = '';
function onCtrlEmpresaFiltroChange(){
  ctrlEmpresaFiltro = document.getElementById('ctrlEmpresaFiltro').value;
  filtrarControle();
}
function _populaEmpresaFiltroGlobal(){
  const sel = document.getElementById('ctrlEmpresaFiltro'); if(!sel) return;
  const cur = sel.value;
  const lista = [...new Set((CONTROLE||[]).map(r=>(r.empresa||'').trim()).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todos</option>' + lista.map(e=>`<option value="${esc(e)}"${e===cur?' selected':''}>${esc(e)}</option>`).join('');
  sel.value = cur||'';
}
function _aplicarFiltroEmpresa(lista){
  if(!ctrlEmpresaFiltro) return lista;
  return lista.filter(r=>(r.empresa||'')===ctrlEmpresaFiltro);
}

function filtrarControle(){
  let baseFiltrada = _aplicarFiltroPeriodo(CONTROLE || []);
  baseFiltrada = _aplicarFiltroEmpresa(baseFiltrada);

  const val = id => (document.getElementById(id)?.value||'');
  const proforma = val('fProforma').toLowerCase().trim();
  const cliente  = val('fCliente').toLowerCase().trim();
  const destino  = val('fDestino').toLowerCase().trim();
  const status   = val('fStatus').toLowerCase();
  const fat      = val('fFaturamento');
  const agente   = val('fMarAgente').toLowerCase();
  const portOrig = val('fMarPortoOrig').toLowerCase();
  const pgtoMar  = val('fMarPagamento');
  const transp   = val('fRodTransportador').toLowerCase();
  const pgtoRod  = val('fRodPagamento');

  renderControle(baseFiltrada.filter(r=>{
    // Comuns (todas as sub-abas)
    if(proforma && !(r.numero_proforma||'').toLowerCase().includes(proforma)) return false;
    if(cliente && !(r.cliente_nome||'').toLowerCase().includes(cliente)) return false;
    if(destino && !_destinosRegistro(r).some(d=>d.toLowerCase().includes(destino))) return false;
    if(status && (r.status||'').toLowerCase()!==status) return false;
    if(fat==='sim' && r.faturado!=='SIM') return false;
    if(fat==='nao' && r.faturado==='SIM') return false;

    // Específicos: só restringem os registros da própria sub-aba
    const t = (r.transporte||'').toLowerCase();
    if(t==='maritimo'){
      if(agente && (r.agente||'').toLowerCase()!==agente) return false;
      if(portOrig && (r.porto_origem||'').toLowerCase()!==portOrig) return false;
      if(pgtoMar==='realizado' && !r.data_pagamento) return false;
      if(pgtoMar==='pendente' && r.data_pagamento) return false;
    } else if(t==='rodoviario'){
      if(transp && (r.transportador||'').toLowerCase()!==transp) return false;
      if(pgtoRod==='realizado' && !r.data_pagamento) return false;
      if(pgtoRod==='pendente' && r.data_pagamento) return false;
    }
    return true;
  }));
  _aplicarEstadoBarraFiltros();
}

// ═══ VINCULAR ARQUIVOS (em lote) ═══
function vincularProformasLote(){ abrirModal('modalVincular'); }
function _executarVincular(){
  fecharModal('modalVincular');
  const btn=document.getElementById('btnVincularProformas');
  const txt=btn.textContent;
  btn.disabled=true; btn.textContent='Vinculando...';
  showToast('Buscando arquivos na pasta...','');
  google.script.run.withSuccessHandler(r=>{
    btn.disabled=false; btn.textContent=txt;
    const d=JSON.parse(r);
    if(d.success){
      showToast(d.vinculados+' vinculado(s) · '+d.marcadosInvoice+' marcado(s) como Invoice · '+d.semArquivo+' sem arquivo','success');
      if(d.vinculados>0)loadControle();
    } else {
      showToast('Erro: '+d.error,'error');
    }
  }).withFailureHandler(e=>{
    btn.disabled=false; btn.textContent=txt;
    showToast('Erro: '+e.message,'error');
  }).vincularProformasEmLote();
}
