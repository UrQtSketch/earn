import { API } from './api.js';

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span> <div>${escapeHtml(message)}</div>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTimeAgo(dateInput) {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatCurrency(num) {
  if (num === null || num === undefined) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

/**
 * Initializes and injects the canonical navigation bar, mobile drawer, and notifications
 */
export async function initNavbar(activePath = '') {
  const header = document.querySelector('header.topbar');
  if (!header) return;

  let currentUser = null;
  try {
    const sessionRes = await API.getSession();
    if (sessionRes.authenticated && sessionRes.user) {
      currentUser = sessionRes.user;
    }
  } catch (_) {}

  const currentPath = activePath || window.location.pathname;

  let navLinksHtml = `
    <a class="${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}" href="/">Discover</a>
    <a class="${currentPath.startsWith('/opportunities') ? 'active' : ''}" href="/opportunities">Opportunities</a>
  `;

  if (currentUser) {
    navLinksHtml += `
      <a class="${currentPath.startsWith('/dashboard') ? 'active' : ''}" href="/dashboard">Dashboard</a>
      <a class="${currentPath.startsWith('/collaborations') ? 'active' : ''}" href="/collaborations">Collaborations</a>
      <a class="${currentPath.startsWith('/messages') ? 'active' : ''}" href="/messages">Messages</a>
    `;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') {
      navLinksHtml += `
        <a class="${currentPath.startsWith('/admin') ? 'active' : ''}" href="/admin" style="color: var(--cyan);"><span style="font-size:10px; border:1px solid rgba(103,232,255,0.3); padding:2px 6px; border-radius:4px;">ADMIN</span></a>
      `;
    }
  } else {
    navLinksHtml += `
      <a href="/#categories">Categories</a>
      <a href="/#verify">Verification</a>
      <a href="/#how">How it works</a>
    `;
  }

  let actionsHtml = '';
  if (currentUser) {
    actionsHtml = `
      <!-- Notification Icon -->
      <div style="position: relative;" id="notif-wrapper">
        <button id="notif-btn" style="background: transparent; border: 1px solid var(--line); border-radius: 10px; width: 36px; height: 36px; color: var(--muted); cursor: pointer; display: grid; place-items: center; position: relative;">
          🔔
          <span id="notif-badge" style="display: none; position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: var(--green); color: #04100b; border-radius: 50%; font-size: 9px; font-weight: 800; place-items: center;">0</span>
        </button>
        <div class="dropdown-menu" id="notif-dropdown" style="width: 280px; right: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line);">
            <b style="font-size: 11px;">Notifications</b>
            <button id="mark-all-read-btn" style="background: transparent; border: none; font-size: 10px; color: var(--cyan); cursor: pointer;">Mark all read</button>
          </div>
          <div id="notif-list-container" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column;">
            <div style="padding: 16px; text-align: center; color: var(--muted); font-size: 11px;">No new notifications</div>
          </div>
        </div>
      </div>

      <a class="submit-link" href="/share-method">+ Share method</a>
      <div class="user-badge" id="user-dropdown-btn">
        <div class="avatar">${escapeHtml((currentUser.profile?.fullName || 'U').charAt(0).toUpperCase())}</div>
        <span style="font-size:12px; font-weight:700;">${escapeHtml(currentUser.profile?.fullName?.split(' ')[0] || 'Account')}</span>
        <span style="font-size:10px; color:var(--muted);">▾</span>

        <div class="dropdown-menu" id="user-dropdown-menu">
          <div style="padding: 8px 12px; font-size: 11px; color: var(--muted); border-bottom: 1px solid var(--line);">
            Signed in as <b>@${escapeHtml(currentUser.profile?.username || 'user')}</b>
          </div>
          <a class="dropdown-item" href="/dashboard">📊 Dashboard</a>
          <a class="dropdown-item" href="/my-opportunities">🎯 Joined Opportunities</a>
          <a class="dropdown-item" href="/my-submissions">📝 My Submissions</a>
          <a class="dropdown-item" href="/profile">👤 Profile</a>
          <a class="dropdown-item" href="/settings">⚙ Settings</a>
          ${currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR' ? '<a class="dropdown-item" href="/admin" style="color:var(--cyan);">🛡 Admin Console</a>' : ''}
          <div class="dropdown-divider"></div>
          <a class="dropdown-item" href="#" id="logout-btn" style="color:var(--red);">🚪 Sign Out</a>
        </div>
      </div>
    `;
  } else {
    actionsHtml = `
      <a class="btn secondary sm" href="/login">Log in</a>
      <a class="submit-link" href="/signup">+ Share opportunity</a>
    `;
  }

  header.innerHTML = `
    <a class="logo" href="/">
      <span class="logo-mark">↗</span>
      <span>Earn<span>Radar</span></span>
    </a>
    <nav class="desktop-nav">${navLinksHtml}</nav>
    <div class="nav-actions">
      ${actionsHtml}
      <button id="mobile-menu-toggle" class="mobile-only-btn" style="display: none; background: transparent; border: 1px solid var(--line); border-radius: 8px; width: 36px; height: 36px; color: #fff; font-size: 18px; cursor: pointer;">☰</button>
    </div>
  `;

  // Inject Mobile Drawer into Body if not exists
  let mobileDrawer = document.getElementById('mobile-nav-drawer');
  if (!mobileDrawer) {
    mobileDrawer = document.createElement('div');
    mobileDrawer.id = 'mobile-nav-drawer';
    mobileDrawer.className = 'mobile-drawer';
    document.body.appendChild(mobileDrawer);
  }

  mobileDrawer.innerHTML = `
    <div class="mobile-drawer-header">
      <div class="logo">
        <span class="logo-mark">↗</span>
        <span>Earn<span>Radar</span></span>
      </div>
      <button id="close-mobile-drawer" style="background:transparent; border:none; color:var(--muted); font-size:22px; cursor:pointer;">✕</button>
    </div>
    <div class="mobile-drawer-links">
      ${navLinksHtml}
      ${currentUser ? `
        <div style="height: 1px; background: var(--line); margin: 8px 0;"></div>
        <a href="/dashboard">📊 Dashboard</a>
        <a href="/my-opportunities">🎯 Joined Opportunities</a>
        <a href="/my-submissions">📝 My Submissions</a>
        <a href="/profile">👤 Profile</a>
        <a href="/settings">⚙ Settings</a>
        ${currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR' ? '<a href="/admin" style="color:var(--cyan);">🛡 Admin Console</a>' : ''}
        <a href="#" id="mobile-logout-btn" style="color:var(--red);">🚪 Sign Out</a>
      ` : `
        <div style="height: 1px; background: var(--line); margin: 8px 0;"></div>
        <a href="/login">🔑 Sign In</a>
        <a href="/signup">✨ Create Account</a>
      `}
    </div>
  `;

  // Mobile Drawer Listeners
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const closeDrawer = document.getElementById('close-mobile-drawer');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => mobileDrawer.classList.add('open'));
  }
  if (closeDrawer) {
    closeDrawer.addEventListener('click', () => mobileDrawer.classList.remove('open'));
  }

  // Attach dropdown & logout event listeners
  const dropdownBtn = document.getElementById('user-dropdown-btn');
  const dropdownMenu = document.getElementById('user-dropdown-menu');
  if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });
  }

  // Notifications handler
  if (currentUser) {
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifBadge = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list-container');
    const markAllBtn = document.getElementById('mark-all-read-btn');

    async function fetchNotifications() {
      try {
        const nRes = await API.getNotifications();
        if (nRes.success) {
          if (nRes.unreadCount > 0) {
            notifBadge.style.display = 'grid';
            notifBadge.textContent = nRes.unreadCount > 9 ? '9+' : nRes.unreadCount;
          } else {
            notifBadge.style.display = 'none';
          }

          if (nRes.notifications?.length > 0) {
            notifList.innerHTML = nRes.notifications.map(n => `
              <a href="${n.link || '#'}" class="dropdown-item ${n.isRead ? '' : 'unread'}" style="flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; ${n.isRead ? '' : 'background: rgba(103,232,255,0.06);'}">
                <strong style="font-size: 11px; color: ${n.isRead ? 'var(--text)' : 'var(--cyan)'};">${escapeHtml(n.title)}</strong>
                <p style="font-size: 10px; color: var(--muted); line-height: 1.4;">${escapeHtml(n.message)}</p>
                <span style="font-size: 8px; color: var(--dim); margin-top: 2px;">${formatTimeAgo(n.createdAt)}</span>
              </a>
            `).join('');
          } else {
            notifList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--muted); font-size: 11px;">No new notifications</div>';
          }
        }
      } catch (_) {}
    }

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
      });
      document.addEventListener('click', () => notifDropdown.classList.remove('show'));
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await API.markAllNotificationsRead();
        fetchNotifications();
      });
    }

    fetchNotifications();
  }

  const logoutHandler = async (e) => {
    e.preventDefault();
    await API.logout();
    showToast('Logged out successfully', 'info');
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutHandler);

  const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logoutHandler);
}
