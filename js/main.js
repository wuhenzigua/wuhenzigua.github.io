(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const navButton = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-site-nav]');
  const header = document.querySelector('[data-site-header]');
  const progress = document.querySelector('[data-reading-progress]');

  const savedTheme = localStorage.getItem('academic-ink-theme');
  const preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = savedTheme || (preferredDark ? 'dark' : 'light');

  themeButton?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('academic-ink-theme', next);
  });

  navButton?.addEventListener('click', () => {
    const open = nav?.classList.toggle('is-open');
    navButton.setAttribute('aria-expanded', String(Boolean(open)));
  });

  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    navButton?.setAttribute('aria-expanded', 'false');
  }));

  const updateScrollState = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 12);
    if (!progress) return;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = height > 0 ? Math.min(window.scrollY / height, 1) : 0;
    progress.style.width = `${ratio * 100}%`;
  };

  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
})();
