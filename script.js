(() => {
  'use strict';

  const slides = [...document.querySelectorAll('.slides > .slide')];
  if (!slides.length) return;
  const toolbar = document.querySelector('.toolbar');
  const indexDialog = document.querySelector('#slide-index');
  const helpDialog = document.querySelector('#help');
  const indexList = document.querySelector('#index-list');
  const gridButton = document.querySelector('#toggle-grid');
  const fullscreenButton = document.querySelector('#fullscreen');
  const announcement = document.querySelector('#announcement');
  const clampIndex = index => Math.min(slides.length - 1, Math.max(0, index));
  let currentIndex = 0;
  let normalToolbarVisible = true;
  let fullscreenToolbarVisible = false;

  function indexFromURL() {
    const value = new URL(location.href).searchParams.get('currentSlides');
    return value && /^\d+$/.test(value) ? clampIndex(Number(value) - 1) : 0;
  }

  function writeURL(index, push = false) {
    const url = new URL(location.href);
    url.searchParams.set('currentSlides', String(index + 1));
    if (url.href === location.href) return;
    // Some file:// hosts restrict History API. Navigation still works there.
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); }
    catch { /* Keep the slides usable if the host disallows URL changes. */ }
  }

  function setCurrent(index) {
    currentIndex = index;
    indexList.querySelectorAll('a').forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    announcement.textContent = document.getElementById(slides[index].getAttribute('aria-labelledby')).textContent;
    writeURL(index);
  }

  function goTo(index, { push = false } = {}) {
    index = clampIndex(index);
    if (index !== currentIndex) document.dispatchEvent(new Event('slide:move'));
    if (push) writeURL(index, true);
    // Only explicit keyboard/link navigation requests a destination.
    // Wheel, trackpad and touch scrolling are entirely native CSS Scroll Snap.
    slides[index].scrollIntoView({ block: 'start', inline: 'nearest' });
  }

  slides.forEach((slide, index) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `?currentSlides=${index + 1}`;
    link.dataset.slide = String(index + 1);
    const title = document.createElement('span');
    title.textContent = slide.dataset.layout;
    const detail = document.createElement('small');
    detail.textContent = slide.dataset.part;
    link.append(title, detail);
    item.append(link);
    indexList.append(item);
  });

  // Observe slide identity only. No scroll offsets, geometry or progress math.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.6) continue;
      const index = slides.indexOf(entry.target);
      setCurrent(index);
    }
  }, { threshold: [0.6, 1] });
  slides.forEach(slide => observer.observe(slide));
  document.querySelector('#open-index').addEventListener('click', () => indexDialog.showModal());
  document.querySelector('#open-help').addEventListener('click', () => helpDialog.showModal());
  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-slide]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (indexDialog.open) indexDialog.close();
    goTo(Number(link.dataset.slide) - 1, { push: true });
  });
  function toggleGrid() {
    const enabled = document.body.classList.toggle('show-grid');
    gridButton.setAttribute('aria-pressed', String(enabled));
  }
  gridButton.addEventListener('click', toggleGrid);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { announcement.textContent = 'Полный экран недоступен в этом окне браузера.'; }
  }
  fullscreenButton.addEventListener('click', toggleFullscreen);
  function syncToolbar() {
    const visible = document.fullscreenElement ? fullscreenToolbarVisible : normalToolbarVisible;
    if (!visible && toolbar.contains(document.activeElement)) document.activeElement.blur();
    toolbar.hidden = !visible;
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) fullscreenToolbarVisible = false;
    fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Выйти из полного экрана' : 'Полный экран');
    syncToolbar();
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (event.metaKey && event.code === 'KeyK' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (!event.repeat) {
        if (document.fullscreenElement) fullscreenToolbarVisible = !fullscreenToolbarVisible;
        else normalToolbarVisible = !normalToolbarVisible;
        syncToolbar();
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (indexDialog.open || helpDialog.open) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.code === 'Space' && event.target.closest('button, a, video')) return;
    const navigation = {
      ArrowDown: currentIndex + 1, PageDown: currentIndex + 1,
      ArrowUp: currentIndex - 1, PageUp: currentIndex - 1,
      Home: 0, End: slides.length - 1,
      Space: currentIndex + (event.shiftKey ? -1 : 1)
    };
    if (event.code in navigation) {
      event.preventDefault();
      if (!event.repeat) goTo(navigation[event.code]);
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyM') indexDialog.showModal();
    if (event.code === 'KeyG') toggleGrid();
    if (event.code === 'KeyF') toggleFullscreen();
    if (event.key === '?') helpDialog.showModal();
  });

  addEventListener('popstate', () => goTo(indexFromURL()));
  addEventListener('pageshow', event => {
    if (event.persisted) goTo(indexFromURL());
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const initialIndex = indexFromURL();
  if (initialIndex !== 0) goTo(initialIndex);
  else setCurrent(0);

  // Small offline highlighter for talk snippets. Tokens are text nodes, not HTML.
  // This intentionally does not pretend to parse every JavaScript/HTML grammar.
  const patterns = {
    javascript: /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:if|else|await|async|return|throw|new|const|let|var|function|typeof|true|false|null|undefined)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<function>\b[a-zA-Z_$][\w$]*(?=\())/g,
    html: /(?<comment><!--[\s\S]*?-->)|(?<string>"[^"]*"|'[^']*')|(?<tag><\/?[\w-]+|\/?\s*>)|(?<attribute>\b[\w-]+(?==))/g
  };
  for (const code of document.querySelectorAll('code[data-language]')) {
    const pattern = patterns[code.dataset.language];
    if (!pattern) continue;
    const source = code.textContent;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      fragment.append(document.createTextNode(source.slice(cursor, match.index)));
      const span = document.createElement('span');
      span.className = `token-${Object.keys(match.groups).find(key => match.groups[key] !== undefined)}`;
      span.textContent = match[0];
      fragment.append(span);
      cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(source.slice(cursor)));
    code.replaceChildren(fragment);
  }
})();
