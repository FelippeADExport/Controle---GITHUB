// ============================================================
// ABA CONFIGURAÇÕES: links (planilhas e pastas), manutenção
// e aparência (salva só neste navegador)
// ============================================================

// ═══ LINKS (Banco de Dados, Clientes, Pastas) ═══
const CFG_CAMPOS = [
  {campo:'bancoDados', label:'Planilha "Banco de Dados" (Controle / NF / Resumo / Analytics)'},
  {campo:'bancoClientes', label:'Planilha "Banco de Clientes"'},
  {campo:'bancoMetas', label:'Planilha "Banco de Metas" (Metas / Realizado Manual). Opcional: se vazio, usa o Banco de Dados'},
  {campo:'bancoPagamentos', label:'Planilha "Cobranças AD" (aba Pagos Realizados): base de comissão e pagamentos recebidos'},
  {campo:'pastaProformas', label:'Pasta do Drive: Proformas / Invoices'},
  {campo:'pastaRelatorios', label:'Pasta do Drive: PDFs e XLSX de relatório'},
  {campo:'pastaPedidosAD', label:'Pasta do Drive: PDFs de pedido AD'},
];
let CFG_LINKS_ATUAIS = {};

function carregarConfiguracoes(){
  const elStatus = document.getElementById('configStatus');
  if(elStatus) elStatus.textContent = 'Carregando...';
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){
      CFG_LINKS_ATUAIS = d.data||{};
      _renderCfgLinks();
      if(elStatus) elStatus.textContent='Carregado';
    } else if(elStatus) elStatus.textContent='Erro';
  }).withFailureHandler(()=>{ if(elStatus) elStatus.textContent='Erro'; }).getConfigLinks();
}

function _renderCfgLinks(){
  const wrap = document.getElementById('cfgLinksWrap'); if(!wrap) return;
  wrap.innerHTML = CFG_CAMPOS.map(c => {
    const valorAtual = CFG_LINKS_ATUAIS[c.campo]||'';
    const statusHtml = valorAtual
      ? `<div class="cfg-link-status ok">Configurado (ID: ${esc(valorAtual.slice(0,18))}...)</div>`
      : `<div class="cfg-link-status empty">Não configurado: esta área ficará vazia até salvar um link</div>`;
    return `<div class="cfg-campo">
      <label for="cfgLink_${c.campo}">${c.label}</label>
      <div class="cfg-link-row">
        <input type="text" id="cfgLink_${c.campo}" placeholder="Cole o link completo ou o ID">
        <button class="btn btn-primary btn-sm" onclick="salvarCfgLink('${c.campo}')">Salvar</button>
        <button class="btn btn-danger btn-sm" onclick="limparCfgLink('${c.campo}')">Limpar</button>
      </div>
      ${statusHtml}
    </div>`;
  }).join('');
}

function salvarCfgLink(campo){
  const input = document.getElementById('cfgLink_'+campo);
  const valor = input.value.trim();
  if(!valor){ showToast('Cole um link antes de salvar','warn'); return; }
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){ showToast('Link salvo','success'); input.value=''; carregarConfiguracoes(); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).salvarConfigLink(campo, valor);
}
function limparCfgLink(campo){
  if(!confirm('Remover este link salvo? A área correspondente ficará vazia até você salvar um novo link.')) return;
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){ showToast('Link removido','success'); carregarConfiguracoes(); }
    else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>showToast('Erro: '+e.message,'error')).limparConfigLink(campo);
}

// ═══ MANUTENÇÃO ═══
function migrarValorRSNFs(){
  const el = document.getElementById('migrarRSResultado');
  el.innerHTML = '<div class="resultado muted">Processando todas as NFs...</div>';
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(d.success){
      el.innerHTML = `<div class="resultado ${d.atualizadas>0?'ok':'muted'}">${d.atualizadas} NF(s) atualizadas com Valor R$ calculado automaticamente. ${d.semDados} NF(s) sem cotação (mantidas como estão).</div>`;
    } else {
      el.innerHTML = `<div class="resultado erro">Erro: ${esc(d.error)}</div>`;
    }
  }).withFailureHandler(e=>{
    el.innerHTML = `<div class="resultado erro">Erro: ${esc(e.message)}</div>`;
  }).migrarValorRSNFsLote();
}

function verificarDuplicados(){
  const el = document.getElementById('duplicadosResultado');
  el.innerHTML = '<div class="resultado muted">Verificando...</div>';
  google.script.run.withSuccessHandler(r=>{
    const d = JSON.parse(r);
    if(!d.success){ el.innerHTML = '<div class="resultado erro">Erro: '+esc(d.error)+'</div>'; return; }
    if(!d.duplicadas.length){
      el.innerHTML = '<div class="resultado ok">Nenhuma proforma duplicada encontrada em '+d.totalLinhas+' linha(s).</div>';
      return;
    }
    el.innerHTML = '<div class="resultado aviso-txt">'+d.duplicadas.length+' proforma(s) duplicada(s) encontrada(s):</div>'
      + d.duplicadas.map(x=>'<div class="duplicada"><strong>'+esc(x.proforma)+'</strong>: aparece nas linhas '+x.linhas.join(', ')+'</div>').join('');
  }).withFailureHandler(e=>{
    el.innerHTML = '<div class="resultado erro">Erro: '+esc(e.message)+'</div>';
  }).verificarProformasDuplicadas();
}

