// ============================================================
// APP: estado global, tema, carregamento inicial e troca de abas
// ============================================================

// ESTADO
let CLIENTS=[];

// TEMA
function initTheme(){const s=localStorage.getItem('adexport_theme')||'dark';applyTheme(s);}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t==='light'?'light':'');
  // Ícone mostra o tema para o qual o botão vai trocar
  document.getElementById('themeLabel').textContent=t==='light'?'🌙':'☀️';
  const tb=document.getElementById('themeToggle'),dica=t==='light'?'Mudar para tema escuro':'Mudar para tema claro';tb.title=dica;tb.setAttribute('aria-label',dica);
  localStorage.setItem('adexport_theme',t);
}
function toggleTheme(){applyTheme((localStorage.getItem('adexport_theme')||'dark')==='light'?'dark':'light');}

// INIT
window.onload=function(){
  initTheme();
  initAparencia();
  // Mostra o app imediatamente, sem esperar os dados
  document.getElementById('loader').style.display='none';
  document.getElementById('app').style.display='block';
  // Modal de Controle só fecha pelo Fechar ou Cancelar: clique fora não fecha (intencional)
  switchTab('controle');
  // Carrega clientes em segundo plano (não bloqueia)
  loadClients();
};

// CARREGAMENTO DE DADOS (planilha)
function loadClients(){return new Promise(res=>{google.script.run.withSuccessHandler(r=>{try{const d=JSON.parse(r);if(d.success)CLIENTS=d.data;}catch(e){}res();}).withFailureHandler(()=>res()).getClientes();});}

// Botão "Atualizar": recarrega clientes e o Controle
function refreshAll(){
  const btn=document.getElementById('btnRefresh');
  const fim=()=>{btn.disabled=false;btn.classList.remove('girando');};
  btn.disabled=true;btn.classList.add('girando');
  Promise.all([loadClients()])
    .then(()=>{loadControle();fim();showToast('Dados atualizados','success');})
    .catch(e=>{fim();showToast('Erro: '+e,'error');});
}
setInterval(()=>{loadClients().catch(()=>{});},10*60*1000);

// ABAS
function switchTab(t){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
  const tabEl=document.getElementById('tab-'+t);
  const btnEl=document.getElementById('tab-'+t+'-btn');
  if(tabEl)tabEl.classList.add('active');
  if(btnEl)btnEl.classList.add('active');
  if(t==='relatorio'){initRelatorio();switchRelTab('vendas');}
  if(t==='controle')loadControle();
  if(t==='notif')renderNotificacoes();
  if(t==='config'){_syncAparenciaUI(_lerAparencia());carregarConfiguracoes();}
}
