// ============================================================
// UTILITÁRIOS usados em todo o app
// ============================================================

// Número no formato brasileiro com 2 casas (1.234,56)
function fmtN(n){return isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtUS(n){return'US$ '+fmtN(n);}
function fmtPct(n){return fmtN(n)+'%';}

// Comissão: distingue "nada digitado" (null/undefined) de "zero digitado de fato".
function fmtComissaoPct(raw){ return (raw===null||raw===undefined) ? '-,-' : fmtN(raw)+'%'; }
function fmtComissaoUS(raw, valor){ return (raw===null||raw===undefined) ? 'US$ -,-' : fmtUS(valor||0); }
function fmtComissaoRS(raw, valor){ return (raw===null||raw===undefined) ? 'R$ -,-' : 'R$ '+fmtN(valor||0); }

// Datas: 2026-05-01 <-> 01/05/2026
function isoParaBR(iso){if(!iso)return'';const[y,m,d]=iso.split('-');return d+'/'+m+'/'+y;}
function brParaIsoCtrl(br){if(!br)return'';const p=br.split('/');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:'';}
function isoParaBrCtrl(iso){if(!iso)return'';const p=iso.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'';}

// Escapa texto para inserir com segurança dentro de HTML
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// Mostra/esconde modais que usam a classe .hidden
function abrirModal(id){document.getElementById(id).classList.remove('hidden');}
function fecharModal(id){document.getElementById(id).classList.add('hidden');}

function showToast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(type||'');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),3200);}
