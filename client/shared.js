async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Not signed in');
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed: ${res.status}`);
  }
  return body;
}

const ICONS = {
  start: '<path d="M12 3l2.5 5.5L20 9.5l-4 4 1 5.8L12 16.5 7 19.3l1-5.8-4-4 5.5-1z"/>',
  roadmap: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  study: '<path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H9l-5 4V5z"/>',
  papers: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
  interview: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  design: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v2.5h11V10M12 12.5V14"/>',
  dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  reports: '<path d="M7 3h10a2 2 0 012 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 012-2zM9 8h6M9 12h6"/>',
  resume: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.8-2 2.3-3 4-3s3.2 1 4 3"/>',
  builder: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3"/>',
  match: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5M8.5 11l2 2 3.5-4"/>',
  apps: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
  bank: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function renderNav(active) {
  const nav = document.getElementById('topnav');
  if (!nav) return;
  document.body.classList.add('has-sidebar');

  function paint(role) {
    const groups = [
      { title: 'Learn', items: [
        { href: 'start.html', label: 'Start Here', icon: 'start' },
        { href: 'roadmap.html', label: 'Roadmap', icon: 'roadmap' },
        { href: 'study.html', label: 'Study Mode', icon: 'study' },
        { href: 'papers.html', label: 'Papers', icon: 'papers' },
      ] },
      { title: 'Practice', items: [
        { href: 'index.html', label: 'Mock Interview', icon: 'interview' },
        { href: 'practice.html', label: 'Code & SQL', icon: 'code' },
        { href: 'systemdesign.html', label: 'System Design', icon: 'design' },
      ] },
      { title: 'Progress', items: [
        { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard' },
        { href: 'reports.html', label: 'Reports', icon: 'reports' },
      ] },
      { title: 'Career', items: [
        { href: 'resume.html', label: 'Resume Defense', icon: 'resume' },
        { href: 'resumebuilder.html', label: 'Resume Builder', icon: 'builder' },
        { href: 'jobmatch.html', label: 'Job Match', icon: 'match' },
        { href: 'applications.html', label: 'Applications', icon: 'apps' },
      ] },
      // Question Bank management is admin-only - everyone else still gets
      // its questions inside mock interviews, just not the edit/delete UI.
      ...(role === 'admin' ? [{ title: 'Admin', items: [{ href: 'bank.html', label: 'Question Bank', icon: 'bank' }] }] : []),
    ];
    nav.innerHTML = `
      <div class="nav-top">
        <a class="brand" href="start.html"><span class="brand-mark">${icon('interview')}</span>Interview Prep</a>
      </div>
      <div class="nav-tabs">
        ${groups.map((g) => `
          <div class="nav-group">${g.title}</div>
          ${g.items.map((i) => `<a href="${i.href}" class="${i.href === active ? 'active' : ''}">${icon(i.icon)}${i.label}</a>`).join('')}
        `).join('')}
      </div>
      <div class="nav-foot"><span id="navAccount" class="muted"></span></div>
    `;
    if (window.mountThemeToggle) window.mountThemeToggle(nav.querySelector('.nav-foot'), false);
  }

  paint(null); // paint immediately; re-paint once we know the role (adds Question Bank for admins)

  if (!document.querySelector('.nav-burger')) {
    const burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Menu');
    burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    burger.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    const scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));
    document.body.append(burger, scrim);
  }

  fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((user) => {
      if (!user) return;
      paint(user.role);
      const el = document.getElementById('navAccount');
      if (!el) return;
      el.innerHTML = `<div title="${escapeHtml(user.email)}" style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(user.email)}</div><a href="#" id="logoutLink">Log out</a>`;
      document.getElementById('logoutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = 'login.html';
      });
    })
    .catch(() => {});
}

function scoreClass(score) {
  if (score >= 8) return 'good';
  if (score >= 5) return 'warn';
  return 'bad';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function qparam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
