// ============================================================
// ABA CONTROLE: edição de registros
// - formulário "Novo/Editar registro" (modalControle)
// - observações e pagamento da comissão (edição rápida)
// - status, etiquetas e inspeção editados direto na tabela
// ============================================================

// ═══ FORMULÁRIO ═══
function ctrlClienteInput(q){
  const dd=document.getElementById('ctrlClienteDropdown'),v=(q||'').toLowerCase().trim();
  const m=v?CLIENTS.filter(c=>(c.nome||'').toLowerCase().includes(v)||(c.id||'').toLowerCase().includes(v)):CLIENTS.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.slice(0,10).map(c=>`<div class="autocomplete-item" onmousedown="document.getElementById('ctrl-cliente').value='${esc(c.nome.replace(/'/g,"\'"))}';document.getElementById('ctrlClienteDropdown').classList.add('hidden');"><strong>${esc(c.nome)}</strong><small>${esc(c.id||'')} · ${esc(c.pais||'')}</small></div>`).join('');
  dd.classList.remove('hidden');
}

// Data prevista de pagamento = Data BL (marítimo) ou Data de carregamento (rodoviário) + prazo
function calcDataPrevPagamento(){
  const prazoStr=document.getElementById('ctrl-prazo-pagamento').value.trim();
  const transp2=document.getElementById('ctrl-transporte')?.value||'';
  const baseId2=transp2==='rodoviario'?'ctrl-data-carregamento':'ctrl-data-bl';
  const dataETD=document.getElementById(baseId2)?.value||'';
  if(!prazoStr||!dataETD)return;
  const match=prazoStr.match(/\d+/);
  if(!match)return;
  const dias=parseInt(match[0]);
  if(!dias)return;
  const base=new Date(dataETD);
  base.setDate(base.getDate()+dias);
  const pad=n=>String(n).padStart(2,'0');
  document.getElementById('ctrl-data-prev-pagamento').value=
    base.getFullYear()+'-'+pad(base.getMonth()+1)+'-'+pad(base.getDate());
}

