/**
 * GeoScore Auth Client
 * Google OAuth Single Sign-On (Pure SSO)
 * Auto-injected into all pages via Layout.astro.
 */

const API_BASE = 'https://geoscore-payments.geo-score.workers.dev';

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

(function() {
  // Google Identity Services script
  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';
  gisScript.async = true;
  gisScript.defer = true;
  document.head.appendChild(gisScript);

  // State
  let currentUser = null;
  const authListeners = [];

  function authSource() {
    return typeof window.geoSource === 'function' ? window.geoSource() : 'other';
  }

  function trackSignIn(method, state) {
    if (typeof window.geoTrack === 'function') {
      window.geoTrack('sign_in', { method, state, source_type: authSource() });
    }
  }

  function notifyAuth() {
    authListeners.forEach(function(fn) { try { fn(currentUser); } catch (e) {} });
  }

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', initAuth);

  // Fetch with timeout (5s) to avoid hanging on unreachable Worker
  async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return resp;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // JSON API wrapper for Pro features: attaches Bearer token, parses JSON,
  // clears the session on 401. Pass { raw: true } to get the Response itself.
  async function api(path, options) {
    options = options || {};
    var token = localStorage.getItem('geoscore_token');
    var headers = Object.assign({}, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var body = options.body;
    if (body !== undefined && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    var resp = await fetchWithTimeout(API_BASE + path, Object.assign({}, options, { headers: headers, body: body }), options.timeoutMs || 15000);
    if (resp.status === 401) {
      localStorage.removeItem('geoscore_token');
      currentUser = null;
      updateUI();
      notifyAuth();
    }
    if (options.raw) return resp;
    var data = null;
    try { data = await resp.json(); } catch (e) {}
    return { ok: resp.ok, status: resp.status, data: data };
  }

  async function initAuth() {
    const token = localStorage.getItem('geoscore_token');
    if (token) {
      try {
        const resp = await fetchWithTimeout(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          currentUser = data.user;
          updateUI();
        } else {
          localStorage.removeItem('geoscore_token');
          updateUI();
        }
      } catch (e) {
        updateUI();
      }
    }
    setupLoginModal();
    updateUI();
    notifyAuth();
  }

  function setupLoginModal() {
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/60 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="card p-8 max-w-sm w-full mx-4 relative border border-gray-700 bg-gray-900/95 rounded-2xl shadow-2xl">
        <button id="auth-close" class="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl transition">&times;</button>
        <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-brand-600 to-geo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">G</div>
        <h2 class="text-2xl font-bold text-center mb-1 text-white">${t('Sign in to GeoScore', '登录 GeoScore')}</h2>
        <p class="text-sm text-gray-400 text-center mb-6">${t('Access your dashboard, audits and Pro features', '访问控制台、历史审计报告与 Pro 权益')}</p>

        <!-- Google Login -->
        <div id="g-btn-container" class="mb-4">
          <button id="google-login-btn" class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 transition text-sm font-semibold shadow-md active:scale-[0.98]">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>${t('Continue with Google', '使用 Google 账号继续')}</span>
          </button>
        </div>

        <p id="auth-error" class="text-sm text-red-400 text-center mt-3 hidden"></p>
        <p id="auth-info" class="text-sm text-gray-400 text-center mt-3 hidden"></p>

        <p class="text-xs text-gray-500 text-center mt-6">${t('By signing in, you agree to our ', '登录即表示你同意我们的 ')}<a href="${t('/terms/', '/zh/terms/')}" class="underline hover:text-gray-300">${t('Terms', '服务条款')}</a> ${t('and', '和')} <a href="${t('/privacy/', '/zh/privacy/')}" class="underline hover:text-gray-300">${t('Privacy Policy', '隐私政策')}</a>.</p>
      </div>
    `;
    document.body.appendChild(modal);

    // Close button
    modal.querySelector('#auth-close').addEventListener('click', closeAuthModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuthModal();
    });

    // Google login
    modal.querySelector('#google-login-btn').addEventListener('click', triggerGoogleLogin);
  }

  function triggerGoogleLogin() {
    const errorEl = document.querySelector('#auth-error');
    const infoEl = document.querySelector('#auth-info');
    if (errorEl) errorEl.classList.add('hidden');
    if (infoEl) {
      infoEl.textContent = t('Connecting to Google...', '正在连接 Google...');
      infoEl.classList.remove('hidden');
    }

    if (window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: '154080569698-1e94rhuipkvgboc6fqfp94fndkodmtea.apps.googleusercontent.com',
        callback: handleGoogleCallback
      });
      google.accounts.id.prompt();
    } else {
      setTimeout(triggerGoogleLogin, 500);
    }
  }

  async function handleGoogleCallback(response) {
    const errorEl = document.querySelector('#auth-error');
    const infoEl = document.querySelector('#auth-info');
    if (infoEl) { infoEl.textContent = t('Signing in with Google...', '正在使用 Google 登录...'); infoEl.classList.remove('hidden'); }
    if (errorEl) { errorEl.classList.add('hidden'); }
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await resp.json();
      if (resp.ok && data.token) {
        localStorage.setItem('geoscore_token', data.token);
        currentUser = data.user;
        trackSignIn('google', 'completed');
        closeAuthModal();
        updateUI();
        location.reload();
      } else {
        if (errorEl) { errorEl.textContent = data.error || t('Google login failed', 'Google 登录失败'); errorEl.classList.remove('hidden'); }
        if (infoEl) { infoEl.classList.add('hidden'); }
      }
    } catch (e) {
      if (errorEl) { errorEl.textContent = t('Network error during Google login', 'Google 登录时网络错误'); errorEl.classList.remove('hidden'); }
      if (infoEl) { infoEl.classList.add('hidden'); }
    }
  }

  function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function logout() {
    localStorage.removeItem('geoscore_token');
    currentUser = null;
    location.reload();
  }

  function updateUI() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;

    if (currentUser) {
      const initial = (currentUser.name || currentUser.email)[0].toUpperCase();
      const planLabel = currentUser.plan !== 'free' 
        ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-brand-500/20 text-brand-400">${currentUser.plan.toUpperCase()}</span>` 
        : '';
      // Escape user data to prevent XSS
      const safeName = (currentUser.name || currentUser.email).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      navAuth.innerHTML = `
        <div class="relative group">
          <button class="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-gray-800 transition text-sm">
            <div class="w-7 h-7 rounded-full bg-gradient-to-r from-geo-500 to-brand-500 flex items-center justify-center text-white text-xs font-bold">${initial}</div>
            <span class="text-gray-300 hidden sm:inline">${safeName}</span>
            ${planLabel}
          </button>
          <div class="absolute right-0 top-full mt-1 w-48 card p-2 hidden group-hover:block z-50">
            <div class="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">${safeName}</div>
            <a href="${t('/pricing/', '/zh/pricing/')}" class="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition">${t('Subscription', '订阅计划')}</a>
            <button id="auth-logout-btn" class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded transition">${t('Sign Out', '退出登录')}</button>
          </div>
        </div>
      `;
      const logoutBtn = navAuth.querySelector('#auth-logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
      navAuth.innerHTML = `
        <button id="auth-login-btn" class="py-1.5 px-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition">
          ${t('Sign In', '登录')}
        </button>
      `;
      const loginBtn = navAuth.querySelector('#auth-login-btn');
      if (loginBtn) loginBtn.addEventListener('click', openAuthModal);
    }
  }

  // Public API
  window.GeoScoreAuth = {
    getUser: () => currentUser,
    openLogin: openAuthModal,
    closeLogin: closeAuthModal,
    logout: logout,
    onAuthChange: (fn) => { authListeners.push(fn); if (currentUser) fn(currentUser); },
    api: api,
    track: trackSignIn
  };
})();