// ============================================================
// ABA CONTROLE: barra "Colunas" (exibir/ocultar, reordenar)
// e posição das colunas congeladas
// ============================================================

// Estado persistente dos toggles, salvo em localStorage por NOME da coluna
// (mais seguro que por índice, pois sobrevive a reordenações de colunas).
const COL_TOGGLE_STORAGE_KEY = 'adexport_col_toggle_v1';
function _carregarColToggleStorage(){
  try { return JSON.parse(localStorage.getItem(COL_TOGGLE_STORAGE_KEY)) || {mar:{}, rod:{}, amo:{}, nin:{}}; }
  catch(e){ return {mar:{}, rod:{}, amo:{}, nin:{}}; }
}
function _salvarColToggleStorage(){
  try { localStorage.setItem(COL_TOGGLE_STORAGE_KEY, JSON.stringify(_colToggleState)); } catch(e){}
}
const _colToggleState = _carregarColToggleStorage();

// Estado persistente da ORDEM das colunas, por aba — array de data-col na ordem desejada
// (só colunas não-congeladas e de instância única entram aqui; "Ação" duplicado fica de fora).
const COL_ORDER_STORAGE_KEY = 'adexport_col_order_v1';
function _carregarColOrderStorage(){
  try { return JSON.parse(localStorage.getItem(COL_ORDER_STORAGE_KEY)) || {mar:[], rod:[], amo:[], nin:[]}; }
  catch(e){ return {mar:[], rod:[], amo:[], nin:[]}; }
}
function _salvarColOrderStorage(){
  try { localStorage.setItem(COL_ORDER_STORAGE_KEY, JSON.stringify(_colOrderState)); } catch(e){}
}
const _colOrderState = _carregarColOrderStorage();

// Estado (recolhido/expandido) da barra de colunas, por aba — recolhido por padrão
const COL_BAR_COLLAPSED_STORAGE_KEY = 'adexport_col_bar_collapsed_v1';
function _carregarColBarCollapsedStorage(){
  try { return JSON.parse(localStorage.getItem(COL_BAR_COLLAPSED_STORAGE_KEY)) || {}; }
  catch(e){ return {}; }
}
function _salvarColBarCollapsedStorage(){
  try { localStorage.setItem(COL_BAR_COLLAPSED_STORAGE_KEY, JSON.stringify(_colBarCollapsed)); } catch(e){}
}
const _colBarCollapsed = _carregarColBarCollapsedStorage();

const COL_TOGGLE_TABLE_MAP = {mar:'tblMar', rod:'tblRod', amo:'tblAmo', nin:'tblNIN'};
const COL_TOGGLE_BAR_MAP   = {mar:'colToggleMar', rod:'colToggleRod', amo:'colToggleAmo', nin:'colToggleNIN'};

function _reaplicarToggle(tab){
  const tblId = COL_TOGGLE_TABLE_MAP[tab];
  const tbl = document.getElementById(tblId);
  const state = _colToggleState[tab] || (_colToggleState[tab]={});
  if(!tbl) return;
  _aplicarOrdemColunas(tab); // reordena primeiro, depois oculta/exibe pelos índices já reordenados
  tbl.querySelectorAll('thead th').forEach((th,idx)=>{
    const lbl = th.textContent.trim().slice(0,14);
    if(lbl && state[lbl]===false) _toggleColuna(tbl, idx, false);
  });
  _recalcularFreezeOffsets(tbl);
}

// Reordena fisicamente as <th>/<td> da tabela conforme a ordem salva (por data-col).
// Colunas congeladas (col-freeze) nunca se movem; o restante segue a ordem salva,
// e qualquer coluna nova (ainda não salva) é colocada no fim, na posição padrão.
// Guarda a ordem ORIGINAL (vinda do HTML, antes de qualquer reordenação) de cada aba,
// capturada uma única vez. Sem isso, "Restaurar ordem" não tinha pra onde voltar,
// pois a base de comparação acabava sendo a própria ordem já embaralhada.
const _colDefaultOrder = {};
// data-col de TODAS as colunas na ordem do HTML. As linhas recém-desenhadas sempre
// vêm nessa ordem, mesmo quando o cabeçalho já foi reordenado antes.
const _colTodasPadrao = {};