function uploadPdfControle(tipo){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/pdf';
  inp.onchange=function(){
    const file=inp.files[0];if(!file)return;
    const nome=document.getElementById('ctrl-pdf-'+tipo+'-nome');
    nome.textContent='Carregando '+file.name+'...';
    const reader=new FileReader();
    reader.onload=e=>{
      ctrlPdfProformaB64=e.target.result;
      nome.textContent='Anexado: '+file.name;
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function onNumeroAdInput(){
  const num=document.getElementById('ctrl-numero-ad').value.trim();
  const nome=document.getElementById('ctrl-pdf-ad-nome');
  nome.textContent = num ? 'Ao salvar, o sistema buscará o PDF na pasta configurada.' : 'O PDF é buscado automaticamente na pasta configurada.';
  nome.classList.remove('ok');
}

function abrirModalNFDoFormulario(){
  const proforma=document.getElementById('ctrl-numero-proforma').value.trim();
  if(!proforma){showToast('Informe o Nº Proforma antes de lançar NFs','warn');return;}
  abrirModalNF(proforma, document.getElementById('ctrl-empresa').value.trim());
}

function _setFaturadoDisplay(faturado){
  const el=document.getElementById('ctrl-faturado-display');
  el.textContent = faturado ? 'Faturado' : 'Não faturado';
  el.classList.toggle('chip-success', faturado);
}

function _limparModalControle(){
  controleEditId=null;ctrlPdfProformaB64=null;
  ['ctrl-empresa','ctrl-numero-ad','ctrl-numero-proforma','ctrl-cliente','ctrl-valor','ctrl-sqmt','ctrl-prazo-pagamento','ctrl-data-pagamento','ctrl-data-prev-pagamento','ctrl-data-pagamento-comissao','ctrl-pais-destino','ctrl-observacoes','ctrl-pdf-invoice','ctrl-comissao-manual'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('ctrl-proforma-original').value='';
  document.getElementById('ctrl-status').value='';
  _setFaturadoDisplay(false);
  document.getElementById('ctrl-ponta').checked=false;
  document.getElementById('ctrl-ponta-check').classList.remove('checked');
  document.getElementById('ctrl-classe-b').checked=false;
  document.getElementById('ctrl-classe-b-check').classList.remove('checked');
  const nomeAd=document.getElementById('ctrl-pdf-ad-nome');
  nomeAd.textContent='O PDF é buscado automaticamente na pasta configurada.';nomeAd.classList.remove('ok');
  document.getElementById('ctrl-pdf-proforma-nome').textContent='';document.getElementById('ctrl-pdf-proforma').value='';

  // Reseta o tipo de transporte (corrige "vazamento" do tipo selecionado no registro anterior)
  document.getElementById('ctrl-transporte').value='';
  ['ctrl-transp-maritimo','ctrl-transp-rodoviario','ctrl-transp-amostra'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById('ctrl-secao-maritimo')?.classList.add('hidden');
  document.getElementById('ctrl-secao-rodoviario')?.classList.add('hidden');
  document.getElementById('ctrl-secao-amostra')?.classList.add('hidden');

  document.getElementById('ctrl-historico-wrap').classList.add('hidden');
  document.getElementById('ctrl-historico').textContent='';
}

function abrirModalControle(id){
  _limparModalControle();
  controleEditId=id;
  document.getElementById('modalControleTitulo').textContent=id?'Editar registro':'Novo registro';

  let bloquear = false;
  if(id){
    const r=CONTROLE.find(x=>x.numero_proforma===id);
    if(r){
      // se não tem transporte definido, abre em modo bloqueado
      bloquear = !(r.transporte||'').trim();

      document.getElementById('ctrl-empresa').value=r.empresa||'';
      document.getElementById('ctrl-numero-ad').value=r.numero_ad||'';
      document.getElementById('ctrl-numero-proforma').value=r.numero_proforma||'';
      document.getElementById('ctrl-proforma-original').value=r.numero_proforma||'';
      document.getElementById('ctrl-cliente').value=r.cliente_nome||'';
      document.getElementById('ctrl-valor').value=r.valor||'';
      document.getElementById('ctrl-sqmt').value=r.sqmt_total||'';
      document.getElementById('ctrl-prazo-pagamento').value=r.prazo_pagamento||'';
      document.getElementById('ctrl-data-pagamento').value=brParaIsoCtrl(r.data_pagamento||'');
      document.getElementById('ctrl-data-prev-pagamento').value=brParaIsoCtrl(r.data_prev_pagamento||'');
      document.getElementById('ctrl-data-pagamento-comissao').value=brParaIsoCtrl(r.data_pagamento_comissao||'');
      _definirStatusNoFormulario(r.status||'');
      document.getElementById('ctrl-pdf-invoice').value=r.pdf_invoice||'';
      document.getElementById('ctrl-pais-destino').value=r.pais_destino||'';
      _setFaturadoDisplay(r.faturado==='SIM');
      const pontaChecked = r.ponta==='SIM';
      document.getElementById('ctrl-ponta').checked = pontaChecked;
      document.getElementById('ctrl-ponta-check').classList.toggle('checked', pontaChecked);
      const classeBChecked = r.classe_b==='SIM';
      document.getElementById('ctrl-classe-b').checked = classeBChecked;
      document.getElementById('ctrl-classe-b-check').classList.toggle('checked', classeBChecked);
      document.getElementById('ctrl-observacoes').value=r.observacoes||'';
      if(r.pdf_ad){const n=document.getElementById('ctrl-pdf-ad-nome');n.textContent='PDF vinculado';n.classList.add('ok');}
      document.getElementById('ctrl-pdf-proforma').value=r.pdf_proforma||'';
      if(r.pdf_proforma)document.getElementById('ctrl-pdf-proforma-nome').textContent='PDF vinculado';
      if(r.historico){
        document.getElementById('ctrl-historico-wrap').classList.remove('hidden');
        document.getElementById('ctrl-historico').textContent=r.historico;
      }
      _restaurarCamposExtrasControle(r);
    }
  }
  abrirModal('modalControle');
  _aplicarBloqueioCamposNIN(bloquear);
}

// Registro sem tipo de transporte: só os botões de transporte ficam liberados
function _aplicarBloqueioCamposNIN(bloquear){
  const aviso = document.getElementById('avisoBloqueioNIN');
  if(bloquear){
    if(!aviso){
      const div = document.createElement('div');
      div.id = 'avisoBloqueioNIN';
      div.className = 'aviso aviso-warn';
      div.innerHTML = '<strong>Selecione o tipo de transporte</strong> para liberar a edição dos demais campos.';
      const modalBody = document.querySelector('#modalControle .modal-body');
      modalBody.insertBefore(div, modalBody.firstChild);
    }
  } else {
    if(aviso) aviso.remove();
  }
  // bloqueia/libera todos os inputs/selects/textarea, exceto o de transporte
  const modalBody = document.querySelector('#modalControle .modal-body');
  const idsLiberar = ['ctrl-transp-maritimo','ctrl-transp-rodoviario','ctrl-transp-amostra'];
  modalBody.querySelectorAll('input,select,textarea,button').forEach(el=>{
    if(idsLiberar.includes(el.id)){
      el.disabled = false;
      el.style.pointerEvents = '';
      el.style.opacity = '';
      return;
    }
    el.disabled = bloquear;
    el.style.opacity = bloquear ? '0.5' : '';
    el.style.pointerEvents = bloquear ? 'none' : '';
  });
  // garante que os botões de transporte sempre fiquem clicáveis
  idsLiberar.forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.style.opacity = ''; el.style.pointerEvents = ''; el.disabled = false; }
  });
}

// Status que saiu da lista (ex.: "ag. nomeação agente") continua no registro antigo:
// entra como opção só para este registro, para não ser apagado ao salvar.
function _definirStatusNoFormulario(status){
  const sel=document.getElementById('ctrl-status');
  sel.querySelectorAll('option[data-antigo]').forEach(o=>o.remove());
  if(status && ![...sel.options].some(o=>o.value===status)){
    const o=document.createElement('option');o.value=status;o.textContent=status.charAt(0).toUpperCase()+status.slice(1);o.dataset.antigo='1';sel.appendChild(o);
  }
  sel.value=status;
}

function fecharModalControle(){fecharModal('modalControle');}

function salvarControle(){
  const numeroProforma=document.getElementById('ctrl-numero-proforma').value.trim();
  if(!numeroProforma){showToast('Informe o Nº Proforma','error');return;}
  const btn=document.getElementById('btnSalvarControle');btn.disabled=true;btn.textContent='Salvando...';
  const payload={
    numero_proforma:numeroProforma,
    proforma_original:document.getElementById('ctrl-proforma-original').value.trim(),
    empresa:document.getElementById('ctrl-empresa').value.trim(),
    numero_ad:document.getElementById('ctrl-numero-ad').value.trim(),
    cliente_nome:document.getElementById('ctrl-cliente').value.trim(),
    valor:parseFloat(document.getElementById('ctrl-valor').value)||0,
    sqmt_total:parseFloat(document.getElementById('ctrl-sqmt').value)||0,
    prazo_pagamento:document.getElementById('ctrl-prazo-pagamento').value.trim(),
    data_pagamento:isoParaBrCtrl(document.getElementById('ctrl-data-pagamento').value),
    data_prev_pagamento:isoParaBrCtrl(document.getElementById('ctrl-data-prev-pagamento').value),
    data_pagamento_comissao:isoParaBrCtrl(document.getElementById('ctrl-data-pagamento-comissao').value),
    status:document.getElementById('ctrl-status').value,
    pdf_invoice_existente:document.getElementById('ctrl-pdf-invoice').value||'',
    pais_destino:document.getElementById('ctrl-pais-destino').value,
    ponta:document.getElementById('ctrl-ponta').checked?'SIM':'NÃO',
    classe_b:document.getElementById('ctrl-classe-b').checked?'SIM':'NÃO',
    observacoes:document.getElementById('ctrl-observacoes').value,
    pdf_proforma_existente:document.getElementById('ctrl-pdf-proforma').value||'',
    pdf_proforma_base64:ctrlPdfProformaB64||'',
    ...(_payloadCamposExtras()),
  };
  google.script.run
    .withSuccessHandler(r=>{
      btn.disabled=false;btn.textContent='Salvar';
      const d=JSON.parse(r);
      if(d.success){fecharModalControle();showToast('Registro salvo','success');loadControle();}
      else showToast('Erro: '+d.error,'error');
    })
    .withFailureHandler(e=>{btn.disabled=false;btn.textContent='Salvar';showToast('Erro: '+e.message,'error');})
    .salvarControle(JSON.stringify(payload));
}

function excluirControleById(id){
  controleEditId = id;
  excluirControle();
}

function excluirControle(){
  if(!controleEditId)return;
  // Buscar info do registro para exibir no modal
  const reg = CONTROLE.find(r=>r.numero_proforma===controleEditId);
  const sub = reg ? (reg.cliente_nome||'—') + (reg.numero_proforma?' · '+reg.numero_proforma:'') : controleEditId;
  document.getElementById('excluirCtrlSubtitle').textContent = sub;
  abrirModal('modalExcluirControle');
}

function confirmarExcluirControle(){
  fecharModal('modalExcluirControle');
  google.script.run
    .withSuccessHandler(r=>{const d=JSON.parse(r);if(d.success){fecharModalControle();showToast('Registro excluído','success');loadControle();}else showToast('Erro: '+d.error,'error');})
    .withFailureHandler(e=>showToast('Erro: '+e.message,'error'))
    .excluirControle(controleEditId);
}

// ═══ CAMPOS DO FORMULÁRIO (transporte, etiquetas, inspeção, Ponta/Classe B) ═══
function toggleCtrlPonta(){
  const cb = document.getElementById('ctrl-ponta');
  cb.checked = !cb.checked;
  document.getElementById('ctrl-ponta-check').classList.toggle('checked', cb.checked);
  if(cb.checked){
    const cm = document.getElementById('ctrl-comissao-manual');
    if(cm && !cm.value) cm.value = '1';
  }
}

function toggleCtrlClasseB(){
  const cb = document.getElementById('ctrl-classe-b');
  cb.checked = !cb.checked;
  document.getElementById('ctrl-classe-b-check').classList.toggle('checked', cb.checked);
  if(cb.checked){
    const cm = document.getElementById('ctrl-comissao-manual');
    if(cm && !cm.value) cm.value = '1';
  }
}

function setCtrlToggle2(campo,valor){
  const idSim=campo==='etiquetas'?'ctrl-etq-sim':'ctrl-insp-sim';
  const idNao=campo==='etiquetas'?'ctrl-etq-nao':'ctrl-insp-nao';
  const idHid=campo==='etiquetas'?'ctrl-etiquetas':'ctrl-inspecao';
  document.getElementById(idSim)?.classList.toggle('active',valor==='SIM');
  document.getElementById(idNao)?.classList.toggle('active',valor==='NÃO');
  const el=document.getElementById(idHid);if(el)el.value=valor;
}

function setTransporte2(tipo){
  document.getElementById('ctrl-transp-maritimo')?.classList.toggle('active',tipo==='maritimo');
  document.getElementById('ctrl-transp-rodoviario')?.classList.toggle('active',tipo==='rodoviario');
  document.getElementById('ctrl-transp-amostra')?.classList.toggle('active',tipo==='amostra');
  const el=document.getElementById('ctrl-transporte');if(el)el.value=tipo;
  document.getElementById('ctrl-secao-maritimo')?.classList.toggle('hidden',tipo!=='maritimo');
  document.getElementById('ctrl-secao-rodoviario')?.classList.toggle('hidden',tipo!=='rodoviario');
  document.getElementById('ctrl-secao-amostra')?.classList.toggle('hidden',tipo!=='amostra');
  if(tipo==='maritimo'||tipo==='rodoviario'||tipo==='amostra'){_aplicarBloqueioCamposNIN(false);}
}

// Autocomplete genérico: usa valores já digitados na própria aba CONTROLE (sem chamada ao servidor)
function ctrlAutocompleteCampo(campo, q){
  const dd=document.getElementById('dd-'+campo.replace('_','-'));
  if(!dd)return;
  const inputId='ctrl-'+campo.replace('_','-');
  const v=(q||'').toLowerCase().trim();
  const lista=[...new Set((CONTROLE||[]).map(r=>(r[campo]||'').trim()).filter(Boolean))].sort();
  const m=v?lista.filter(x=>x.toLowerCase().includes(v)):lista.slice(0,12);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.map(x=>{
    const safe=esc(x.replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
    return '<div class="autocomplete-item" onmousedown="document.getElementById(\''+inputId+'\').value=\''+safe+'\';document.getElementById(\'dd-'+campo.replace('_','-')+'\').classList.add(\'hidden\');">'+esc(x)+'</div>';
  }).join('');
  dd.classList.remove('hidden');
}

// Atualiza o histórico do registro em memória (e no modal, se estiver aberto)
// após salvamentos parciais que não recarregam a lista completa.
function _atualizarHistoricoLocal(numeroProforma, historico){
  if(historico===undefined || historico===null) return;
  const reg=(CONTROLE||[]).find(x=>x.numero_proforma===numeroProforma);
  if(reg) reg.historico=historico;
  const modalAberto=!document.getElementById('modalControle').classList.contains('hidden');
  const proformaModal=(document.getElementById('ctrl-proforma-original')?.value||document.getElementById('ctrl-numero-proforma')?.value||'').trim();
  if(modalAberto && proformaModal===numeroProforma && historico){
    document.getElementById('ctrl-historico-wrap').classList.remove('hidden');
    document.getElementById('ctrl-historico').textContent=historico;
  }
}

function _restaurarCamposExtrasControle(r){
  if(r.etiquetas)setCtrlToggle2('etiquetas',r.etiquetas);
  if(r.inspecao)setCtrlToggle2('inspecao',r.inspecao);
  const se=document.getElementById('ctrl-status-etiquetas');if(se)se.value=r.status_etiquetas||'';
  const ai=document.getElementById('ctrl-aprovacao-inspecao');if(ai)ai.value=r.aprovacao_inspecao||'';
  const dc=document.getElementById('ctrl-data-carregamento');if(dc)dc.value=brParaIsoCtrl(r.data_carregamento||'');
  const cm=document.getElementById('ctrl-comissao-manual');if(cm)cm.value=(r.comissao_manual===null||r.comissao_manual===undefined)?'':r.comissao_manual;
  if(r.transporte)setTransporte2(r.transporte);
  const camposDate=['data_bl','etd','saida','eta_maritimo','chegada','data_crt'];
  camposDate.forEach(c=>{
    const el=document.getElementById('ctrl-'+c.replace(/_/g,'-'));
    if(el)el.value=brParaIsoCtrl(r[c]||'');
  });
  const camposText=['courrier','booking','terminal','agente','armador','navio','transportador'];
  camposText.forEach(c=>{const el=document.getElementById('ctrl-'+c);if(el)el.value=r[c]||'';});
  const crtNumEl=document.getElementById('ctrl-crt-numero');if(crtNumEl)crtNumEl.value=r.numero_crt||'';
  const desRodEl=document.getElementById('ctrl-destino-rod');if(desRodEl)desRodEl.value=r.destino_rod||'';
  const poEl=document.getElementById('ctrl-porto-origem');if(poEl)poEl.value=r.porto_origem||'';
  const pdEl=document.getElementById('ctrl-porto-destino');if(pdEl)pdEl.value=r.porto_destino||'';
}

function _payloadCamposExtras(){
  return {
    etiquetas:         document.getElementById('ctrl-etiquetas')?.value||'',
    status_etiquetas:  document.getElementById('ctrl-status-etiquetas')?.value||'',
    inspecao:          document.getElementById('ctrl-inspecao')?.value||'',
    aprovacao_inspecao:document.getElementById('ctrl-aprovacao-inspecao')?.value||'',
    transporte:        document.getElementById('ctrl-transporte')?.value||'',
    data_carregamento: isoParaBrCtrl(document.getElementById('ctrl-data-carregamento')?.value||''),
    comissao_manual:   (document.getElementById('ctrl-comissao-manual')?.value||'')===''? '' : parseFloat(document.getElementById('ctrl-comissao-manual').value),

    data_bl:           isoParaBrCtrl(document.getElementById('ctrl-data-bl')?.value||''),
    etd:               isoParaBrCtrl(document.getElementById('ctrl-etd')?.value||''),
    saida:             isoParaBrCtrl(document.getElementById('ctrl-saida')?.value||''),
    eta_maritimo:      isoParaBrCtrl(document.getElementById('ctrl-eta-maritimo')?.value||''),
    chegada:           isoParaBrCtrl(document.getElementById('ctrl-chegada')?.value||''),
    courrier:          document.getElementById('ctrl-courrier')?.value||document.getElementById('ctrl-amostra-courrier')?.value||'',

    data_crt:          isoParaBrCtrl(document.getElementById('ctrl-data-crt')?.value||''),
    numero_crt:        document.getElementById('ctrl-crt-numero')?.value||'',
    data_pagamento_conf: isoParaBrCtrl(document.getElementById('ctrl-data-pagamento')?.value||''),
    booking:       document.getElementById('ctrl-booking')?.value||'',
    terminal:      document.getElementById('ctrl-terminal')?.value||'',
    agente:        document.getElementById('ctrl-agente')?.value||'',
    armador:       document.getElementById('ctrl-armador')?.value||'',
    navio:         document.getElementById('ctrl-navio')?.value||'',
    porto_origem:  document.getElementById('ctrl-porto-origem')?.value||'',
    porto_destino: document.getElementById('ctrl-porto-destino')?.value||'',
    transportador: document.getElementById('ctrl-transportador')?.value||document.getElementById('ctrl-amostra-transportador')?.value||'',
    destino_rod:   document.getElementById('ctrl-destino-rod')?.value||document.getElementById('ctrl-amostra-destino')?.value||'',
  };
}

// ═══ OBSERVAÇÕES: leitura/edição rápida (sem abrir o formulário completo) ═══
let _obsRapidaProforma = null;
function abrirObsRapida(numeroProforma){
  _obsRapidaProforma = numeroProforma;
  const reg = (CONTROLE||[]).find(x=>x.numero_proforma===numeroProforma) || {};
  document.getElementById('obsRapidaSubtitle').textContent = 'Proforma ' + numeroProforma;
  document.getElementById('obsRapidaTexto').value = reg.observacoes || '';
  abrirModal('modalObsRapida');
  setTimeout(()=>document.getElementById('obsRapidaTexto').focus(),50);
}
function fecharObsRapida(){
  fecharModal('modalObsRapida');
  _obsRapidaProforma = null;
}
function salvarObsRapida(){
  if(!_obsRapidaProforma) return;
  const texto = document.getElementById('obsRapidaTexto').value;
  const btn = document.getElementById('btnSalvarObsRapida');
  btn.disabled = true; btn.textContent = 'Salvando...';
  google.script.run
    .withSuccessHandler(r=>{
      btn.disabled = false; btn.textContent = 'Salvar';
      const d = JSON.parse(r);
      if(d.success){
        const reg = (CONTROLE||[]).find(x=>x.numero_proforma===_obsRapidaProforma);
        if(reg) reg.observacoes = d.observacoes;
        _atualizarHistoricoLocal(_obsRapidaProforma, d.historico);
        fecharObsRapida();
        showToast('Observações salvas','success');
        filtrarControle();
      } else showToast('Erro: '+d.error,'error');
    })
    .withFailureHandler(e=>{btn.disabled=false;btn.textContent='Salvar';showToast('Erro: '+e.message,'error');})
    .atualizarObservacaoControle(_obsRapidaProforma, texto);
}

// ═══ PAGAMENTO DA COMISSÃO: edição rápida ═══
let _comissaoPagaRapidaProforma = null;
function abrirComissaoPagaRapida(numeroProforma){
  _comissaoPagaRapidaProforma = numeroProforma;
  const reg = (CONTROLE||[]).find(x=>x.numero_proforma===numeroProforma) || {};
  document.getElementById('comissaoPagaRapidaSubtitle').textContent = 'Proforma ' + numeroProforma;
  document.getElementById('comissaoPagaRapidaData').value = brParaIsoCtrl(reg.data_pagamento_comissao||'');
  abrirModal('modalComissaoPagaRapida');
}
function fecharComissaoPagaRapida(){
  fecharModal('modalComissaoPagaRapida');
  _comissaoPagaRapidaProforma = null;
}
function salvarComissaoPagaRapida(){
  if(!_comissaoPagaRapidaProforma) return;
  const valorBR = isoParaBrCtrl(document.getElementById('comissaoPagaRapidaData').value);
  const btn = document.getElementById('btnSalvarComissaoPagaRapida');
  btn.disabled = true; btn.textContent = 'Salvando...';
  google.script.run
    .withSuccessHandler(r=>{
      btn.disabled = false; btn.textContent = 'Salvar';
      const d = JSON.parse(r);
      if(d.success){
        const reg = (CONTROLE||[]).find(x=>x.numero_proforma===_comissaoPagaRapidaProforma);
        if(reg) reg.data_pagamento_comissao = valorBR;
        _atualizarHistoricoLocal(_comissaoPagaRapidaProforma, d.historico);
        fecharComissaoPagaRapida();
        showToast('Data de pagamento da comissão salva','success');
        filtrarControle();
      } else showToast('Erro: '+d.error,'error');
    })
    .withFailureHandler(e=>{btn.disabled=false;btn.textContent='Salvar';showToast('Erro: '+e.message,'error');})
    .salvarCampoControle(_comissaoPagaRapidaProforma, 'data_pagamento_comissao', valorBR);
}

// ═══ EDIÇÃO DIRETA NA TABELA (menus de status, etiquetas e inspeção) ═══
const _STATUS_OPTS=[
  {v:'ag. documentação',l:'Ag. documentação'},{v:'ag. cadastro',l:'Ag. cadastro'},
  {v:'ag. liberação financeiro',l:'Ag. liberação financeiro'},{v:'ag. informações',l:'Ag. informações'},
  {v:'ag. aprovação cliente',l:'Ag. aprovação cliente'},{v:'ag. pagamento',l:'Ag. pagamento'},
  {v:'proforma enviada',l:'Proforma enviada'},{v:'ag. produção',l:'Ag. produção'},
  {v:'ag. instrução de embarque',l:'Ag. instrução embarque'},
  {v:'ag. reserva/booking',l:'Ag. reserva/booking'},{v:'transferência de navio',l:'Transferência de navio'},
  {v:'ag. embarque',l:'Ag. embarque'},{v:'embarcado',l:'Embarcado'},
  {v:'finalizado',l:'Finalizado'},
  {v:'cancelado',l:'Cancelado'},
];
const _INLINE_OPTS = {
  etiquetas:          [{v:'SIM',l:'SIM'},{v:'NÃO',l:'NÃO'}],
  inspecao:           [{v:'SIM',l:'SIM'},{v:'NÃO',l:'NÃO'}],
  status_etiquetas:   [{v:'aguardando aprovação',l:'Ag. aprovação'},{v:'aprovada',l:'Aprovada'},{v:'reprovada',l:'Reprovada'}],
  aprovacao_inspecao: [{v:'fora da vigência',l:'Fora da vigência'},{v:'aprovada',l:'Aprovada'},{v:'reprovada',l:'Reprovada'}],
};

// Menu de status dentro da célula (usado na tabela Amostra)
function abrirStatusInlineDD(e,id){
  e.stopPropagation();
  fecharTodosInlineDD();
  const chip=e.currentTarget,wrap=chip.closest('.status-inline-wrap');
  const old=wrap.querySelector('.status-inline-dd');if(old)old.remove();
  const dd=document.createElement('div');dd.className='status-inline-dd';
  dd.innerHTML=_STATUS_OPTS.map(o=>`<div class="sid-item" data-id="${esc(id)}" data-valor="${o.v}"><span class="status-chip ${STATUS_CLASSE[o.v]||''}">${o.l}</span></div>`).join('');
  dd.querySelectorAll('.sid-item').forEach(item=>{
    item.addEventListener('mousedown',ev=>{ev.stopPropagation();selecionarStatusInline(item.dataset.id,item.dataset.valor);});
  });
  wrap.appendChild(dd);
  document.getElementById('statusInlineOverlay').style.display='block';
}
function selecionarStatusInline(id,novoStatus){
  fecharTodosInlineDD();
  const reg=CONTROLE.find(r=>r.numero_proforma===id);if(reg)reg.status=novoStatus;
  filtrarControle();
  setTimeout(()=>{
    _bindInlineChips(document.getElementById('controleTbody'));
    _bindInlineChips(document.getElementById('controleTbodyRod'));
  },0);
  google.script.run
    .withSuccessHandler(r=>{const d=JSON.parse(r);if(!d.success)showToast('Erro ao salvar status: '+d.error,'error');else _atualizarHistoricoLocal(id,d.historico);})
    .withFailureHandler(e=>showToast('Erro: '+e.message,'error'))
    .salvarStatusControle(id,novoStatus);
}

document.addEventListener('mousedown',e=>{
  if(!e.target.closest('.status-inline-wrap')&&!e.target.closest('.inline-edit-wrap')&&!e.target.closest('.inline-dd'))fecharTodosInlineDD();
});

function selecionarInline(id, campo, valor){
  fecharTodosInlineDD();
  const reg = CONTROLE.find(r => r.numero_proforma === id);
  if(reg) reg[campo] = valor;
  filtrarControle();
  // Re-bind após re-render (garante Marítimo e Rodoviário)
  setTimeout(()=>{
    _bindInlineChips(document.getElementById('controleTbody'));
    _bindInlineChips(document.getElementById('controleTbodyRod'));
  }, 0);
  google.script.run
    .withSuccessHandler(r => { const d=JSON.parse(r); if(!d.success) showToast('Erro: '+d.error,'error'); else _atualizarHistoricoLocal(id,d.historico); })
    .withFailureHandler(e => showToast('Erro: '+e.message,'error'))
    .salvarCampoControle(id, campo, valor);
}

function fecharTodosInlineDD(){
  document.querySelectorAll('.inline-dd').forEach(d => d.remove());
  document.querySelectorAll('.status-inline-dd').forEach(d => d.remove());
  const ov = document.getElementById('statusInlineOverlay');
  if(ov) ov.style.display = 'none';
}

function _bindInlineChips(tbody){
  if(!tbody) return;
  // Chips de etiquetas/inspeção
  tbody.querySelectorAll('[data-inline-campo]').forEach(chip => {
    chip.addEventListener('mousedown', function(e){
      e.stopPropagation();
      const wrap = chip.closest('[data-rid]');
      if(!wrap) return;
      abrirInlineDDdireto(e, wrap.dataset.rid, chip.dataset.inlineCampo, chip);
    });
  });
  // Chips de status
  tbody.querySelectorAll('[data-inline-status]').forEach(chip => {
    chip.addEventListener('mousedown', function(e){
      e.stopPropagation();
      const wrap = chip.closest('[data-rid]');
      if(!wrap) return;
      abrirStatusInlineDDdireto(e, wrap.dataset.rid, chip);
    });
  });
}

// Coloca o menu junto do chip clicado; abre para cima se não couber embaixo
function _posicionarInlineDD(dd, anchor, minAbaixo){
  const rect = anchor.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.left = rect.left + 'px';
  dd.style.zIndex = '600';
  dd.style.maxHeight = '320px';
  dd.style.overflowY = 'auto';
  document.body.appendChild(dd);
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  if(spaceBelow >= minAbaixo || spaceBelow >= spaceAbove){
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.maxHeight = Math.min(320, spaceBelow) + 'px';
  } else {
    dd.style.maxHeight = Math.min(320, spaceAbove) + 'px';
    dd.style.top = (rect.top - parseInt(dd.style.maxHeight) - 4) + 'px';
  }
  document.getElementById('statusInlineOverlay').style.display = 'block';
}

function abrirStatusInlineDDdireto(e, id, anchor){
  fecharTodosInlineDD();
  const dd = document.createElement('div');
  dd.className = 'inline-dd';
  dd.innerHTML = _STATUS_OPTS.map(o => {
    const safeV = o.v.replace(/"/g,'&quot;');
    return `<div class="sid-item" data-id="${esc(id)}" data-campo="status" data-valor="${safeV}"><span class="status-chip ${STATUS_CLASSE[o.v]||''}">${o.l}</span></div>`;
  }).join('');
  dd.querySelectorAll('.sid-item').forEach(item => {
    item.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      selecionarStatusInline(item.dataset.id, item.dataset.valor);
    });
  });
  _posicionarInlineDD(dd, anchor, 200);
}

function abrirInlineDDdireto(e, id, campo, anchor){
  fecharTodosInlineDD();
  const opts = _INLINE_OPTS[campo];
  if(!opts) return;
  const dd = document.createElement('div');
  dd.className = 'inline-dd';
  dd.innerHTML = opts.map(o => {
    const safeV = o.v.replace(/"/g,'&quot;');
    return `<div class="sid-item" data-id="${esc(id)}" data-campo="${campo}" data-valor="${safeV}">${o.l}</div>`;
  }).join('');
  dd.querySelectorAll('.sid-item').forEach(item => {
    item.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      selecionarInline(item.dataset.id, item.dataset.campo, item.dataset.valor);
    });
  });
  _posicionarInlineDD(dd, anchor, 150);
}
