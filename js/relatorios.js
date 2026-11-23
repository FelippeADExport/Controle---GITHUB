// ============================================================
// ABA RELATÓRIOS: troca de sub-aba (Vendas / Controle / Metas)
// e o Relatório de Vendas
// ============================================================

let PEDIDOS=[]; // usado só nas sugestões de país do Relatório de Vendas
let lastRelData=null,detPedidosFiltrados=[],detPagAtual=1;
const DET_POR_PAGINA=15;
let incluirPedidosPdf=false,relTabelaFiltro='';

function switchRelTab(tab){
  const abas = {vendas:['subRelVendasBtn','subRelVendas'], controle:['subRelControleBtn','subRelControle'], metas:['subRelMetasBtn','subRelMetas']};
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

// ═══ RELATÓRIO DE VENDAS ═══
function initRelatorio(){
  const now=new Date(),pad=n=>String(n).padStart(2,'0');
  if(!document.getElementById('relDataIni').value){
    document.getElementById('relDataIni').value=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-01';
    document.getElementById('relDataFim').value=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
  }
}

// Filtros: cliente, país, tabela de preço
function relClienteInput(q){
  const dd=document.getElementById('relClienteDropdown'),v=(q||'').toLowerCase().trim();
  const m=v?CLIENTS.filter(c=>(c.nome||'').toLowerCase().includes(v)||(c.id||'').toLowerCase().includes(v)):CLIENTS.slice(0,10);
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.slice(0,10).map(c=>`<div class="autocomplete-item" onmousedown="relClienteSelect('${esc(c.nome.replace(/'/g,"\\'"))}')"><strong>${esc(c.nome)}</strong><small>${esc(c.id||'')} · ${esc(c.pais||'')}</small></div>`).join('');
  dd.classList.remove('hidden');
}
function relClienteSelect(n){document.getElementById('relFiltroCliente').value=n;document.getElementById('relClienteDropdown').classList.add('hidden');atualizarChipsFiltros();}
function relPaisInput(q){
  const dd=document.getElementById('relPaisDropdown'),v=(q||'').toLowerCase().trim();
  const p=[...new Set(PEDIDOS.map(x=>x.pais).filter(Boolean))].sort();
  const m=v?p.filter(x=>x.toLowerCase().includes(v)):p;
  if(!m.length){dd.classList.add('hidden');return;}
  dd.innerHTML=m.slice(0,10).map(x=>`<div class="autocomplete-item" onmousedown="relPaisSelect('${esc(x.replace(/'/g,"\'"))}')"><strong>${esc(x)}</strong></div>`).join('');
  dd.classList.remove('hidden');
}
function relPaisSelect(p){document.getElementById('relFiltroPais').value=p;document.getElementById('relPaisDropdown').classList.add('hidden');atualizarChipsFiltros();}
document.addEventListener('click',e=>{
  if(!e.target.closest('#relFiltroCliente')&&!e.target.closest('#relClienteDropdown'))document.getElementById('relClienteDropdown')?.classList.add('hidden');
  if(!e.target.closest('#relFiltroPais')&&!e.target.closest('#relPaisDropdown'))document.getElementById('relPaisDropdown')?.classList.add('hidden');
});
function setRelTabela(v){
  relTabelaFiltro=v;
  document.getElementById('relTabBtnTodos').classList.toggle('active',v==='');
  document.getElementById('relTabBtnFOB').classList.toggle('active',v==='FOB');
  document.getElementById('relTabBtnEXW').classList.toggle('active',v==='EXW');
  atualizarChipsFiltros();
}

function atualizarChipsFiltros(){
  const cli=document.getElementById('relFiltroCliente').value.trim(),pais=document.getElementById('relFiltroPais').value.trim(),tab=relTabelaFiltro,chips=[];
  const chip=(rotulo,valor,campo)=>`<div class="rel-filter-chip">${rotulo}: ${esc(valor)}<button onmousedown="limparFiltro('${campo}')" title="Remover filtro" aria-label="Remover filtro">×</button></div>`;
  if(cli)chips.push(chip('Cliente',cli,'cliente'));
  if(pais)chips.push(chip('País',pais,'pais'));
  if(tab)chips.push(chip('Tabela',tab,'tabela'));
  document.getElementById('relActiveFilters').innerHTML=chips.join('');
}
function limparFiltro(c){
  if(c==='cliente')document.getElementById('relFiltroCliente').value='';
  if(c==='pais')document.getElementById('relFiltroPais').value='';
  if(c==='tabela'){setRelTabela('');return;}
  atualizarChipsFiltros();
}
function limparFiltros(){document.getElementById('relFiltroCliente').value='';document.getElementById('relFiltroPais').value='';setRelTabela('');atualizarChipsFiltros();}

function setRelPeriodo(tipo,e){
  document.querySelectorAll('.rel-shortcut-btn').forEach(b=>b.classList.remove('active-shortcut'));
  if(e&&e.target)e.target.classList.add('active-shortcut');
  const now=new Date(),pad=n=>String(n).padStart(2,'0'),toISO=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  let ini,fim=new Date();
  if(tipo==='hoje')ini=new Date();
  else if(tipo==='semana'){ini=new Date();ini.setDate(ini.getDate()-ini.getDay()+1);}
  else if(tipo==='mes')ini=new Date(now.getFullYear(),now.getMonth(),1);
  else if(tipo==='trimestre'){const q=Math.floor(now.getMonth()/3);ini=new Date(now.getFullYear(),q*3,1);}
  else if(tipo==='ano')ini=new Date(now.getFullYear(),0,1);
  else ini=new Date(2020,0,1);
  document.getElementById('relDataIni').value=toISO(ini);
  document.getElementById('relDataFim').value=toISO(fim);
}

function gerarRelatorio(){
  const ini=document.getElementById('relDataIni').value,fim=document.getElementById('relDataFim').value;
  if(!ini||!fim){showToast('Selecione o período','error');return;}
  if(ini>fim){showToast('Data inicial maior que final','error');return;}
  const fC=document.getElementById('relFiltroCliente').value.trim(),fP=document.getElementById('relFiltroPais').value.trim(),fT=relTabelaFiltro;
  const btn=document.getElementById('btnGerarRel');
  btn.disabled=true;btn.textContent='Gerando...';
  document.getElementById('relLoading').classList.remove('hidden');
  document.getElementById('relEmpty').classList.add('hidden');
  document.getElementById('relResultado').classList.add('hidden');
  const fim_=()=>{btn.disabled=false;btn.textContent='Gerar relatório';document.getElementById('relLoading').classList.add('hidden');};
  google.script.run.withSuccessHandler(r=>{
    fim_();
    const d=JSON.parse(r);
    if(!d.success){showToast('Erro: '+d.error,'error');return;}
    if(d.vazio){document.getElementById('relEmpty').classList.remove('hidden');return;}
    lastRelData=d;renderRelatorio(d);
    document.getElementById('relPdfResultBox').classList.add('hidden');
  }).withFailureHandler(e=>{fim_();showToast('Erro: '+e.message,'error');}).getRelatorio(isoParaBR(ini),isoParaBR(fim),fC,fP,fT,'');
}

function renderRelatorio(d){
  document.getElementById('relResultado').classList.remove('hidden');
  document.getElementById('relPeriodoBadge').textContent=d.periodo.ini+' → '+d.periodo.fim;
  const f=d.filtros||{};
  document.getElementById('relFiltrosAtivosDisplay').textContent=[f.cliente?'Cliente: '+f.cliente:'',f.pais?'País: '+f.pais:'',f.tabela?'Tabela: '+f.tabela:''].filter(Boolean).join(' · ');
  const k=d.kpis;
  document.getElementById('kpiTotal').textContent=fmtUS(k.total_faturado);
  document.getElementById('kpiTotalSub').textContent=k.qtd_pedidos+' pedido'+(k.qtd_pedidos!==1?'s':'');
  document.getElementById('kpiQtd').textContent=k.qtd_pedidos;
  document.getElementById('kpiTicket').textContent=fmtUS(k.ticket_medio);
  document.getElementById('kpiDesconto').textContent=fmtUS(k.total_desconto);
  document.getElementById('kpiDescontoSub').textContent=fmtPct(k.total_faturado>0?(k.total_desconto/k.total_faturado*100):0)+' do faturado';
  const fo=d.por_tabela.FOB,ex=d.por_tabela.EXW,tt=(fo.valor||0)+(ex.valor||0)||1;
  document.getElementById('fobValor').textContent=fmtUS(fo.valor||0);
  document.getElementById('fobQtd').textContent=(fo.qtd||0)+' pedido'+((fo.qtd||0)!==1?'s':'');
  document.getElementById('exwValor').textContent=fmtUS(ex.valor||0);
  document.getElementById('exwQtd').textContent=(ex.qtd||0)+' pedido'+((ex.qtd||0)!==1?'s':'');
  const fp=(fo.valor||0)/tt*100,ep=(ex.valor||0)/tt*100;
  document.getElementById('fobBar').style.width=fp+'%';document.getElementById('exwBar').style.width=ep+'%';
  document.getElementById('fobPerc').textContent=fmtPct(fp);document.getElementById('exwPerc').textContent=fmtPct(ep);
  const mP=d.ranking_paises.length?d.ranking_paises[0].valor:1;
  document.getElementById('barPaises').innerHTML=d.ranking_paises.slice(0,7).map(p=>`<div class="bar-row"><div class="bar-label"><span>${esc(p.pais||'—')} <span class="muted">${p.qtd} ped.</span></span><span>${fmtUS(p.valor)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${(p.valor/mP*100).toFixed(1)}%"></div></div></div>`).join('');
  document.getElementById('relPaisesBadge').textContent=d.ranking_paises.length+' países';
  document.getElementById('relClientesBadge').textContent='top '+d.ranking_clientes.length;
  document.getElementById('rankClientes').innerHTML=d.ranking_clientes.map((c,i)=>`<tr><td class="rank-pos ${i<3?'top':''}">${i+1}</td><td><div class="rank-name">${esc(c.nome)}</div><div class="rank-sub">${esc(c.pais||'—')} · ${c.qtd} pedido${c.qtd!==1?'s':''}</div></td><td class="num"><div class="rank-val">${fmtUS(c.valor)}</div></td></tr>`).join('');
  document.getElementById('relProdutosBadge').textContent='top '+d.ranking_produtos.length;
  document.getElementById('rankProdutos').innerHTML=d.ranking_produtos.length?d.ranking_produtos.map((p,i)=>`<tr><td class="rank-pos ${i<3?'top':''}">${i+1}</td><td><div class="rank-name">${esc(p.nome)}</div><div class="rank-sub">${esc(p.formato)} · ${p.qtd_pedidos} pedido${p.qtd_pedidos!==1?'s':''}</div></td><td class="num"><div class="rank-val">${fmtUS(p.valor)}</div><div class="rank-qty">${fmtN(p.m2)} m²</div></td></tr>`).join(''):'<tr><td colspan="3" class="vazio">Sem dados</td></tr>';
  renderBarChart(d.serie_mensal);
  document.getElementById('relMensalBadge').textContent=d.serie_mensal.length+' mês'+(d.serie_mensal.length!==1?'es':'');
  document.getElementById('cardMensal').style.display=d.serie_mensal.length<2?'none':'';
  renderTabelaDet(d.pedidos_detalhados||[]);
}

// Tabela "Pedidos do período" (paginada)
function renderTabelaDet(lista){detPedidosFiltrados=lista;detPagAtual=1;document.getElementById('detBusca').value='';document.getElementById('relPedidosDetBadge').textContent=lista.length+' pedido'+(lista.length!==1?'s':'');renderPaginaDet();}
function filtrarTabelaDet(){
  const q=document.getElementById('detBusca').value.toLowerCase().trim(),base=lastRelData?(lastRelData.pedidos_detalhados||[]):[];
  detPedidosFiltrados=q?base.filter(p=>p.numero.toLowerCase().includes(q)||(p.cliente_nome||'').toLowerCase().includes(q)||(p.pais||'').toLowerCase().includes(q)||(p.tabela_preco||'').toLowerCase().includes(q)):base;
  detPagAtual=1;renderPaginaDet();
}
function renderPaginaDet(){
  const total=detPedidosFiltrados.length,paginas=Math.ceil(total/DET_POR_PAGINA)||1;
  detPagAtual=Math.min(Math.max(detPagAtual,1),paginas);
  const ini=(detPagAtual-1)*DET_POR_PAGINA,fim=Math.min(ini+DET_POR_PAGINA,total),slice=detPedidosFiltrados.slice(ini,fim);
  const tbody=document.getElementById('detTbody');
  if(!slice.length){tbody.innerHTML=`<tr><td colspan="7" class="vazio">Nenhum resultado</td></tr>`;}
  else tbody.innerHTML=slice.map(p=>{
    const isR=/\-R\d+$/.test(p.numero),tc=`<span class="chip ${p.tabela_preco==='FOB'?'chip-accent':''}">${esc(p.tabela_preco||'—')}</span>`;
    return`<tr><td><span class="pdn ${isR?'rev':''}">${esc(p.numero)}</span>${isR?'<span class="chip chip-warn">Rev.</span>':''}</td><td class="muted">${esc(p.data_pedido||'—')}</td><td class="forte">${esc(p.cliente_nome||'—')}</td><td>${esc(p.pais||'—')}</td><td>${tc}</td><td class="num pdv">US$ ${fmtN(p.valor_total)}</td><td class="num txt-perigo">${p.desconto_valor>0?'−US$ '+fmtN(p.desconto_valor):'—'}</td></tr>`;
  }).join('');
  document.getElementById('detPagInfo').textContent=`Exibindo ${total?ini+1:0}–${fim} de ${total} pedido${total!==1?'s':''}`;
  const bW=document.getElementById('detPagBtns');
  let h=`<button class="det-pag-btn" onclick="irParaPagDet(${detPagAtual-1})" ${detPagAtual<=1?'disabled':''}>‹ Ant.</button>`;
  const vs=2,start=Math.max(1,detPagAtual-vs),end=Math.min(paginas,detPagAtual+vs);
  if(start>1)h+=`<button class="det-pag-btn" onclick="irParaPagDet(1)">1</button>${start>2?'<span class="muted">…</span>':''}`;
  for(let i=start;i<=end;i++)h+=`<button class="det-pag-btn ${i===detPagAtual?'active':''}" onclick="irParaPagDet(${i})">${i}</button>`;
  if(end<paginas)h+=`${end<paginas-1?'<span class="muted">…</span>':''}<button class="det-pag-btn" onclick="irParaPagDet(${paginas})">${paginas}</button>`;
  h+=`<button class="det-pag-btn" onclick="irParaPagDet(${detPagAtual+1})" ${detPagAtual>=paginas?'disabled':''}>Próx. ›</button>`;
  bW.innerHTML=h;
}
function irParaPagDet(p){detPagAtual=p;renderPaginaDet();document.getElementById('cardPedidosDet').scrollIntoView({behavior:'smooth',block:'nearest'});}

function toggleIncluirPedidos(){
  incluirPedidosPdf=!incluirPedidosPdf;
  document.getElementById('chkIncluirPedidos').checked=incluirPedidosPdf;
}

// Gráfico de barras "Evolução mensal" (SVG)
function renderBarChart(serie){
  if(!serie||!serie.length)return;
  const wrap=document.getElementById('chartWrap');
  const maxV=Math.max(...serie.map(s=>s.valor),1);
  const H=180,PL=70,PB=34,PT=14,PR=16;
  const W=wrap.clientWidth||500,cW=W-PL-PR,cH=H-PT-PB;
  const bW=Math.min(40,cW/serie.length-6),sp=cW/serie.length;
  const yL=[0,.25,.5,.75,1].map(f=>({y:PT+cH-f*cH,val:maxV*f}));
  const fs=n=>n>=1000000?fmtN(n/1000000)+'M':n>=1000?fmtN(n/1000)+'k':fmtN(n);
  const lm=m=>{const[y,mo]=m.split('-');return['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+mo-1]+(serie.length>12?' '+y.slice(2):'');};
  const FONTE='Segoe UI,system-ui,sans-serif';
  const bars=serie.map((s,i)=>{const bh=(s.valor/maxV)*cH,bx=PL+i*sp+sp/2-bW/2,by=PT+cH-bh;return`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bW}" height="${bh.toFixed(1)}" rx="3" fill="var(--accent)" opacity=".85"/><text x="${(bx+bW/2).toFixed(1)}" y="${(PT+cH+18).toFixed(1)}" text-anchor="middle" fill="var(--text3)" font-size="10" font-family="${FONTE}">${lm(s.mes)}</text>`;}).join('');
  const grid=yL.map(l=>`<line x1="${PL}" y1="${l.y.toFixed(1)}" x2="${W-PR}" y2="${l.y.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/><text x="${(PL-6).toFixed(1)}" y="${(l.y+4).toFixed(1)}" text-anchor="end" fill="var(--text3)" font-size="10" font-family="${FONTE}">${fs(l.val)}</text>`).join('');
  wrap.innerHTML=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${grid}${bars}</svg>`;
}

function exportarPdfRelatorio(){
  if(!lastRelData){showToast('Gere um relatório primeiro','error');return;}
  const dados=Object.assign({},lastRelData,{incluir_pedidos:incluirPedidosPdf,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Sao_Paulo'});
  const btn=document.getElementById('btnRelPdf');
  btn.disabled=true;btn.textContent='Gerando PDF...';
  document.getElementById('relPdfResultBox').classList.add('hidden');
  showToast('Gerando PDF do relatório...','');
  const fim=()=>{btn.disabled=false;btn.textContent='Exportar PDF do relatório';};
  google.script.run.withSuccessHandler(r=>{
    fim();
    const d=JSON.parse(r);
    if(d.success){
      document.getElementById('relPdfResultBox').classList.remove('hidden');
      document.getElementById('relPdfNome').textContent=d.nome;
      document.getElementById('relPdfLink').href=d.url;
      showToast('PDF do relatório salvo','success');
    } else showToast('Erro: '+d.error,'error');
  }).withFailureHandler(e=>{fim();showToast('Erro: '+e.message,'error');}).gerarPdfRelatorio(JSON.stringify(dados));
}
