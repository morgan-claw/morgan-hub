// Shared navigation for Morgan Hub
// Include via <script src="/nav.js"></script> — auto-injects sidebar + tab bar
(function() {
  const pages = [
    { href: '/', label: 'Dashboard', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
    { href: '/missions', label: 'Missions', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>' },
    { href: '/schedule', label: 'Schedule', icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    { href: '/approvals', label: 'Approvals', icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    { href: '/chat', label: 'Chat', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  ];

  // Match current page — normalize both path and href (strip .html, trailing slash)
  const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/';
  function isActive(href) {
    const h = href.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    return path === h;
  }

  function svg(icon, size) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${size ? ` width="${size}" height="${size}"` : ''}>${icon}</svg>`;
  }

  // --- Sidebar (desktop) ---
  // Fills .sidebar-nav if it exists, otherwise prepends to .sidebar
  const navHTML = `<div class="brand"><div class="mark">M</div><span>Morgan Hub</span></div>
    ${pages.map(p => `<a href="${p.href}"${isActive(p.href) ? ' class="active"' : ''}>${svg(p.icon)} ${p.label}</a>`).join('\n    ')}`;

  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = navHTML;
  } else {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = navHTML;
      sidebar.prepend(...Array.from(wrapper.children));
    }
  }

  // --- Tab bar (mobile) ---
  const tabBar = document.querySelector('.tab-bar');
  if (tabBar) {
    tabBar.innerHTML = pages.map(p =>
      `<a href="${p.href}"${isActive(p.href) ? ' class="active"' : ''}>${svg(p.icon, 22)} ${p.label}</a>`
    ).join('\n    ');
  }
})();
