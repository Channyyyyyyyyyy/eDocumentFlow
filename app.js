/* ==========================================================================
   UPHSD MOLINO — DIRECTOR'S OFFICE E-DOCUMENT SYSTEM
   Shared JavaScript (app.js)
   --------------------------------------------------------------------------
   This file is loaded by every authenticated page and provides:
     1.  App namespace & configuration
     2.  Storage helpers (localStorage wrapper)
     3.  Role & permission system
     4.  Theme (dark mode) management
     5.  Toast notifications
     6.  Mobile sidebar toggle
     7.  Sidebar active-link highlighting
     8.  Topbar (user chip, notifications, theme toggle)
     9.  Auth guard & logout
     10. Utility helpers (dates, initials, debounce, escapeHtml)
     11. Modal helpers
     12. Confirmation dialog helper
     13. Event bus (pub/sub for cross-module communication)
     14. Auto-init on DOMContentLoaded

   Usage in any page:
     <script src="app.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     1. APP NAMESPACE & CONFIG
     ========================================================================== */
  const APP = {
    name: 'UPHSD Molino — Director\'s Office',
    version: '1.0.0',
    storagePrefix: 'uphsd_',
    keys: {
      role: 'uphsdRole',
      user: 'uphsdUser',
      theme: 'uphsdTheme',
      rememberEmail: 'uphsdDirectorEmail',
      loggedIn: 'uphsdLoggedIn',
      authToken: 'uphsdAuthToken'
    },
    routes: {
      login: 'login.html',
      dashboard: 'dashboard.html',
      documents: 'documents.html',
      approvals: 'approvals.html',
      accounts: 'accounts.html',
      reports: 'reports.html',
      settings: 'settings.html'
    }
  };

  // Expose globally
  window.APP = APP;

  /* ==========================================================================
     2. STORAGE HELPERS
     ========================================================================== */
  const Storage = {
    get(key, fallback = null) {
      try {
        const val = localStorage.getItem(key);
        if (val === null) return fallback;
        try { return JSON.parse(val); } catch { return val; }
      } catch (e) {
        console.warn('[Storage] get failed:', e);
        return fallback;
      }
    },
    set(key, value) {
      try {
        const val = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, val);
        return true;
      } catch (e) {
        console.warn('[Storage] set failed:', e);
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) {}
    },
    clearAll() {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(APP.storagePrefix) ||
                       k.startsWith('uphsd'))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    }
  };

  APP.Storage = Storage;

  /* ==========================================================================
     3. ROLES & PERMISSIONS
     ==========================================================================
     Roles:
       secretary  — Add, Edit, Delete, View
       ea         — Add, Edit, Delete, View
       director   — Edit, View, Authorize
     ========================================================================== */
  const ROLES = {
    secretary: {
      id: 'secretary',
      label: 'Secretary',
      userName: 'Maria Cruz',
      initials: 'MC',
      email: 'maria.cruz@uphsd.edu.ph',
      permissions: ['add', 'edit', 'delete', 'view']
    },
    ea: {
      id: 'ea',
      label: 'Executive Assistant',
      userName: 'Anna Reyes',
      initials: 'AR',
      email: 'anna.reyes@uphsd.edu.ph',
      permissions: ['add', 'edit', 'delete', 'view']
    },
    director: {
      id: 'director',
      label: 'School Director',
      userName: 'Dr. Ramon Santos',
      initials: 'RS',
      email: 'ramon.santos@uphsd.edu.ph',
      permissions: ['edit', 'view', 'authorize']
    }
  };

  const Role = {
    /** Return the currently logged-in role object */
    current() {
      const id = Storage.get(APP.keys.role, 'secretary');
      return ROLES[id] || ROLES.secretary;
    },

    /** Return the current role id */
    id() {
      return this.current().id;
    },

    /** Check if current role has a permission */
    can(action) {
      return this.current().permissions.includes(action);
    },

    /** Check if current role has ANY of the given permissions */
    canAny(actions) {
      return actions.some(a => this.can(a));
    },

    /** Check if current role has ALL of the given permissions */
    canAll(actions) {
      return actions.every(a => this.can(a));
    },

    /** Set role (used by dev switcher) */
    set(roleId) {
      if (!ROLES[roleId]) return false;
      Storage.set(APP.keys.role, roleId);
      this._renderUserChip();
      Bus.emit('role:changed', roleId);
      return true;
    },

    /** Get all roles */
    all() { return ROLES; },

    /** Get role object by id */
    get(id) { return ROLES[id]; },

    /** Internal: update user chip in topbar */
    _renderUserChip() {
      const user = this.current();
      const nameEl = document.getElementById('userName');
      const roleEl = document.getElementById('userRoleLabel');
      const avEl = document.getElementById('userAvatar');
      if (nameEl) nameEl.textContent = user.userName;
      if (roleEl) roleEl.textContent = user.label;
      if (avEl) avEl.textContent = user.initials;
    }
  };

  APP.Role = Role;

  /* ==========================================================================
     4. THEME (DARK MODE)
     ========================================================================== */
  const Theme = {
    _listeners: [],

    init() {
      this.apply(this.getInitial());
    },

    getInitial() {
      const saved = Storage.get(APP.keys.theme);
      if (saved === 'dark' || saved === 'light') return saved;
      // Fallback: system preference
      return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    },

    current() {
      return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    },

    apply(theme) {
      const isDark = theme === 'dark';
      document.body.classList.toggle('dark-mode', isDark);
      this._updateIcon(isDark);
      this._listeners.forEach(fn => { try { fn(theme); } catch (e) {} });
    },

    toggle() {
      const next = this.current() === 'dark' ? 'light' : 'dark';
      this.apply(next);
      Storage.set(APP.keys.theme, next);
      Bus.emit('theme:changed', next);
    },

    onChange(fn) {
      if (typeof fn === 'function') this._listeners.push(fn);
    },

    _updateIcon(isDark) {
      const icon = document.getElementById('themeIcon');
      if (!icon) return;
      icon.innerHTML = isDark
        ? `<path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z"/>`
        : `<path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM4.22 4.22a1 1 0 011.42 0l1.42 1.42a1 1 0 11-1.42 1.42L4.22 5.64a1 1 0 010-1.42zm12.72 12.72a1 1 0 011.42 0l1.42 1.42a1 1 0 11-1.42 1.42l-1.42-1.42a1 1 0 010-1.42zM2 12a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm18 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM4.22 19.78a1 1 0 010-1.42l1.42-1.42a1 1 0 111.42 1.42l-1.42 1.42a1 1 0 01-1.42 0zM16.94 7.06a1 1 0 010-1.42l1.42-1.42a1 1 0 111.42 1.42l-1.42 1.42a1 1 0 01-1.42 0z"/>`;
    },

    /** Watch system preference changes */
    watchSystem() {
      if (!window.matchMedia) return;
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!Storage.get(APP.keys.theme)) {
          this.apply(e.matches ? 'dark' : 'light');
        }
      });
    }
  };

  APP.Theme = Theme;

  /* ==========================================================================
     5. TOAST NOTIFICATIONS
     ========================================================================== */
  const Toast = {
    _icons: {
      success: `<svg viewBox="0 0 24 24" fill="#2ed573"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
      gold:    `<svg viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"/></svg>`,
      error:   `<svg viewBox="0 0 24 24" fill="#ff4757"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
      info:    `<svg viewBox="0 0 24 24" fill="#4682dc"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
    },

    show(type = 'info', title = '', message = '', duration = 3800) {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.setAttribute('role', 'status');

      toast.innerHTML = `
        <div class="toast-icon">${this._icons[type] || this._icons.info}</div>
        <div class="toast-text">
          <h4>${Utils.escapeHtml(title)}</h4>
          <p>${Utils.escapeHtml(message)}</p>
        </div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    success(title, msg) { this.show('success', title, msg); },
    error(title, msg)   { this.show('error', title, msg); },
    info(title, msg)    { this.show('info', title, msg); },
    gold(title, msg)    { this.show('gold', title, msg); }
  };

  APP.Toast = Toast;

  /* ==========================================================================
     6. MOBILE SIDEBAR
     ========================================================================== */
  const Sidebar = {
    init() {
      const hamburger = document.getElementById('hamburger');
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('overlayBackdrop');
      if (!hamburger || !sidebar) return;

      hamburger.addEventListener('click', () => this.open());
      if (backdrop) backdrop.addEventListener('click', () => this.close());

      // Close on nav item click (mobile)
      sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 900) this.close();
        });
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
      });

      // Close on resize to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth > 900) this.close();
      });
    },

    open() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('overlayBackdrop');
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('show');
      document.body.style.overflow = 'hidden';
    },

    close() {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('overlayBackdrop');
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('show');
      document.body.style.overflow = '';
    }
  };

  APP.Sidebar = Sidebar;

  /* ==========================================================================
     7. SIDEBAR ACTIVE LINK HIGHLIGHTING
     ========================================================================== */
  const Nav = {
    init() {
      const currentPage = this._currentPage();
      document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        const dataPage = item.getAttribute('data-page');
        const match = (href && href === currentPage) ||
                      (dataPage && dataPage === currentPage);
        item.classList.toggle('active', !!match);
      });
    },

    _currentPage() {
      const path = window.location.pathname.split('/').pop() || 'dashboard.html';
      return path || 'dashboard.html';
    },

    /** Programmatic navigation */
    go(page) {
      const map = APP.routes;
      const target = map[page] || page;
      window.location.href = target;
    }
  };

  APP.Nav = Nav;

  /* ==========================================================================
     8. TOPBAR AUTO-WIRING
     ========================================================================== */
  const Topbar = {
    init() {
      // Theme toggle
      const themeBtn = document.getElementById('themeToggle');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => Theme.toggle());
      }

      // Role switcher (dev only)
      const switcher = document.getElementById('roleSwitcher');
      if (switcher) {
        switcher.value = Role.id();
        switcher.addEventListener('change', (e) => {
          Role.set(e.target.value);
          Toast.info('Role Switched', `Now viewing as ${Role.current().label}.`);
        });
      }

      // User chip
      const chip = document.getElementById('userChip');
      if (chip) {
        chip.addEventListener('click', () => {
          if (confirm('Do you want to log out?')) {
            APP.Auth.logout();
          }
        });
      }

      // Render user chip
      Role._renderUserChip();

      // Set footer year
      document.querySelectorAll('[data-year]').forEach(el => {
        el.textContent = new Date().getFullYear();
      });
      const yearEl = document.getElementById('year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
  };

  APP.Topbar = Topbar;

  /* ==========================================================================
     9. AUTH GUARD & LOGOUT
     ========================================================================== */
  const Auth = {
    /** Check if user is logged in. Redirect to login if not. */
    requireLogin() {
      const loggedIn = Storage.get(APP.keys.loggedIn);
      if (!loggedIn) {
        window.location.href = APP.routes.login;
        return false;
      }
      return true;
    },

    /** Mark user as logged in */
    login(roleId = 'secretary') {
      Storage.set(APP.keys.loggedIn, 'true');
      Storage.set(APP.keys.role, roleId);
    },

    /** Log out */
    logout() {
      Storage.remove(APP.keys.loggedIn);
      Storage.remove(APP.keys.authToken);
      window.location.href = APP.routes.login;
    },

    /** Check if user is logged in (no redirect) */
    isLoggedIn() {
      return !!Storage.get(APP.keys.loggedIn);
    }
  };

  APP.Auth = Auth;

  /* ==========================================================================
     10. UTILITY HELPERS
     ========================================================================== */
  const Utils = {
    /** Escape HTML to prevent XSS */
    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /** Get initials from full name (max 2 letters) */
    getInitials(name) {
      if (!name) return '?';
      return name.trim().split(/\s+/)
        .map(w => w[0]).slice(0, 2).join('').toUpperCase();
    },

    /** Format date as "Jan 15, 2025" */
    formatDate(date, opts = {}) {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', ...opts
      });
    },

    /** Format date-time as "Jan 15, 2025 · 09:24 AM" */
    formatDateTime(date) {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      return this.formatDate(d) + ' · ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    /** Relative time — "2 hours ago" */
    timeAgo(date) {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
      if (seconds < 60) return 'just now';
      const mins = Math.floor(seconds / 60);
      if (mins < 60) return `${mins} min ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
      const days = Math.floor(hrs / 24);
      if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
      return this.formatDate(d);
    },

    /** Debounce a function */
    debounce(fn, wait = 300) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    /** Throttle a function */
    throttle(fn, limit = 200) {
      let inThrottle;
      return function (...args) {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },

    /** Simple ID generator */
    uid(prefix = 'id') {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    /** Check if email is valid */
    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /** Capitalize first letter */
    capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /** Format number with commas — 1234 → 1,234 */
    number(n) {
      return Number(n || 0).toLocaleString('en-US');
    },

    /** Truncate text */
    truncate(str, len = 40) {
      if (!str) return '';
      return str.length > len ? str.slice(0, len - 1) + '…' : str;
    },

    /** Deep clone */
    clone(obj) {
      try { return JSON.parse(JSON.stringify(obj)); }
      catch { return obj; }
    },

    /** Query string helpers */
    qs(name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    /** Read a CSS variable */
    cssVar(name) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
    }
  };

  APP.Utils = Utils;

  /* ==========================================================================
     11. MODAL HELPERS
     ========================================================================== */
  const Modal = {
    open(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('show');
      document.body.style.overflow = 'hidden';

      // Close on backdrop click
      el.addEventListener('click', (e) => {
        if (e.target === el) this.close(id);
      });

      // Close on Escape
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.close(id);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    },

    close(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      document.body.style.overflow = '';
    },

    closeAll() {
      document.querySelectorAll('.modal-backdrop.show')
        .forEach(el => el.classList.remove('show'));
      document.body.style.overflow = '';
    }
  };

  APP.Modal = Modal;

  /* ==========================================================================
     12. CONFIRM DIALOG (Promise-based)
     ==========================================================================
     Usage:
       const ok = await APP.confirm({
         title: 'Delete this?',
         message: 'This cannot be undone.',
         confirmText: 'Delete',
         danger: true
       });
       if (ok) { ... }
     ========================================================================== */
  APP.confirm = function ({
    title = 'Are you sure?',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
  } = {}) {
    return new Promise((resolve) => {
      // Build modal
      const id = 'appConfirmModal_' + Date.now();
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.id = id;

      backdrop.innerHTML = `
        <div class="modal" style="max-width:420px;">
          <div class="modal-header">
            <div style="flex:1;">
              <h2>${Utils.escapeHtml(title)}</h2>
              ${message ? `<p>${Utils.escapeHtml(message)}</p>` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" data-role="cancel">${Utils.escapeHtml(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-role="confirm">${Utils.escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('show'));
      document.body.style.overflow = 'hidden';

      const cleanup = (result) => {
        backdrop.classList.remove('show');
        setTimeout(() => {
          backdrop.remove();
          document.body.style.overflow = '';
        }, 200);
        resolve(result);
      };

      backdrop.querySelector('[data-role="confirm"]')
        .addEventListener('click', () => cleanup(true));
      backdrop.querySelector('[data-role="cancel"]')
        .addEventListener('click', () => cleanup(false));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) cleanup(false);
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') {
          cleanup(false);
          document.removeEventListener('keydown', esc);
        }
      });
    });
  };

  /* ==========================================================================
     13. EVENT BUS (pub/sub)
     ==========================================================================
     Usage:
       APP.Bus.on('role:changed', (id) => { ... });
       APP.Bus.emit('role:changed', 'director');
     ========================================================================== */
  const Bus = {
    _events: {},
    on(event, handler) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(handler);
      return () => this.off(event, handler);
    },
    off(event, handler) {
      if (!this._events[event]) return;
      this._events[event] = this._events[event].filter(h => h !== handler);
    },
    emit(event, ...args) {
      (this._events[event] || []).forEach(fn => {
        try { fn(...args); } catch (e) { console.warn('[Bus]', e); }
      });
    }
  };

  APP.Bus = Bus;

  /* ==========================================================================
     14. AUTO-INIT
     ========================================================================== */
  function init() {
    // 1. Apply theme ASAP (before render)
    Theme.init();
    Theme.watchSystem();

    // 2. Wire up UI on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  }

  function onReady() {
    Nav.init();
    Sidebar.init();
    Topbar.init();

    // Expose a friendly startup log
    console.log(
      `%c${APP.name} · v${APP.version}`,
      'color:#D4AF37; background:#7B1113; padding:4px 10px; border-radius:4px; font-weight:700;'
    );
    console.log('Logged in as:', Role.current().label);
  }

  init();

})();