/**
 * GeoScore Auth Client
 * Handles Google OAuth + Email verification code login.
 * Auto-injected into all pages via Layout.astro.
 */

const API_BASE = 'https://geoscore-payments.gstorch.workers.dev';

(function() {
  // Google Identity Services script
  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';
  gisScript.async = true;
  gisScript.defer = true;
  document.head.appendChild(gisScript);

  // State
  let currentUser = null;

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', initAuth);

  async function initAuth() {
    const token = localStorage.getItem('geoscore_token');
    if (token) {
      try {
        const resp = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          currentUser = data.user;
          updateUI();
        } else {
          localStorage.removeItem('geoscore_token');
        }
      } catch (e) {
        // Network error, keep token for later
      }
    }
    setupLoginModal();
  }

  function setupLoginModal() {
    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/60 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="card p-8 max-w-sm w-full mx-4 relative">
        <button id="auth-close" class="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">&times;</button>
        <h2 class="text-2xl font-bold text-center mb-2">Sign in to GeoScore</h2>
        <p class="text-sm text-gray-400 text-center mb-6">Access your dashboard and subscription</p>

        <!-- Google Login -->
        <div id="g-btn-container" class="mb-4">
          <button id="google-login-btn" class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-600 hover:border-gray-400 transition text-sm font-medium">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>

        <div class="flex items-center gap-3 my-4">
          <div class="flex-1 h-px bg-gray-700"></div>
          <span class="text-xs text-gray-500">or</span>
          <div class="flex-1 h-px bg-gray-700"></div>
        </div>

        <!-- Email Login -->
        <form id="email-login-form" class="space-y-3">
          <input type="email" id="auth-email" placeholder="Email address" required
            class="w-full px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none" />
          <div id="code-row" class="hidden">
            <input type="text" id="auth-code" placeholder="6-digit code" maxlength="6"
              class="w-full px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none tracking-widest text-center" />
          </div>
          <button type="button" id="send-code-btn" class="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition">
            Send Verification Code
          </button>
          <button type="submit" id="verify-btn" class="hidden w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-500 transition">
            Verify & Sign In
          </button>
        </form>

        <p id="auth-error" class="text-sm text-red-400 text-center mt-3 hidden"></p>
        <p id="auth-info" class="text-sm text-gray-400 text-center mt-3 hidden"></p>

        <p class="text-xs text-gray-500 text-center mt-4">By signing in, you agree to our <a href="/terms/" class="underline hover:text-gray-300">Terms</a> and <a href="/privacy/" class="underline hover:text-gray-300">Privacy Policy</a>.</p>
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

    // Email login flow
    const sendBtn = modal.querySelector('#send-code-btn');
    const verifyBtn = modal.querySelector('#verify-btn');
    const codeRow = modal.querySelector('#code-row');
    const form = modal.querySelector('#email-login-form');
    const errorEl = modal.querySelector('#auth-error');
    const infoEl = modal.querySelector('#auth-info');

    sendBtn.addEventListener('click', async () => {
      const email = modal.querySelector('#auth-email').value.trim();
      if (!email) { showError('Please enter your email'); return; }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      hideError();
      try {
        const resp = await fetch(`${API_BASE}/auth/send-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await resp.json();
        if (resp.ok) {
          codeRow.classList.remove('hidden');
          verifyBtn.classList.remove('hidden');
          sendBtn.classList.add('hidden');
          showInfo('Code sent! Check your inbox (and spam folder).');
        } else {
          showError(data.error || 'Failed to send code');
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send Verification Code';
        }
      } catch (e) {
        showError('Network error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Verification Code';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = modal.querySelector('#auth-email').value.trim();
      const code = modal.querySelector('#auth-code').value.trim();
      if (!email || !code) { showError('Enter email and code'); return; }
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
      hideError();
      try {
        const resp = await fetch(`${API_BASE}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code })
        });
        const data = await resp.json();
        if (resp.ok && data.token) {
          localStorage.setItem('geoscore_token', data.token);
          currentUser = data.user;
          closeAuthModal();
          updateUI();
          location.reload();
        } else {
          showError(data.error || 'Verification failed');
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify & Sign In';
        }
      } catch (e) {
        showError('Network error');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify & Sign In';
      }
    });

    function showError(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
    function hideError() { errorEl.classList.add('hidden'); }
    function showInfo(msg) { infoEl.textContent = msg; infoEl.classList.remove('hidden'); }
  }

  function triggerGoogleLogin() {
    if (window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: '154080569698-1e94rhuipkvgboc6fqfp94fndkodmtea.apps.googleusercontent.com',
        callback: handleGoogleCallback
      });
      google.accounts.id.prompt();
    } else {
      // Fallback: wait for script to load
      setTimeout(triggerGoogleLogin, 500);
    }
  }

  async function handleGoogleCallback(response) {
    try {
      const resp = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await resp.json();
      if (resp.ok && data.token) {
        localStorage.setItem('geoscore_token', data.token);
        currentUser = data.user;
        closeAuthModal();
        updateUI();
        location.reload();
      } else {
        alert(data.error || 'Google login failed');
      }
    } catch (e) {
      alert('Network error during Google login');
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
      navAuth.innerHTML = `
        <div class="relative" id="user-menu-wrapper">
          <button id="user-menu-btn" class="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition">
            ${currentUser.avatar 
              ? `<img src="${currentUser.avatar}" class="w-7 h-7 rounded-full" alt="avatar" />`
              : `<div class="w-7 h-7 rounded-full bg-gradient-to-r from-geo-600 to-brand-600 flex items-center justify-center text-xs font-bold">${initial}</div>`
            }
            <span class="hidden sm:inline">${currentUser.name || currentUser.email.split('@')[0]}</span>
            ${planLabel}
          </button>
          <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-48 card p-2 z-50">
            <div class="px-3 py-2 border-b border-gray-700 text-xs text-gray-400">
              ${currentUser.email}
            </div>
            <a href="/pricing/" class="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 rounded transition">Upgrade Plan</a>
            <button id="logout-btn" class="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/50 rounded transition">Sign Out</button>
          </div>
        </div>
      `;

      // Dropdown toggle
      const btn = document.getElementById('user-menu-btn');
      const dropdown = document.getElementById('user-dropdown');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', () => dropdown.classList.add('hidden'));
      document.getElementById('logout-btn').addEventListener('click', logout);
    } else {
      navAuth.innerHTML = `<button id="login-btn" class="text-sm text-gray-300 hover:text-white transition px-3 py-1.5 rounded-lg border border-gray-600 hover:border-brand-500">Sign In</button>`;
      document.getElementById('login-btn').addEventListener('click', openAuthModal);
    }
  }

  // Expose for inline buttons
  window.geoscoreAuth = { openAuthModal, logout, getCurrentUser: () => currentUser };
})();