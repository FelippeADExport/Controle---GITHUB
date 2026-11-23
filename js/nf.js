// ============================================================
// NOTAS FISCAIS de uma proforma (modal aberto pela coluna
// Faturamento ou pelo formulário do Controle)
// ============================================================
let nfListaAtual = [];
let nfProformaEhPonta = false;

function abrirModalNF(numeroProforma, empresa){
  document.getElementById('nf-proforma-atual').value = numeroProforma;
  document.getElementById('nf-empresa-atual').value = empresa||'';
  const reg = CONTROLE.find(x=>x.numero_proforma===numeroProforma);
  nfProformaEhPonta = !!(reg && (reg.ponta==='SIM' || reg.classe_b==='SIM'));
  const rotuloPonta = reg && reg.ponta==='SIM' && reg.classe_b==='SIM' ? 'Ponta de Produção / Classe B'
    : reg && reg.classe_b==='SIM' ? 'Classe B' : 'Ponta de Produção';
  document.getElementById('modalNFSubtitulo').textContent = numeroProforma + (nfProformaEhPonta ? ' · ' + rotuloPonta + ' (comissão 1%)' : '');
  ocultarFormNF();
  limparFormNF();
  abrirModal('modalNF');
  carregarNFs(numeroProforma);
}
function fecharModalNF(){
  fecharModal('modalNF');
  filtrarControle();
  // Atualiza a base de NFs da coluna Comissão (sem recarregar o Controle inteiro)
  google.script.run.withSuccessHandler(r=>{
    try{ const d=JSON.parse(r); if(d.success){ TODAS_NFS=d.data||[]; _comissaoPorProformaCache=null; filtrarControle(); } }catch(e){}
  }).getTodasNFs();
}
function mostrarFormNF(){
  document.getElementById('nfFormWrap').classList.remove('hidden');
  document.getElementById('btnMostrarFormNF').classList.add('hidden');
  // Proformas marcadas como Ponta ou Classe B já entram com a comissão fixa de 1% pré-preenchida
  if(nfProformaEhPonta && !document.getElementById('nf-linha-edicao').value && !document.getElementById('nf-comissao-pct').value){
    document.getElementById('nf-comissao-pct').value = '1';
    atualizarPreviewComissaoNF();
  }
}
function ocultarFormNF(){
  document.getElementById('nfFormWrap').classList.add('hidden');
  document.getElementById('btnMostrarFormNF').classList.remove('hidden');
  limparFormNF();
}

function carregarNFs(numeroProforma){
  document.getElementById('nfListaWrap').innerHTML = '<div class="vazio">Carregando...</div>';
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){ nfListaAtual = d.data; renderListaNF(); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).getNFsPorProforma(numeroProforma);
}