// ═══ APARÊNCIA ═══
const APARENCIA_DEFAULTS={'navbar-fs':13,'navbar-clr':null,'body-fs':14,'body-clr':null,'table-fs':13,'table-th-clr':null,'table-td-clr':null,'btn-fs':14,'btn-clr':null};
const APARENCIA_CORES_DARK ={'navbar-clr':'#a9b0b8','body-clr':'#e3e6e9','table-th-clr':'#a9b0b8','table-td-clr':'#e3e6e9','btn-clr':'#ffffff'};
const APARENCIA_CORES_LIGHT={'navbar-clr':'#4b535c','body-clr':'#1d2125','table-th-clr':'#4b535c','table-td-clr':'#1d2125','btn-clr':'#ffffff'};

function _aplicarAparenciaCSS(k,v){
  const r=document.documentElement;
  const prop={'navbar-fs':'--fs-navbar','navbar-clr':'--clr-navbar','body-fs':'--fs-body','body-clr':'--clr-body','table-fs':'--fs-table','table-th-clr':'--clr-table-th','table-td-clr':'--clr-table-td','btn-fs':'--fs-btn','btn-clr':'--clr-btn'}[k];
  if(!prop)return;
  if(v===null||v===undefined){r.style.removeProperty(prop);}
  else{r.style.setProperty(prop,k.endsWith('-fs')?v+'px':v);}
}
function _lerAparencia(){const s=localStorage.getItem('adexport_aparencia_ctrl');return s?JSON.parse(s):{...APARENCIA_DEFAULTS};}
function initAparencia(){const cfg=_lerAparencia();Object.keys(cfg).forEach(k=>_aplicarAparenciaCSS(k,cfg[k]));_syncAparenciaUI(cfg);}
function _coresAtivas(){const isLight=(localStorage.getItem('adexport_theme')||'dark')==='light';return isLight?APARENCIA_CORES_LIGHT:APARENCIA_CORES_DARK;}
function _syncAparenciaUI(cfg){
  const tc=_coresAtivas();
  const getClr=k=>cfg[k]||tc[k]||'#ffffff';
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val;};
  const txt=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  const nc=getClr('navbar-clr'); set('navbarClr',nc); txt('navbarClrVal',nc); txt('navbarFsVal',(cfg['navbar-fs']||13)+'px');
  const bc=getClr('body-clr'); set('bodyClr',bc); txt('bodyClrVal',bc); txt('bodyFsVal',(cfg['body-fs']||14)+'px');
  const thc=getClr('table-th-clr'); const tdc=getClr('table-td-clr');
  set('tableThClr',thc); txt('tableThClrVal',thc); set('tableTdClr',tdc); txt('tableTdClrVal',tdc); txt('tableFsVal',(cfg['table-fs']||13)+'px');
  const bnc=getClr('btn-clr'); set('btnClr',bnc); txt('btnClrVal',bnc); txt('btnFsVal',(cfg['btn-fs']||14)+'px');
}
function ajustarFonte(alvo,delta){
  const cfg=_lerAparencia();const k=alvo+'-fs';
  const cur=parseInt(cfg[k])||parseInt(APARENCIA_DEFAULTS[k])||14;
  const novo=Math.max(8,Math.min(24,cur+delta));
  cfg[k]=novo;_aplicarAparenciaCSS(k,novo);_syncAparenciaUI(cfg);
  localStorage.setItem('adexport_aparencia_ctrl',JSON.stringify(cfg));
}
function aplicarCor(alvo,valor){
  const cfg=_lerAparencia();const k=alvo+'-clr';cfg[k]=valor;_aplicarAparenciaCSS(k,valor);
  const lm={'navbar':'navbarClrVal','body':'bodyClrVal','table-th':'tableThClrVal','table-td':'tableTdClrVal','btn':'btnClrVal'};
  const lbl=document.getElementById(lm[alvo]);if(lbl)lbl.textContent=valor;
  localStorage.setItem('adexport_aparencia_ctrl',JSON.stringify(cfg));
}
function salvarAparencia(){
  const cfg=_lerAparencia();localStorage.setItem('adexport_aparencia_ctrl',JSON.stringify(cfg));
  const info=document.getElementById('aparenciaInfo');if(info)info.style.display='block';
  document.getElementById('aparenciaStatus').textContent='Salvo';
  setTimeout(()=>{if(info)info.style.display='none';},3000);
  showToast('Aparência salva','success');
}
function resetarAparencia(){
  localStorage.removeItem('adexport_aparencia_ctrl');
  const cfg={...APARENCIA_DEFAULTS};
  Object.keys(cfg).forEach(k=>_aplicarAparenciaCSS(k,cfg[k]));
  _syncAparenciaUI(cfg);
  showToast('Aparência restaurada ao padrão','');
}
