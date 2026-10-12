/* ==========================================================================
   UPHSD MOLINO — DIRECTOR'S OFFICE E-DOCUMENT SYSTEM
   Shared JavaScript (app.js) — v1.2.0
   --------------------------------------------------------------------------
   1.  App namespace & configuration
   2.  Storage helpers (localStorage wrapper)
   3.  Users table (hardcoded for now — replace with backend later)
   4.  Roles & permissions (aligned with eDocumentFlow UML diagrams)
   5.  Authentication (login, logout, requireLogin)
   6.  Theme (dark mode) management
   7.  Toast notifications
   8.  Mobile sidebar toggle
   9.  Sidebar active-link highlighting
   10. Topbar (user chip, theme toggle)
   11. Utility helpers
   12. Modal helpers
   13. Confirm dialog
   14. Event bus
   15. Sidebar permission hiding
   16. Auto-init
   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================================
     1. APP NAMESPACE & CONFIG
     ========================================================================== */
  const APP = {
    name: 'UPHSD Molino — Director\'s Office',
    version: '1.2.0',
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
      routing: 'routing.html',
      approvals: 'approvals.html',
      accounts: 'accounts.html',
      reports: 'reports.html',
      notifications: 'notifications.html',
      settings: 'settings.html'
    }
  };

  window.APP = APP;

  /* ==========================================================================
     2. STORAGE HELPERS
     ========================================================================== */
  const Storage = {
    get(key, fallback = null) {
      try {
        const val = localStorage.getItem(key);
        if (val === null) return fallback;
        try { return JSON.parse(val); } catch (e) { return val; }
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
          .filter(k => k.startsWith(APP.storagePrefix) || k.startsWith('uphsd'))
          .forEach(k => localStorage.removeItem(k));
      } catch (e) {}
    }
  };

  APP.Storage = Storage;

  /* ==========================================================================
     3. USERS TABLE (hardcoded — replace with backend later)
     ========================================================================== */
  const USERS = [
    {
      email: 'renoreyel@perpetual.edu.ph',
      password: 'sd123',
      role: 'director',
      name: 'Reno Reyel',
      initials: 'RR',
      dept: "Director's Office",
      position: 'School Director'
    },
    {
      email: 'ea@perpetual.edu.ph',
      password: 'ea123',
      role: 'ea',
      name: 'EA',
      initials: 'EA',
      dept: "Director's Office",
      position: 'Executive Assistant'
    },
    {
      email: 'sec@perpetual.edu.ph',
      password: 'sec123',
      role: 'secretary',
      name: 'Sec',
      initials: 'SC',
      dept: "Director's Office",
      position: 'Secretary'
    }
  ];

  APP.USERS = USERS;

  /* ==========================================================================
     4. ROLES & PERMISSIONS
     ========================================================================== */
  const ROLES = {
    secretary: {
      id: 'secretary',
      label: 'Secretary',
      permissions: [
        'account:add', 'account:edit', 'account:delete', 'account:view',
        'document:add', 'document:edit', 'document:delete', 'document:view',
        'routing:route', 'routing:update', 'routing:track', 'routing:view',
        'approval:submit',
        'notification:view', 'notification:email',
        'report:generate', 'report:view', 'report:print'
      ]
    },
    ea: {
      id: 'ea',
      label: 'Executive Assistant',
      permissions: [
        'account:add', 'account:edit', 'account:delete', 'account:view',
        'document:edit', 'document:delete', 'document:view',
        'routing:update', 'routing:track', 'routing:view',
        'approval:submit',
        'notification:view', 'notification:email',
        'report:generate', 'report:view', 'report:print'
      ]
    },
    director: {
      id: 'director',
      label: 'School Director',
      permissions: [
        'account:edit', 'account:view', 'account:authorize',
        'document:edit', 'document:delete', 'document:view',
        'routing:view',
        'approval:review',
        'notification:view', 'notification:email',
        'report:view', 'report:print'
      ]
    }
  };

  const PAGE_MODULE_MAP = {
    'accounts.html':      'account',
    'documents.html':     'document',
    'routing.html':       'routing',
    'approvals.html':     'approval',
    'reports.html':       'report',
    'notifications.html': 'notification',
    'settings.html':      'notification'
  };

  const LEGACY_ACTION_ALIASES = {
    'add':       ['account:add', 'document:add'],
    'edit':      ['account:edit', 'document:edit'],
    'delete':    ['account:delete', 'document:delete'],
    'view':      ['account:view', 'document:view'],
    'authorize': ['account:authorize', 'approval:review'],
    'review':    ['approval:review'],
    'submit':    ['approval:submit'],
    'route':     ['routing:route'],
    'update':    ['routing:update'],
    'track':     ['routing:track'],
    'generate':  ['report:generate'],
    'print':     ['report:print'],
    'email':     ['notification:email']
  };

  function currentModuleFromPage() {
    const page = window.location.pathname.split('/').pop() || 'dashboard.html';
    return PAGE_MODULE_MAP[page] || null;
  }

  const Role = {
    current() {
      const user = Auth.currentUser();
      const id = user ? user.role : Storage.get(APP.keys.role, 'secretary');
      return ROLES[id] || ROLES.secretary;
    },

    id() {
      return this.current().id;
    },

    can(action) {
      if (!action) return false;
      const perms = this.current().permissions;
      if (perms.includes(action)) return true;

      if (!action.includes(':')) {
        const mod = currentModuleFromPage();
        if (mod && perms.includes(`${mod}:${action}`)) return true;
        const aliases = LEGACY_ACTION_ALIASES[action];
        if (aliases && aliases.some(p => perms.includes(p))) return true;
      }
      return false;
    },

    canAny(actions) {
      return (actions || []).some(a => this.can(a));
    },

    canAll(actions) {
      return (actions || []).every(a => this.can(a));
    },

    set(roleId) {
      if (!ROLES[roleId]) return false;
      Storage.set(APP.keys.role, roleId);
      this._renderUserChip();
      Bus.emit('role:changed', roleId);
      return true;
    },

    all() { return ROLES; },
    get(id) { return ROLES[id]; },
    currentModule() { return currentModuleFromPage(); },

    _renderUserChip() {
      const user = Auth.currentUser();
      if (!user) return;
      const nameEl = document.getElementById('userName');
      const roleEl = document.getElementById('userRoleLabel');
      const avEl   = document.getElementById('userAvatar');
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.position || (ROLES[user.role] ? ROLES[user.role].label : user.role);
      if (avEl)   avEl.textContent   = user.initials;
    }
  };

  APP.Role = Role;

  /* ==========================================================================
     5. AUTHENTICATION
     ========================================================================== */
  const Auth = {
    async login(email, password) {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 600));

      if (!email || !password) {
        return { success: false, message: 'Please enter your email and password.' };
      }

      const user = USERS.find(
        u => u.email.toLowerCase() === email.toLowerCase().trim() &&
             u.password === password
      );

      if (!user) {
        return { success: false, message: 'Invalid email or password. Please try again.' };
      }

      const session = {
        email: user.email,
        role: user.role,
        name: user.name,
        initials: user.initials,
        dept: user.dept,
        position: user.position,
        loggedInAt: new Date().toISOString()
      };

      Storage.set(APP.keys.loggedIn, true);
      Storage.set(APP.keys.user, session);
      Storage.set(APP.keys.role, user.role);

      return { success: true, user: session };
    },

    logout() {
      Storage.remove(APP.keys.loggedIn);
      Storage.remove(APP.keys.user);
      Storage.remove(APP.keys.authToken);
      window.location.href = APP.routes.login;
    },

    currentUser() {
      return Storage.get(APP.keys.user, null);
    },

    isLoggedIn() {
      return !!Storage.get(APP.keys.loggedIn) && !!this.currentUser();
    },

    requireLogin() {
      if (!this.isLoggedIn()) {
        const attempted = window.location.pathname.split('/').pop();
        if (attempted && attempted !== 'login.html' && attempted !== '') {
          try {
            sessionStorage.setItem('uphsdRedirectAfterLogin', attempted);
          } catch (e) {}
        }
        window.location.href = APP.routes.login;
        return false;
      }
      return true;
    },

    redirectAfterLogin() {
      let attempted = null;
      try {
        attempted = sessionStorage.getItem('uphsdRedirectAfterLogin');
        sessionStorage.removeItem('uphsdRedirectAfterLogin');
      } catch (e) {}

      const target = attempted && attempted !== 'login.html'
        ? attempted
        : APP.routes.dashboard;

      window.location.href = target;
    },

    skipLoginIfLoggedIn() {
      if (this.isLoggedIn()) {
        this.redirectAfterLogin();
      }
    }
  };

  APP.Auth = Auth;

  /* ==========================================================================
     6. THEME (DARK MODE)
     ========================================================================== */
  const Theme = {
    _listeners: [],

    init() {
      this.apply(this.getInitial());
    },

    getInitial() {
      const saved = Storage.get(APP.keys.theme);
      if (saved === 'dark' || saved === 'light') return saved;
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
        ? '<path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z"/>'
        : '<path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM4.22 4.22a1 1 0 011.42 0l1.42 1.42a1 1 0 11-1.42 1.42L4.22 5.64a1 1 0 010-1.42zm12.72 12.72a1 1 0 011.42 0l1.42 1.42a1 1 0 11-1.42 1.42l-1.42-1.42a1 1 0 010-1.42zM2 12a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm18 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM4.22 19.78a1 1 0 010-1.42l1.42-1.42a1 1 0 111.42 1.42l-1.42 1.42a1 1 0 01-1.42 0zM16.94 7.06a1 1 0 010-1.42l1.42-1.42a1 1 0 111.42 1.42l-1.42 1.42a1 1 0 01-1.42 0z"/>';
    },

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
     7. TOAST NOTIFICATIONS
     ========================================================================== */
  const Toast = {
    _icons: {
      success: '<svg viewBox="0 0 24 24" fill="#2ed573"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
      gold:    '<svg viewBox="0 0 24 24" fill="#D4AF37"><path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"/></svg>',
      error:   '<svg viewBox="0 0 24 24" fill="#ff4757"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="#4682dc"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
    },

    show(type, title, message, duration) {
      type = type || 'info';
      title = title || '';
      message = message || '';
      duration = duration || 3800;

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

      toast.innerHTML = 
        '<div class="toast-icon">' + (this._icons[type] || this._icons.info) + '</div>' +
        '<div class="toast-text">' +
          '<h4>' + Utils.escapeHtml(title) + '</h4>' +
          '<p>' + Utils.escapeHtml(message) + '</p>' +
        '</div>';

      container.appendChild(toast);

      setTimeout(function () {
        toast.classList.add('fade-out');
        setTimeout(function () { toast.remove(); }, 300);
      }, duration);
    },

    success(title, msg) { this.show('success', title, msg); },
    error(title, msg)   { this.show('error', title, msg); },
    info(title, msg)    { this.show('info', title, msg); },
    gold(title, msg)    { this.show('gold', title, msg); }
  };

  APP.Toast = Toast;

  /* ==========================================================================
     8. MOBILE SIDEBAR
     ========================================================================== */
  const Sidebar = {
    init() {
      const hamburger = document.getElementById('hamburger');
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('overlayBackdrop');
      if (!hamburger || !sidebar) return;

      const self = this;
      hamburger.addEventListener('click', function () { self.open(); });
      if (backdrop) backdrop.addEventListener('click', function () { self.close(); });

      sidebar.querySelectorAll('.nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
          if (window.innerWidth <= 900) self.close();
        });
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') self.close();
      });

      window.addEventListener('resize', function () {
        if (window.innerWidth > 900) self.close();
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
     9. SIDEBAR ACTIVE LINK HIGHLIGHTING
     ========================================================================== */
  const Nav = {
    init() {
      const currentPage = this._currentPage();
      document.querySelectorAll('.nav-item').forEach(function (item) {
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

    go(page) {
      const map = APP.routes;
      const target = map[page] || page;
      window.location.href = target;
    }
  };

  APP.Nav = Nav;

  /* ==========================================================================
     10. TOPBAR AUTO-WIRING
     ========================================================================== */
  const Topbar = {
    init() {
      const themeBtn = document.getElementById('themeToggle');
      if (themeBtn) {
        themeBtn.addEventListener('click', function () { Theme.toggle(); });
      }

      const chip = document.getElementById('userChip');
      if (chip) {
        chip.addEventListener('click', function () {
          const user = Auth.currentUser();
          const name = user ? user.name : 'this account';
          if (confirm('Log out of ' + name + '\'s session?')) {
            Auth.logout();
          }
        });
      }

      Role._renderUserChip();

      document.querySelectorAll('[data-year]').forEach(function (el) {
        el.textContent = new Date().getFullYear();
      });
      const yearEl = document.getElementById('year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
  };

  APP.Topbar = Topbar;

  /* ==========================================================================
     11. UTILITY HELPERS
     ========================================================================== */
  const Utils = {
    escapeHtml: function (str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    getInitials: function (name) {
      if (!name) return '?';
      return name.trim().split(/\s+/)
        .map(function (w) { return w[0]; })
        .slice(0, 2).join('').toUpperCase();
    },

    formatDate: function (date, opts) {
      opts = opts || {};
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      const base = { year: 'numeric', month: 'short', day: 'numeric' };
      const merged = Object.assign(base, opts);
      return d.toLocaleDateString('en-US', merged);
    },

    formatDateTime: function (date) {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      return this.formatDate(d) + ' · ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    timeAgo: function (date) {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '—';
      const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
      if (seconds < 60) return 'just now';
      const mins = Math.floor(seconds / 60);
      if (mins < 60) return mins + ' min ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
      const days = Math.floor(hrs / 24);
      if (days < 30) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
      return this.formatDate(d);
    },

    debounce: function (fn, wait) {
      wait = wait || 300;
      let timeout;
      return function () {
        const args = arguments;
        const ctx = this;
        clearTimeout(timeout);
        timeout = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    },

    throttle: function (fn, limit) {
      limit = limit || 200;
      let inThrottle;
      return function () {
        const args = arguments;
        const ctx = this;
        if (!inThrottle) {
          fn.apply(ctx, args);
          inThrottle = true;
          setTimeout(function () { inThrottle = false; }, limit);
        }
      };
    },

    uid: function (prefix) {
      prefix = prefix || 'id';
      return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    },

    isValidEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    capitalize: function (str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    number: function (n) {
      return Number(n || 0).toLocaleString('en-US');
    },

    truncate: function (str, len) {
      len = len || 40;
      if (!str) return '';
      return str.length > len ? str.slice(0, len - 1) + '…' : str;
    },

    clone: function (obj) {
      try { return JSON.parse(JSON.stringify(obj)); }
      catch (e) { return obj; }
    },

    qs: function (name) {
      return new URLSearchParams(window.location.search).get(name);
    },

    cssVar: function (name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
  };

  APP.Utils = Utils;

  /* ==========================================================================
     12. MODAL HELPERS
     ========================================================================== */
  const Modal = {
    open: function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('show');
      document.body.style.overflow = 'hidden';

      el.addEventListener('click', function (e) {
        if (e.target === el) Modal.close(id);
      });

      const escHandler = function (e) {
        if (e.key === 'Escape') {
          Modal.close(id);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    },

    close: function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      document.body.style.overflow = '';
    },

    closeAll: function () {
      document.querySelectorAll('.modal-backdrop.show').forEach(function (el) {
        el.classList.remove('show');
      });
      document.body.style.overflow = '';
    }
  };

  APP.Modal = Modal;

  /* ==========================================================================
     13. CONFIRM DIALOG
     ========================================================================== */
  APP.confirm = function (opts) {
    opts = opts || {};
    const title = opts.title || 'Are you sure?';
    const message = opts.message || '';
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText = opts.cancelText || 'Cancel';
    const danger = opts.danger || false;

    return new Promise(function (resolve) {
      const id = 'appConfirmModal_' + Date.now();
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.id = id;

      backdrop.innerHTML = 
        '<div class="modal" style="max-width:420px;">' +
          '<div class="modal-header">' +
            '<div style="flex:1;">' +
              '<h2>' + Utils.escapeHtml(title) + '</h2>' +
              (message ? '<p>' + Utils.escapeHtml(message) + '</p>' : '') +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-ghost" data-role="cancel">' + Utils.escapeHtml(cancelText) + '</button>' +
            '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-role="confirm">' + Utils.escapeHtml(confirmText) + '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('show'); });
      document.body.style.overflow = 'hidden';

      function cleanup(result) {
        backdrop.classList.remove('show');
        setTimeout(function () {
          backdrop.remove();
          document.body.style.overflow = '';
        }, 200);
        resolve(result);
      }

      backdrop.querySelector('[data-role="confirm"]').addEventListener('click', function () { cleanup(true); });
      backdrop.querySelector('[data-role="cancel"]').addEventListener('click', function () { cleanup(false); });
      backdrop.addEventListener('click', function (e) {
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
     14. EVENT BUS
     ========================================================================== */
  const Bus = {
    _events: {},
    on: function (event, handler) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(handler);
      const self = this;
      return function () { self.off(event, handler); };
    },
    off: function (event, handler) {
      if (!this._events[event]) return;
      this._events[event] = this._events[event].filter(function (h) { return h !== handler; });
    },
    emit: function (event) {
      const args = Array.prototype.slice.call(arguments, 1);
      (this._events[event] || []).forEach(function (fn) {
        try { fn.apply(null, args); } catch (e) { console.warn('[Bus]', e); }
      });
    }
  };

  APP.Bus = Bus;

  /* ==========================================================================
     15. SIDEBAR PERMISSION HIDING
     ========================================================================== */
  function applySidebarPermissions() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
      const page = item.getAttribute('data-page');
      const requiredMap = {
        'accounts.html':      ['account:view'],
        'documents.html':     ['document:view'],
        'routing.html':       ['routing:view'],
        'approvals.html':     ['approval:submit', 'approval:review'],
        'reports.html':       ['report:view'],
        'notifications.html': ['notification:view'],
        'settings.html':      []
      };
      const required = requiredMap[page];
      if (required && required.length > 0) {
        const allowed = required.some(function (p) { return Role.can(p); });
        item.style.display = allowed ? '' : 'none';
      }
    });
  }

  APP.applySidebarPermissions = applySidebarPermissions;

  /* ==========================================================================
     16. AUTO-INIT
     ========================================================================== */
  function init() {
    Theme.init();
    Theme.watchSystem();

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
    applySidebarPermissions();

    console.log(
      '%c' + APP.name + ' · v' + APP.version,
      'color:#D4AF37; background:#7B1113; padding:4px 10px; border-radius:4px; font-weight:700;'
    );
    const user = Auth.currentUser();
    if (user) {
      console.log('Logged in as:', user.name, '(' + user.role + ')');
      console.log('Current module:', Role.currentModule() || '(dashboard)');
      console.log('Permissions:', Role.current().permissions);
    } else {
      console.log('Not logged in.');
    }
  }

  init();

})();