function renderListaNF(){
  const wrap = document.getElementById('nfListaWrap'), empty = document.getElementById('nfEmpty');
  if(!nfListaAtual.length){ wrap.innerHTML=''; empty.classList.remove('hidden'); document.getElementById('nfTotaisWrap').innerHTML=''; return; }
  empty.classList.add('hidden');

  // Totais: somam apenas as NFs ativas. NFs devolvidas e NFs com "Incluir no Relatório"
  // desmarcado ficam só como referência na lista, sem entrar no cabeçalho.
  // Regra única (igual a coluna Comissão, Relatório de Controle e Metas):
  // + NF no relatório (mesmo se devolvida)
  // − abatimento, quando a NF está no relatório, é Devolvida, tem data da devolução e "Abater" ativo
  // NF "Fora do Relatório" não soma nem desconta.
  let totQtd=0, totUS=0, totRS=0, totComUS=0, totComRS=0;
  nfListaAtual.forEach(n=>{
    if(n.incluir_relatorio === false) return;
    const abate = n.devolvida && n.data_nf_devolucao && n.abater_relatorio !== false;
    const fator = abate ? 0 : 1; // NF + abatimento = zero
    totQtd   += fator*Math.abs(n.sqmt||0);
    totUS    += fator*Math.abs(n.valor_us||0);
    totRS    += fator*Math.abs(n.valor_rs||0);
    // Comissão negativa da devolução é considerada zero: a comissão da NF original permanece
    totComUS += Math.abs(n.comissao_valor||0);
    totComRS += Math.abs(n.comissao_valor_rs||0);
  });
  const temDevolvidas = nfListaAtual.some(n=>n.devolvida || n.incluir_relatorio === false);
  document.getElementById('nfTotaisWrap').innerHTML = `
    <div class="grid grid-3 nf-totais">
      <div class="kpi-box"><label>Qtd total${temDevolvidas?' (líquido)':''}</label><div class="v">${fmtN(totQtd)}</div></div>
      <div class="kpi-box"><label>Valor total US$${temDevolvidas?' (líquido)':''}</label><div class="v">${fmtUS(totUS)}</div></div>
      <div class="kpi-box"><label>Valor total R$${temDevolvidas?' (líquido)':''}</label><div class="v">R$ ${fmtN(totRS)}</div></div>
      <div></div>
      <div class="kpi-box"><label>Comissão total US$</label><div class="v com-valor">US$ ${fmtN(totComUS)}</div></div>
      <div class="kpi-box"><label>Comissão total R$</label><div class="v com-valor">R$ ${fmtN(totComRS)}</div></div>
    </div>`;

  wrap.innerHTML = nfListaAtual.map(nf => {
    const dev = nf.devolvida;
    const excluida = nf.incluir_relatorio === false;
    const borderColor = dev ? 'var(--danger)' : 'var(--border)';
    const badge = dev ? `<span class="selo selo-perigo">Devolvida${nf.nf_devolucao?' · NF Dev: '+esc(nf.nf_devolucao):''}${nf.data_nf_devolucao?' · '+esc(nf.data_nf_devolucao):' · sem data (abatimento não lançado)'}${nf.abater_relatorio===false?' · sem abatimento':''}</span>` : '';
    const badgeExcluida = excluida ? `<span class="selo">Fora do relatório</span>` : '';
    // Na edição, exibe os valores brutos (positivos) — o sinal é aplicado nos relatórios
    const absUS = Math.abs(nf.valor_us), absRS = Math.abs(nf.valor_rs), absSqmt = Math.abs(nf.sqmt);
    const absComUS = Math.abs(nf.comissao_valor), absComRS = Math.abs(nf.comissao_valor_rs);
    return `
    <div class="nf-item" style="border-color:${borderColor};${dev?'opacity:.85;':''}${excluida?'opacity:.55;':''}">
      <div class="nf-item-info">
        <span class="nf-item-titulo">NF ${esc(nf.numero_nf||'—')} <span class="muted">· ${esc(nf.data_faturamento||'—')}</span></span>
        ${badge} ${badgeExcluida}
        <span class="nf-item-detalhe">Qtd: ${fmtN(absSqmt)} m² · Valor: US$ ${fmtN(absUS)} (R$ ${fmtN(absRS)}) · Comissão: ${fmtComissaoPct(nf.comissao_pct_raw)} = <span class="com-valor">${fmtComissaoUS(nf.comissao_pct_raw,absComUS)}</span> <span style="color:var(--text3);">(${fmtComissaoRS(nf.comissao_pct_raw,absComRS)})</span></span>
      </div>
      <div class="nf-item-acoes">
        <button class="btn btn-secondary btn-icon" onclick="editarNF(${nf.linha})" title="Editar NF" aria-label="Editar NF">✏️</button>
        <button class="btn btn-danger btn-icon" onclick="excluirNFModal(${nf.linha})" title="Excluir NF" aria-label="Excluir NF">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function editarNF(linha){
  const nf = nfListaAtual.find(n=>n.linha===linha); if(!nf) return;
  mostrarFormNF();
  document.getElementById('nf-linha-edicao').value = linha;
  document.getElementById('nf-data-fat').value = brParaIsoCtrl(nf.data_faturamento||'');
  document.getElementById('nf-numero').value = nf.numero_nf||'';
  document.getElementById('nf-sqmt').value = Math.abs(nf.sqmt)||'';
  document.getElementById('nf-valor-us').value = Math.abs(nf.valor_us)||'';
  document.getElementById('nf-comissao-pct').value = nf.comissao_pct||'';
  document.getElementById('nf-valor-rs').value = Math.abs(nf.valor_rs)||'';
  document.getElementById('nf-cotacao').value = nf.cotacao||'';
  document.getElementById('nfFormTitulo').textContent = 'Editando NF '+(nf.numero_nf||'');
  _setNFIncluirRelatorioVisual(nf.incluir_relatorio !== false);
  // Restaurar estado de devolução
  _limparNFDevolucao();
  if(nf.devolvida){
    const cb = document.getElementById('nf-devolvida');
    cb.checked = true;
    document.getElementById('nf-devolvida-box').style.background = 'var(--danger)';
    document.getElementById('nf-devolvida-box').style.borderColor = 'var(--danger)';
    document.getElementById('nf-devolucao-check').style.borderColor = 'var(--danger)';
    document.getElementById('nf-devolucao-numwrap').classList.remove('hidden');
    const nd = document.getElementById('nf-nf-devolucao'); if(nd) nd.value = nf.nf_devolucao||'';
    const dd = document.getElementById('nf-data-nf-devolucao'); if(dd) dd.value = brParaIsoCtrl(nf.data_nf_devolucao||'');
    _setNFAbaterRelatorioVisual(nf.abater_relatorio !== false);
  }
  atualizarPreviewComissaoNF();
}

function toggleNFDevolvida(){
  const cb = document.getElementById('nf-devolvida');
  cb.checked = !cb.checked;
  document.getElementById('nf-devolvida-box').style.background = cb.checked ? 'var(--danger)' : '';
  document.getElementById('nf-devolvida-box').style.borderColor = cb.checked ? 'var(--danger)' : '';
  document.getElementById('nf-devolucao-check').style.borderColor = cb.checked ? 'var(--danger)' : '';
  document.getElementById('nf-devolucao-numwrap').classList.toggle('hidden', !cb.checked);
}

function toggleNFIncluirRelatorio(){
  const cb = document.getElementById('nf-incluir-relatorio');
  _setNFIncluirRelatorioVisual(!cb.checked);
}

function _setNFIncluirRelatorioVisual(incluido){
  document.getElementById('nf-incluir-relatorio').checked = incluido;
  document.getElementById('nf-incluir-relatorio-box').style.background = incluido ? 'var(--success)' : '';
  document.getElementById('nf-incluir-relatorio-box').style.borderColor = incluido ? 'var(--success)' : '';
  document.getElementById('nf-incluir-relatorio-check').style.borderColor = incluido ? 'var(--success)' : '';
  document.getElementById('nf-incluir-relatorio-check').classList.toggle('checked', incluido);
}

function toggleNFAbaterRelatorio(){
  const cb = document.getElementById('nf-abater-relatorio');
  _setNFAbaterRelatorioVisual(!cb.checked);
}

function _setNFAbaterRelatorioVisual(ativo){
  document.getElementById('nf-abater-relatorio').checked = ativo;
  document.getElementById('nf-abater-relatorio-box').style.background = ativo ? 'var(--success)' : '';
  document.getElementById('nf-abater-relatorio-box').style.borderColor = ativo ? 'var(--success)' : '';
  document.getElementById('nf-abater-relatorio-check').style.borderColor = ativo ? 'var(--success)' : '';
  document.getElementById('nf-abater-relatorio-check').classList.toggle('checked', ativo);
}

function _limparNFDevolucao(){
  const cb = document.getElementById('nf-devolvida');
  cb.checked = false;
  document.getElementById('nf-devolvida-box').style.background = '';
  document.getElementById('nf-devolvida-box').style.borderColor = '';
  document.getElementById('nf-devolucao-check').style.borderColor = '';
  document.getElementById('nf-devolucao-numwrap').classList.add('hidden');
  const nd = document.getElementById('nf-nf-devolucao'); if(nd) nd.value='';
  const dd = document.getElementById('nf-data-nf-devolucao'); if(dd) dd.value='';
  _setNFAbaterRelatorioVisual(true);
}

function limparFormNF(){
  document.getElementById('nf-linha-edicao').value='';
  ['nf-data-fat','nf-numero','nf-sqmt','nf-valor-us','nf-comissao-pct','nf-valor-rs','nf-cotacao'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('nfFormTitulo').textContent='Nova NF';
  document.getElementById('nf-comissao-preview').textContent='US$ 0,00';
  _setNFIncluirRelatorioVisual(true);
  _limparNFDevolucao();
}

function atualizarPreviewComissaoNF(){
  const v = parseFloat(document.getElementById('nf-valor-us').value)||0;
  const p = parseFloat(document.getElementById('nf-comissao-pct').value)||0;
  document.getElementById('nf-comissao-preview').textContent = 'US$ '+fmtN(v&&p?v*p/100:0);
}

function autoCalcNFValorRS(){
  const us = parseFloat(document.getElementById('nf-valor-us').value)||0;
  const cotacao = parseFloat(document.getElementById('nf-cotacao').value)||0;
  if(us && cotacao){
    const rsEl = document.getElementById('nf-valor-rs');
    // Só preenche automaticamente se o campo estiver vazio ou se já era um valor calculado
    // (não sobrescreve edição manual — o usuário pode ajustar depois)
    rsEl.value = (us * cotacao).toFixed(2);
  }
}

function salvarNFModal(){
  const numeroProforma = document.getElementById('nf-proforma-atual').value;
  const payload = {
    linha: document.getElementById('nf-linha-edicao').value || null,
    empresa: document.getElementById('nf-empresa-atual').value,
    numero_proforma: numeroProforma,
    numero_nf: document.getElementById('nf-numero').value.trim(),
    data_faturamento: isoParaBR(document.getElementById('nf-data-fat').value),
    valor_rs: parseFloat(document.getElementById('nf-valor-rs').value)||0,
    cotacao: parseFloat(document.getElementById('nf-cotacao').value)||0,
    valor_us: parseFloat(document.getElementById('nf-valor-us').value)||0,
    sqmt: parseFloat(document.getElementById('nf-sqmt').value)||0,
    comissao_pct: parseFloat(document.getElementById('nf-comissao-pct').value)||0,
    devolvida: document.getElementById('nf-devolvida').checked,
    nf_devolucao: document.getElementById('nf-nf-devolucao').value.trim(),
    data_nf_devolucao: isoParaBR(document.getElementById('nf-data-nf-devolucao').value||''),
    incluir_relatorio: document.getElementById('nf-incluir-relatorio').checked,
    abater_relatorio: document.getElementById('nf-abater-relatorio').checked,
  };
  if(!payload.numero_nf){ showToast('Informe o Nº da NF','error'); return; }
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){
      showToast('NF salva','success'); ocultarFormNF(); carregarNFs(numeroProforma);
      const reg = CONTROLE.find(x=>x.numero_proforma===numeroProforma); if(reg) reg.faturado='SIM';
      _atualizarHistoricoLocal(numeroProforma, d.historico);
    } else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarNF(JSON.stringify(payload));
}

function excluirNFModal(linha){
  const numeroProforma = document.getElementById('nf-proforma-atual').value;
  if(!confirm('Excluir esta NF?')) return;
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){
      showToast('NF excluída','success'); carregarNFs(numeroProforma);
      const restantes = nfListaAtual.filter(n=>n.linha!==linha);
      const reg = CONTROLE.find(x=>x.numero_proforma===numeroProforma); if(reg) reg.faturado = restantes.length ? 'SIM' : 'NÃO';
      _atualizarHistoricoLocal(numeroProforma, d.historico);
    }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).excluirNF(linha, numeroProforma);
}
