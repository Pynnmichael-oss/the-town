import { BUILDINGS } from './config.js';

let overlayEl = null;

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'directory-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Town directory');
  overlay.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'directory-panel';

  const heading = document.createElement('h1');
  heading.textContent = 'Town Directory';
  panel.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'directory-hint';
  hint.textContent = document.body.classList.contains('touch')
    ? 'Tap a project to visit it.'
    : 'Press Esc or click outside to close.';
  panel.appendChild(hint);

  const list = document.createElement('ul');
  Object.values(BUILDINGS).forEach(({ name, url }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = name;
    li.appendChild(a);
    list.appendChild(li);
  });
  panel.appendChild(list);

  // Explicit close control: Esc and click-outside still work, but touch
  // users need a visible 44px+ target (styled in index.html).
  const closeBtn = document.createElement('button');
  closeBtn.className = 'directory-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closeDirectory);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDirectory();
  });

  document.body.appendChild(overlay);
  overlayEl = overlay;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDirectory();
  });
}

export function openDirectory() {
  if (!overlayEl) buildOverlay();
  overlayEl.hidden = false;
}

export function closeDirectory() {
  if (overlayEl) overlayEl.hidden = true;
}

export function toggleDirectory() {
  if (!overlayEl) buildOverlay();
  overlayEl.hidden = !overlayEl.hidden;
}

export function isDirectoryOpen() {
  return !!overlayEl && !overlayEl.hidden;
}
