// ============================================================
// ABA ALERTAS: pagamentos vencidos (sem data de pagamento e
// com data prevista já passada)
// ============================================================
let notifDismissed = new Set();

function _parseDataBR(s){
  if(!s)return null;
  const p=s.split('/');
  if(p.length!==3)return null;
  const d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
  return isNaN(d)?null:d;
}

function calcularAlertas(){
  const hoje=new Date();hoje.setHours(0,0,0,0);
  return (CONTROLE||[])
    .filter(r=>{
      if(r.data_pagamento) return false;
      if(!r.data_prev_pagamento) return false;
      if(notifDismissed.has(r.numero_proforma)) return false;
      const prev=_parseDataBR(r.data_prev_pagamento);
      if(!prev) return false;
      return prev < hoje; // apenas vencidos
    })
    .map(r=>{
      const prev=_parseDataBR(r.data_prev_pagamento);
      const diffDias=prev?Math.round((prev-hoje)/(1000*60*60*24)):0;
      return{id:r.numero_proforma,cliente:r.cliente_nome||'—',proforma:r.numero_proforma||'—',
        numero_ad:r.numero_ad||'—',data_prev:r.data_prev_pagamento,
        diffDias,diasVencido:Math.abs(diffDias),status:r.status||'',valor:r.valor||0};
    })
    .sort((a,b)=>a.diffDias-b.diffDias);
}

function atualizarBadgeNotif(){
  const alertas=calcularAlertas();
  const badge=document.getElementById('tabNotifCount');
  if(!badge)return;
  if(alertas.length>0){badge.textContent=alertas.length;badge.style.display='inline-block';}
  else badge.style.display='none';
}

function _textoVencidos(n){ return n+' pagamento'+(n!==1?'s':'')+' vencido'+(n!==1?'s':''); }

function renderNotificacoes(){
  const alertas=calcularAlertas();
  const lista=document.getElementById('notifLista');
  const empty=document.getElementById('notifEmpty');
  const sub=document.getElementById('notifSubtitle');
  if(!alertas.length){
    sub.textContent='Nenhum pagamento vencido';
    lista.innerHTML='';
    empty.classList.remove('hidden');
    atualizarBadgeNotif();
    return;
  }
  empty.classList.add('hidden');
  sub.textContent=_textoVencidos(alertas.length);
  lista.innerHTML=alertas.map(a=>`
    <div class="notif-card" id="notif-${esc(a.id)}">
      <div class="notif-info">
        <div class="notif-titulo">${esc(a.cliente)} <span class="muted">· ${esc(a.proforma)}</span></div>
        <div class="notif-detalhes">
          ${a.numero_ad&&a.numero_ad!=='—'?`<strong>Pedido AD:</strong> ${esc(a.numero_ad)} &nbsp;·&nbsp; `:''}
          <strong>Prev. pgto:</strong> ${esc(a.data_prev)}
          ${a.status?` &nbsp;·&nbsp; <strong>Status:</strong> ${esc(a.status)}`:''}
          ${a.valor?` &nbsp;·&nbsp; <strong>${fmtUS(a.valor)}</strong>`:''}
        </div>
        <span class="chip chip-danger">Vencido há ${a.diasVencido} dia${a.diasVencido!==1?'s':''}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="dispensarNotif('${esc(a.id)}')" title="Dispensar este alerta">Dispensar</button>
    </div>`
  ).join('');
  atualizarBadgeNotif();
}

function dispensarNotif(id){
  notifDismissed.add(id);
  const el=document.getElementById('notif-'+id);
  if(el) el.remove();
  const rest=calcularAlertas();
  const sub=document.getElementById('notifSubtitle');
  if(!rest.length){
    if(sub)sub.textContent='Nenhum pagamento vencido';
    const emp=document.getElementById('notifEmpty');if(emp)emp.classList.remove('hidden');
  } else {
    if(sub)sub.textContent=_textoVencidos(rest.length);
  }
  atualizarBadgeNotif();
}

function limparNotificacoes(){
  (CONTROLE||[]).forEach(r=>notifDismissed.add(r.numero_proforma));
  renderNotificacoes();
  atualizarBadgeNotif();
  showToast('Alertas limpos','success');
}
