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

function renderNav(active) {
  const nav = document.getElementById('topnav');
  if (!nav) return;

  function paint(role) {
    const items = [
      { href: 'dashboard.html', label: 'Dashboard' },
      { href: 'roadmap.html', label: 'Roadmap' },
      { href: 'index.html', label: 'Mock Interview' },
      { href: 'practice.html', label: 'Code & SQL' },
      { href: 'systemdesign.html', label: 'System Design' },
      { href: 'papers.html', label: 'Papers' },
      // Question Bank management is admin-only - everyone else still gets
      // its questions inside mock interviews, just not the edit/delete UI.
      ...(role === 'admin' ? [{ href: 'bank.html', label: 'Question Bank' }] : []),
      { href: 'reports.html', label: 'Reports' },
      { href: 'resume.html', label: 'Resume Defense' },
      { href: 'resumebuilder.html', label: 'Resume Builder' },
      { href: 'jobmatch.html', label: 'Job Match' },
      { href: 'applications.html', label: 'Applications' },
    ];
    nav.innerHTML =
      `<span class="brand">🎙️ Interview Prep</span>` +
      items
        .map(
          (i) =>
            `<a href="${i.href}" class="${i.href === active ? 'active' : ''}">${i.label}</a>`
        )
        .join('') +
      `<span style="flex:1 1 auto;"></span><span id="navAccount" class="muted small"></span>`;
    if (window.mountThemeToggle) window.mountThemeToggle(nav, false);
  }

  paint(null); // paint immediately; re-paint once we know the role (adds Question Bank for admins)

  fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((user) => {
      if (!user) return;
      paint(user.role);
      const el = document.getElementById('navAccount');
      if (!el) return;
      el.innerHTML = `${escapeHtml(user.email)} &nbsp;&middot;&nbsp; <a href="#" id="logoutLink">Log out</a>`;
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