function _aplicarOrdemColunas(tab){
  const tblId = COL_TOGGLE_TABLE_MAP[tab];
  const tbl = document.getElementById(tblId);
  if(!tbl) return;
  const theadRow = tbl.querySelector('thead tr');
  if(!theadRow) return;
  const ths = Array.from(theadRow.children);
  const ordemSalva = _colOrderState[tab] || [];
  const colDe = (th,i) => th.dataset.col || ('_idx'+i);

  if(!_colTodasPadrao[tab]) _colTodasPadrao[tab] = ths.map(colDe);
  // Cada célula nova recebe o data-col da sua coluna, para ser movida pela identidade
  // da coluna (e não pela posição, que muda depois de reordenar o cabeçalho).
  tbl.querySelectorAll('tbody tr').forEach(tr=>{
    if(tr.dataset.colsMarcadas) return;
    Array.from(tr.children).forEach((td,i)=>{ td.dataset.col = _colTodasPadrao[tab][i]; });
    tr.dataset.colsMarcadas = '1';
  });

  const congeladas = [];
  const finais = []; // coluna de Ação final: sempre por último, nunca entra na reordenação
  const moveis = [];
  ths.forEach((th,i)=>{
    const dc = colDe(th,i);
    if(th.classList.contains('col-freeze')) congeladas.push(dc);
    else if(dc.endsWith('-acoes')) finais.push(dc);
    else moveis.push(dc);
  });

  if(!_colDefaultOrder[tab]) _colDefaultOrder[tab] = moveis.slice();
  const padrao = _colDefaultOrder[tab];

  let dataColsAlvo = ordemSalva.filter(dc => moveis.includes(dc));
  // Preenche o que falta na ORDEM PADRÃO original, não na ordem atual da tela
  padrao.forEach(dc=>{ if(moveis.includes(dc) && !dataColsAlvo.includes(dc)) dataColsAlvo.push(dc); });

  const ordemFinal = [...congeladas, ...dataColsAlvo, ...finais];
  const thPorCol = {}; ths.forEach((th,i)=>{ thPorCol[colDe(th,i)] = th; });
  ordemFinal.forEach(dc => { if(thPorCol[dc]) theadRow.appendChild(thPorCol[dc]); });
  tbl.querySelectorAll('tbody tr').forEach(tr=>{
    const tdPorCol = {}; Array.from(tr.children).forEach(td=>{ tdPorCol[td.dataset.col] = td; });
    ordemFinal.forEach(dc => { if(tdPorCol[dc]) tr.appendChild(tdPorCol[dc]); });
  });
}

function _moverColuna(tab, dataCol, direcao){
  // direcao: -1 = mover para a esquerda, +1 = mover para a direita
  const tblId = COL_TOGGLE_TABLE_MAP[tab];
  const tbl = document.getElementById(tblId);
  if(!tbl) return;
  const theadRow = tbl.querySelector('thead tr');
  const ths = Array.from(theadRow.children);
  const moveis = ths.filter(th=>!th.classList.contains('col-freeze')).map(th=>th.dataset.col);

  let ordem = _colOrderState[tab] || [];
  ordem = ordem.filter(dc => moveis.includes(dc));
  moveis.forEach(dc=>{ if(!ordem.includes(dc)) ordem.push(dc); });

  const pos = ordem.indexOf(dataCol);
  const novaPos = pos + direcao;
  if(pos===-1 || novaPos<0 || novaPos>=ordem.length) return; // já está na ponta
  [ordem[pos], ordem[novaPos]] = [ordem[novaPos], ordem[pos]];
  _colOrderState[tab] = ordem;
  _salvarColOrderStorage();
  _reaplicarToggle(tab);
}

function _restaurarOrdemColunas(tab){
  _colOrderState[tab] = [];
  _salvarColOrderStorage();
  _reaplicarToggle(tab);
}

