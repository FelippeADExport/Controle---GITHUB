// ============================================================
// offline.js — faz o app funcionar fora do Apps Script:
// substitui `google.script.run` por chamadas fetch ao Cloudflare
// Worker, que repassa para o Apps Script do Controle.
// Os outros arquivos continuam chamando google.script.run normalmente.
// (O service worker é registrado no <head> do index.html.)
// ============================================================

// Worker do Controle (Cloudflare > Workers). Ele confere a chave de acesso
// e repassa a chamada para o Web App do Apps Script, de servidor para servidor.
const API_URL = 'https://ad-export-controle.felippe-6c1.workers.dev';

// ============================================================
// CHAVE DE ACESSO — pedida uma vez e salva só neste navegador
// ============================================================
const CHAVE_STORAGE_KEY = 'adexport_controle_chave';
let _chavePendente = null; // Promise enquanto o modal da chave está aberto

function _lerChave(){ try { return localStorage.getItem(CHAVE_STORAGE_KEY) || ''; } catch (e) { return ''; } }

// Devolve a chave salva ou abre o modal e espera o usuário digitar
function _obterChave(mensagem){
  const salva = _lerChave();
  if (salva && !mensagem) return Promise.resolve(salva);
  if (!_chavePendente) {
    _chavePendente = new Promise((resolve) => {
      window._resolverChave = resolve;
      const sub = document.getElementById('modalChaveSub');
      if (sub) sub.textContent = mensagem || 'Digite a chave para acessar os dados.';
      const inp = document.getElementById('chaveAcessoInput');
      if (inp) inp.value = '';
      document.getElementById('modalChave').classList.remove('hidden');
      setTimeout(() => inp && inp.focus(), 50);
    });
  }
  return _chavePendente;
}

function confirmarChaveAcesso(){
  const v = document.getElementById('chaveAcessoInput').value.trim();
  if (!v) return;
  try { localStorage.setItem(CHAVE_STORAGE_KEY, v); } catch (e) {}
  document.getElementById('modalChave').classList.add('hidden');
  const resolver = window._resolverChave;
  _chavePendente = null; window._resolverChave = null;
  if (resolver) resolver(v);
}

// Configurações > "Trocar chave de acesso"
function trocarChaveAcesso(){
  try { localStorage.removeItem(CHAVE_STORAGE_KEY); } catch (e) {}
  _obterChave('Digite a nova chave de acesso.').then(() => {
    if (typeof loadControle === 'function') { loadControle(); loadClients(); }
  });
}

// ============================================================
// RPC — chama a mesma função do Código.gs via fetch (POST)
// ============================================================
// Funções que só leem dados podem ser repetidas se a rede falhar.
// As demais (salvar, excluir, gerar PDF/XLSX...) nunca são repetidas
// automaticamente: se a resposta demorar mas o Google já tiver processado,
// repetir poderia duplicar o registro ou o arquivo.
const _FUNCOES_LEITURA = ['getClientes','getControle','getTodasNFs','getNFsPorProforma','getRelatorio',
  'getMetasPaises','getDadosMetasCompletos','getPaisesDestinoControle','getConfigLinks','verificarProformasDuplicadas'];

// Gerar relatórios e PDFs pode levar mais de um minuto no Apps Script
const RPC_TIMEOUT_MS = 300000;

async function _rpcCallOnce(fn, args){
  const chave = await _obterChave();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn, args, chave }),
      signal: controller.signal
    });
    if (resp.status === 401) { const e = new Error('Chave de acesso inválida'); e.chaveInvalida = true; throw e; }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const env = await resp.json();
    if (!env.ok) throw new Error(env.error || 'Erro no servidor');
    return env.result; // string bruta, igual ao que a função do Apps Script retorna
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tempo esgotado (sem internet ou servidor lento)');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// O Apps Script às vezes falha de forma intermitente quando chamado de fora
// do Google. Leituras tentam algumas vezes antes de desistir.
async function _rpcCall(fn, args){
  const maxTentativas = _FUNCOES_LEITURA.includes(fn) ? 3 : 1;
  let ultimoErro;
  for (let i = 0; i < maxTentativas; i++) {
    try {
      return await _rpcCallOnce(fn, args);
    } catch (e) {
      if (e.chaveInvalida) {
        // Chave errada ou trocada no servidor: pede de novo e tenta uma vez
        try { localStorage.removeItem(CHAVE_STORAGE_KEY); } catch (e2) {}
        await _obterChave('Chave inválida. Digite a chave de acesso.');
        return await _rpcCallOnce(fn, args);
      }
      ultimoErro = e;
      if (i < maxTentativas - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw ultimoErro;
}

// ============================================================
// Imitação de google.script.run — mantém a mesma API do Apps Script
// (.withSuccessHandler().withFailureHandler().funcao(args))
// ============================================================
function _makeRunner(successCb, failureCb){
  return new Proxy({}, {
    get(_target, prop){
      if (prop === 'withSuccessHandler') return (cb) => _makeRunner(cb, failureCb);
      if (prop === 'withFailureHandler') return (cb) => _makeRunner(successCb, cb);
      // prop é o nome da função do servidor
      return (...args) => {
        _rpcCall(prop, args)
          .then((raw) => { successCb && successCb(raw); })
          .catch((e) => { failureCb && failureCb({ message: navigator.onLine ? e.message : 'Sem internet' }); });
      };
    }
  });
}
window.google = { script: { run: _makeRunner(null, null) } };

// ============================================================
// Indicador de conexão (● Online / ● Offline)
// navigator.onLine não é confiável em todos os sistemas, então
// testamos de verdade com uma requisição rápida ao Worker.
// ============================================================
async function _internetRealmenteDisponivel(){
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(API_URL, { method: 'OPTIONS', signal: controller.signal, cache: 'no-store' });
    clearTimeout(t);
    return resp.status < 500; // qualquer resposta do Worker (mesmo 4xx) prova que há internet
  } catch (e) {
    return false;
  }
}

function _atualizarIndicadorConexao(){
  const el = document.getElementById('offlineStatus');
  if (!el) return;
  _internetRealmenteDisponivel().then((online) => {
    el.textContent = online ? '● Online' : '● Offline';
    el.style.color = online ? 'var(--success)' : 'var(--danger)';
  });
}

window.addEventListener('online', _atualizarIndicadorConexao);
window.addEventListener('offline', _atualizarIndicadorConexao);
window.addEventListener('DOMContentLoaded', _atualizarIndicadorConexao);
setInterval(_atualizarIndicadorConexao, 60000);
