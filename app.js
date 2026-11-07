const menu = document.getElementById('menu');
const player = document.getElementById('player');
const backButton = document.getElementById('backButton');
const themeToggle = document.getElementById('themeToggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const choices = [...document.querySelectorAll('[data-work]')];
const videos = {
  five: document.getElementById('fiveVideo'),
  breathe: document.getElementById('breatheVideo')
};

let activeWork = null;

function applyTheme(theme, { save = true } = {}) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? '切换为黑色界面' : '切换为白色界面');
  themeColor.content = isLight ? '#f7f6f2' : '#050505';
  if (save) localStorage.setItem('tea-workshop-theme', isLight ? 'light' : 'dark');
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

const initialWork = window.location.hash.slice(1);
history.replaceState({ work: videos[initialWork] ? initialWork : null }, '');
if (videos[initialWork]) {
  openWork(initialWork, { updateHistory: false });
}