function _initColToggle(tab){
  const barId=COL_TOGGLE_BAR_MAP[tab];
  const tblId=COL_TOGGLE_TABLE_MAP[tab];
  const bar=document.getElementById(barId),tbl=document.getElementById(tblId);
  if(!bar||!tbl)return;
  bar.querySelectorAll('.col-toggle-btn, .col-order-reset, .col-bar-toggle, .col-bar-contents').forEach(b=>b.remove());
  const state=_colToggleState[tab] || (_colToggleState[tab]={});

  // Botão de recolher/expandir a lista de colunas (estado salvo por aba)
  const recolhido = _colBarCollapsed[tab]!==false; // recolhido por padrão
  const btnToggleBar=document.createElement('button');
  btnToggleBar.className='col-bar-toggle';
  btnToggleBar.textContent = (recolhido?'▸':'▾')+' Colunas';
  const contents=document.createElement('div');
  contents.className='col-bar-contents'+(recolhido?' collapsed':'');
  btnToggleBar.onclick=()=>{
    const agoraRecolhido = !contents.classList.contains('collapsed');
    contents.classList.toggle('collapsed', agoraRecolhido);
    btnToggleBar.textContent=(agoraRecolhido?'▸':'▾')+' Colunas';
    _colBarCollapsed[tab]=agoraRecolhido;
    _salvarColBarCollapsedStorage();
  };
  bar.appendChild(btnToggleBar);
  bar.appendChild(contents);

  // Agrupa colunas pelo NOME (ex.: "Ação" aparece 2x — uma única chave/botão controla ambas)
  // mas guarda também o data-col individual de cada th, para as setas de reordenar.
  const grupos={};
  tbl.querySelectorAll('thead th').forEach((th,idx)=>{
    const lbl=th.textContent.trim().slice(0,14);
    if(!lbl)return;
    if(!grupos[lbl]) grupos[lbl]=[];
    grupos[lbl].push({idx, dataCol: th.dataset.col, frozen: th.classList.contains('col-freeze')});
  });

  Object.keys(grupos).forEach(lbl=>{
    const itens=grupos[lbl];
    if(state[lbl]===undefined) state[lbl]=true;
    const visible=state[lbl];

    // Reordenável só quando: 1 única instância da coluna, e ela não é congelada.
    const reordenavel = itens.length===1 && !itens[0].frozen;

    const wrap=document.createElement('span');
    wrap.style.display='inline-flex';
    wrap.style.alignItems='center';
    wrap.style.gap='2px';

    if(reordenavel){
      const dataCol = itens[0].dataCol;
      const btnEsq=document.createElement('button');
      btnEsq.className='col-order-arrow';
      btnEsq.textContent='◀';
      btnEsq.title='Mover coluna para a esquerda';btnEsq.setAttribute('aria-label',btnEsq.title);
      btnEsq.onclick=(ev)=>{ ev.stopPropagation(); _moverColuna(tab, dataCol, -1); };
      wrap.appendChild(btnEsq);
    }

    const btn=document.createElement('button');
    btn.className='col-toggle-btn'+(visible?' visible':'');
    btn.textContent=lbl;
    btn.dataset.visible=visible?'1':'0';
    btn.onclick=()=>{
      const vis=btn.dataset.visible==='1';
      const novoVis=!vis;
      btn.dataset.visible=novoVis?'1':'0';
      btn.classList.toggle('visible',novoVis);
      state[lbl]=novoVis;
      _salvarColToggleStorage();
      // posição atual da coluna (pode ter mudado depois de reordenar)
      _idxsDoRotulo(tbl,lbl).forEach(idx=>_toggleColuna(tbl,idx,novoVis));
    };
    wrap.appendChild(btn);

    if(reordenavel){
      const dataCol = itens[0].dataCol;
      const btnDir=document.createElement('button');
      btnDir.className='col-order-arrow';
      btnDir.textContent='▶';
      btnDir.title='Mover coluna para a direita';btnDir.setAttribute('aria-label',btnDir.title);
      btnDir.onclick=(ev)=>{ ev.stopPropagation(); _moverColuna(tab, dataCol, 1); };
      wrap.appendChild(btnDir);
    }

    contents.appendChild(wrap);
    // Re-aplicar estado oculto se necessário
    if(!visible) _idxsDoRotulo(tbl,lbl).forEach(idx=>_toggleColuna(tbl,idx,false));
  });

  const btnReset=document.createElement('button');
  btnReset.className='col-order-reset';
  btnReset.textContent='Restaurar ordem';
  btnReset.title='Restaurar a ordem padrão das colunas desta aba';
  btnReset.onclick=()=>_restaurarOrdemColunas(tab);
  contents.appendChild(btnReset);

  _aplicarOrdemColunas(tab);
}
// Posições atuais das colunas com este nome ("Ação" aparece duas vezes)
function _idxsDoRotulo(tbl, lbl){
  const idxs=[];
  tbl.querySelectorAll('thead th').forEach((th,i)=>{ if(th.textContent.trim().slice(0,14)===lbl) idxs.push(i); });
  return idxs;
}
function _toggleColuna(tbl,idx,visible){
  tbl.querySelectorAll('thead th').forEach((th,i)=>{if(i===idx)th.style.display=visible?'':'none';});
  tbl.querySelectorAll('tbody tr').forEach(tr=>{const td=tr.cells[idx];if(td)td.style.display=visible?'':'none';});
  _recalcularFreezeOffsets(tbl);
}

// Recalcula a posição "left" das colunas congeladas (col-freeze-1/2/3) com base
// em quais delas estão realmente visíveis — evita o "buraco" quando uma é ocultada.
const FREEZE_WIDTHS = {'col-freeze-0':42, 'col-freeze-1':140, 'col-freeze-2':110, 'col-freeze-3':110};
function _recalcularFreezeOffsets(tbl){
  const ths = Array.from(tbl.querySelectorAll('thead th.col-freeze'));
  let acc = 0;
  ths.forEach(th=>{
    const cls = Object.keys(FREEZE_WIDTHS).find(c=>th.classList.contains(c));
    if(!cls) return;
    const idx = Array.from(th.parentElement.children).indexOf(th);
    const oculta = th.style.display === 'none';
    const left = acc;
    if(!oculta){
      th.style.left = left+'px';
      tbl.querySelectorAll('tbody tr').forEach(tr=>{
        const td = tr.cells[idx];
        if(td) td.style.left = left+'px';
      });
      acc += FREEZE_WIDTHS[cls];
    }
  });
  // Atualiza qual coluna visível é a "última" (borda de destaque)
  const visiveis = ths.filter(th=>th.style.display!=='none');
  ths.forEach(th=>th.classList.remove('col-freeze-last'));
  if(visiveis.length) visiveis[visiveis.length-1].classList.add('col-freeze-last');
  tbl.querySelectorAll('tbody td.col-freeze').forEach(td=>td.classList.remove('col-freeze-last'));
  if(visiveis.length){
    const lastIdx = Array.from(visiveis[visiveis.length-1].parentElement.children).indexOf(visiveis[visiveis.length-1]);
    tbl.querySelectorAll('tbody tr').forEach(tr=>{
      const td = tr.cells[lastIdx];
      if(td) td.classList.add('col-freeze-last');
    });
  }
}
