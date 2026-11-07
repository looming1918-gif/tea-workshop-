const menu = document.getElementById('menu');
const player = document.getElementById('player');
const backButton = document.getElementById('backButton');
const themeToggle = document.getElementById('themeToggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const offlineButton = document.getElementById('offlineButton');
const offlineLabel = document.getElementById('offlineLabel');
const choices = [...document.querySelectorAll('[data-work]')];
const videos = {
  five: document.getElementById('fiveVideo'),
  breathe: document.getElementById('breatheVideo')
};

let activeWork = null;
let serviceWorkerRegistration = null;

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;

function fitStage() {
  const viewport = window.visualViewport;
  const width = viewport ? viewport.width : window.innerWidth;
  const height = viewport ? viewport.height : window.innerHeight;
  const offsetLeft = viewport ? viewport.offsetLeft : 0;
  const offsetTop = viewport ? viewport.offsetTop : 0;
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);

  document.documentElement.style.setProperty('--stage-scale', String(scale));
  document.documentElement.style.setProperty('--stage-center-x', `${offsetLeft + width / 2}px`);
  document.documentElement.style.setProperty('--stage-center-y', `${offsetTop + height / 2}px`);
}

function applyTheme(theme, { save = true } = {}) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? '切换为黑色界面' : '切换为白色界面');
  themeColor.content = isLight ? '#f7f6f2' : '#050505';
  if (save) localStorage.setItem('tea-workshop-theme', isLight ? 'light' : 'dark');
}

function setOfflineState(state, detail = '') {
  offlineButton.classList.toggle('is-ready', state === 'ready');
  offlineButton.disabled = state === 'downloading' || state === 'ready';

  if (state === 'ready') {
    offlineLabel.textContent = '已可离线';
    offlineButton.setAttribute('aria-label', '网站已下载，可以离线使用');
  } else if (state === 'downloading') {
    offlineLabel.textContent = detail || '正在下载';
    offlineButton.setAttribute('aria-label', '正在下载离线内容');
  } else if (state === 'error') {
    offlineLabel.textContent = '重新下载';
    offlineButton.setAttribute('aria-label', '下载失败，点击重新下载');
  } else {
    offlineLabel.textContent = '离线下载';
    offlineButton.setAttribute('aria-label', '下载网站供离线使用');
  }
}

async function initializeOfflineSupport() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    offlineButton.hidden = false;
    const worker = serviceWorkerRegistration.active || navigator.serviceWorker.controller;
    worker?.postMessage({ type: 'GET_OFFLINE_STATUS' });
  } catch {
    offlineButton.hidden = true;
  }
}

function pauseAll(reset = false) {
  Object.values(videos).forEach((video) => {
    video.pause();
    video.classList.remove('is-active');
    if (reset) {
      video.currentTime = 0;
    }
  });
}

function showMenu({ updateHistory = true } = {}) {
  pauseAll(true);
  activeWork = null;
  player.hidden = true;
  menu.hidden = false;
  document.title = '茶工坊';

  if (updateHistory && window.location.hash) {
    history.replaceState({ work: null }, '', window.location.pathname + window.location.search);
  }

  requestAnimationFrame(() => choices[0].focus());
}

function openWork(work, { updateHistory = true } = {}) {
  const video = videos[work];
  if (!video) return;

  pauseAll(false);
  activeWork = work;
  menu.hidden = true;
  player.hidden = false;
  video.classList.add('is-active');
  video.currentTime = 0;
  video.play().catch(() => {});
  document.title = work === 'five'
    ? '我在桥上看风景，只问去处'
    : '我在桥上看风景，不问时间';

  if (updateHistory) {
    history.pushState({ work }, '', `#${work}`);
  }

  requestAnimationFrame(() => backButton.focus());
}

choices.forEach((choice) => {
  choice.addEventListener('click', () => openWork(choice.dataset.work));
});

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
});

offlineButton.addEventListener('click', async () => {
  if (!serviceWorkerRegistration || offlineButton.classList.contains('is-ready')) return;

  setOfflineState('downloading', '准备下载');
  await navigator.storage?.persist?.().catch(() => false);
  const worker = serviceWorkerRegistration.active || navigator.serviceWorker.controller;
  worker?.postMessage({ type: 'CACHE_OFFLINE_CONTENT' });
});

navigator.serviceWorker?.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'OFFLINE_STATUS') {
    setOfflineState(message.ready ? 'ready' : 'idle');
  } else if (message.type === 'OFFLINE_PROGRESS') {
    setOfflineState('downloading', `${message.completed}/${message.total}`);
  } else if (message.type === 'OFFLINE_READY') {
    setOfflineState('ready');
  } else if (message.type === 'OFFLINE_ERROR') {
    setOfflineState('error');
  }
});

Object.values(videos).forEach((video) => {
  video.addEventListener('ended', () => {
    if (video === videos[activeWork]) {
      showMenu();
    }
  });
});

backButton.addEventListener('click', () => {
  if (window.location.hash) {
    history.back();
  } else {
    showMenu({ updateHistory: false });
  }
});

window.addEventListener('popstate', () => {
  const work = window.location.hash.slice(1);
  if (videos[work]) {
    openWork(work, { updateHistory: false });
  } else {
    showMenu({ updateHistory: false });
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeWork) {
    backButton.click();
    return;
  }

  if (!activeWork && (event.key === '1' || event.key === '2')) {
    openWork(event.key === '1' ? 'five' : 'breathe');
  }
});

document.addEventListener('visibilitychange', () => {
  if (!activeWork) return;
  const video = videos[activeWork];
  if (document.hidden) {
    video.pause();
  } else {
    video.play().catch(() => {});
  }
});

applyTheme(localStorage.getItem('tea-workshop-theme') || 'dark', { save: false });
fitStage();
initializeOfflineSupport();
window.addEventListener('resize', fitStage);
window.visualViewport?.addEventListener('resize', fitStage);
window.visualViewport?.addEventListener('scroll', fitStage);

const initialWork = window.location.hash.slice(1);
history.replaceState({ work: videos[initialWork] ? initialWork : null }, '');
if (videos[initialWork]) {
  openWork(initialWork, { updateHistory: false });
}
