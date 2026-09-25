/**
 * Nihongo Pathway Authentication Integration for JFT-Basic
 * Connects directly to Supabase project: https://bynxrlybssnxjrbijitq.supabase.co
 */

(function () {
  const SUPABASE_URL = 'https://bynxrlybssnxjrbijitq.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_egUPz76TLOJdocc8XollaQ_HjuPz4Y3';
  const REQUIRE_AUTH = true; // Gate the app: requires Nihongo Pathway login

  let supabaseClient = null;
  let currentUser = null;
  let authListeners = [];

  function checkAccessGate() {
    if (!REQUIRE_AUTH) return;
    const modal = document.getElementById('np-auth-modal-root');
    if (!currentUser) {
      document.body.classList.add('np-auth-locked');
      if (modal) {
        modal.classList.add('active', 'np-blocking');
      } else {
        injectAuthModal();
        const m = document.getElementById('np-auth-modal-root');
        if (m) m.classList.add('active', 'np-blocking');
      }
    } else {
      document.body.classList.remove('np-auth-locked');
      if (modal && modal.classList.contains('np-blocking')) {
        modal.classList.remove('active', 'np-blocking');
      }
    }
  }

  // Initialize Supabase Client
  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      return supabaseClient;
    }
    return null;
  }

  // Ensure Supabase JS library is loaded
  function ensureSupabaseScript(callback) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      if (callback) callback();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
      getSupabaseClient();
      if (callback) callback();
    };
    script.onerror = () => {
      console.error('[NihongoAuth] Failed to load Supabase SDK from CDN.');
    };
    document.head.appendChild(script);
  }

  // Load user profile from Supabase 'users' table
  async function fetchUserProfile(sbUser) {
    if (!sbUser) return null;
    const client = getSupabaseClient();
    if (!client) return { uid: sbUser.id, email: sbUser.email, displayName: sbUser.email.split('@')[0], role: 'student' };

    try {
      const { data, error } = await client
        .from('users')
        .select('displayName, name, email, role, branch, studentId')
        .or(`uid.eq.${sbUser.id},auth_id.eq.${sbUser.id}`)
        .maybeSingle();

      if (!error && data) {
        return {
          uid: sbUser.id,
          email: sbUser.email,
          displayName: data.displayName || data.name || sbUser.email.split('@')[0],
          role: data.role || 'student',
          branch: data.branch || '',
          studentId: data.studentId || ''
        };
      }
    } catch (e) {
      console.warn('[NihongoAuth] Profile fetch fallback:', e);
    }

    return {
      uid: sbUser.id,
      email: sbUser.email,
      displayName: sbUser.user_metadata?.name || sbUser.email.split('@')[0],
      role: 'student'
    };
  }

  // Hardware Fingerprint: Same physical machine produces the exact same ID
  async function getHardwareDeviceId() {
    try {
      const canvas = document.createElement('canvas');
      let renderer = '';
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }

      const components = [
        navigator.platform || '',
        navigator.hardwareConcurrency || 4,
        screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        renderer
      ].join('###');

      const msgBuffer = new TextEncoder().encode(components);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return 'hw_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
    } catch (e) {
      let fallback = localStorage.getItem('np_device_uuid') || ('web_' + Math.random().toString(36).substring(2));
      localStorage.setItem('np_device_uuid', fallback);
      return fallback;
    }
  }

  // Device verification and binding rule
  async function verifyAndBindDevice(userProfile) {
    if (!userProfile) return { allowed: true };
    const role = (userProfile.role || '').toLowerCase();
    if (['super_admin', 'superadmin', 'branch_manager', 'branchmanager'].includes(role)) {
      return { allowed: true };
    }

    try {
      const client = getSupabaseClient();
      if (!client) return { allowed: true };

      const currentDeviceId = await getHardwareDeviceId();
      const userId = userProfile.uid;

      const { data: dbUser, error } = await client
        .from('users')
        .select('device_id, device_ids, device_limit')
        .or(`uid.eq.${userId},auth_id.eq.${userId}`)
        .maybeSingle();

      if (error || !dbUser) return { allowed: true };

      const limit = dbUser.device_limit ?? 1;
      if (limit <= 0) return { allowed: true, deviceId: currentDeviceId };

      let devices = Array.isArray(dbUser.device_ids) ? dbUser.device_ids : [];
      if (dbUser.device_id && !devices.includes(dbUser.device_id)) {
        devices = [...devices, dbUser.device_id];
      }

      // 1. No device bound yet -> Bind this device
      if (devices.length === 0) {
        await client
          .from('users')
          .update({ device_id: currentDeviceId, device_ids: [currentDeviceId] })
          .or(`uid.eq.${userId},auth_id.eq.${userId}`);
        return { allowed: true, deviceId: currentDeviceId };
      }

      // 2. Current device already registered -> Access allowed
      if (devices.includes(currentDeviceId)) {
        return { allowed: true, deviceId: currentDeviceId };
      }

      // 3. Room for another device -> Register it
      if (devices.length < limit) {
        const updatedDevices = [...devices, currentDeviceId];
        await client
          .from('users')
          .update({ device_id: updatedDevices[0], device_ids: updatedDevices })
          .or(`uid.eq.${userId},auth_id.eq.${userId}`);
        return { allowed: true, deviceId: currentDeviceId, devices: updatedDevices };
      }

      // 4. Limit reached on a different physical device -> Block access
      return {
        allowed: false,
        message: 'This account is limited to 1 device. You can use any browser on the same phone or computer. A different phone or computer will be blocked. Contact your institute if you need another device.'
      };
    } catch (err) {
      console.warn('Device verification fallback:', err);
      return { allowed: true };
    }
  }

  // Create & Inject Modal HTML
  function injectAuthModal() {
    if (document.getElementById('np-auth-modal-root')) return;

    const modalHtml = `
      <div id="np-auth-modal-root" class="np-modal-backdrop" onclick="if(event.target === this) window.NihongoAuth.closeLoginModal()">
        <div class="np-modal-card" role="dialog" aria-modal="true" aria-labelledby="np-modal-title">
          <div class="np-modal-header">
            <button class="np-modal-close" onclick="window.NihongoAuth.closeLoginModal()" title="Close">&times;</button>
            <div class="np-modal-logo">
              <span class="np-modal-logo-icon">🌸</span>
              <h2 id="np-modal-title" class="np-modal-title">Nihongo Pathway</h2>
            </div>
            <p class="np-modal-subtitle">Log in with your existing Nihongo Pathway credentials</p>
          </div>

          <div class="np-modal-body">
            <div id="np-auth-error" class="np-alert-error" role="alert"></div>

            <form id="np-login-form" onsubmit="window.NihongoAuth.handleLoginSubmit(event)">
              <div class="np-form-group">
                <label for="np-login-email" class="np-form-label">Email Address</label>
                <input type="email" id="np-login-email" class="np-form-input" placeholder="you@example.com" required autocomplete="email" />
              </div>

              <div class="np-form-group">
                <label for="np-login-password" class="np-form-label">Password</label>
                <input type="password" id="np-login-password" class="np-form-input" placeholder="••••••••" required autocomplete="current-password" />
              </div>

              <button type="submit" id="np-btn-submit" class="np-btn-submit">
                <span id="np-btn-text">Sign In</span>
              </button>
            </form>

            <div class="np-modal-footer">
              Don't have an account yet? Visit <a href="https://nihongopathway.netlify.app" target="_blank" rel="noopener">Nihongo Pathway</a>
            </div>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  }

  // Update UI Elements across pages
  function updateAuthUI() {
    const bars = document.querySelectorAll('.np-auth-bar, .hub-topbar, .exam-infobar');
    
    // Update candidate label if present (e.g. in exam.html)
    const candidateEl = document.querySelector('.infobar-candidate b, #topbar-candidate');
    if (candidateEl) {
      if (currentUser) {
        candidateEl.textContent = currentUser.displayName || currentUser.email;
      } else {
        candidateEl.textContent = 'Guest';
      }
    }

    // Update all auth bars
    document.querySelectorAll('.np-auth-container').forEach(container => {
      if (currentUser) {
        const initial = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();
        container.innerHTML = `
          <div class="np-user-pill" title="${currentUser.email}">
            <div class="np-user-avatar">${initial}</div>
            <span class="np-user-name">${escapeHtml(currentUser.displayName || currentUser.email)}</span>
            <span class="np-user-role">${escapeHtml(currentUser.role || 'student')}</span>
            <button class="btn-np-logout" onclick="window.NihongoAuth.signOut()" title="Sign Out">Sign Out</button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <button class="btn-np-login" onclick="window.NihongoAuth.openLoginModal()">
            <span>🔑</span>
            <span>Nihongo Pathway Login</span>
          </button>
        `;
      }
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  // Attach auth containers to topbars if not present
  function ensureAuthContainers() {
    const topbars = document.querySelectorAll('.hub-topbar');
    topbars.forEach(topbar => {
      if (!topbar.querySelector('.np-auth-container')) {
        const container = document.createElement('div');
        container.className = 'np-auth-container np-auth-bar';
        topbar.appendChild(container);
      }
    });

    const examTopbars = document.querySelectorAll('.exam-topbar');
    examTopbars.forEach(bar => {
      if (!bar.querySelector('.np-auth-container')) {
        const container = document.createElement('div');
        container.className = 'np-auth-container';
        container.style.marginLeft = 'auto';
        container.style.marginRight = '12px';
        bar.insertBefore(container, bar.lastElementChild);
      }
    });
  }

  // Public Interface
  window.NihongoAuth = {
    getUser() {
      return currentUser;
    },

    openLoginModal() {
      injectAuthModal();
      const modal = document.getElementById('np-auth-modal-root');
      const err = document.getElementById('np-auth-error');
      if (err) {
        err.className = 'np-alert-error';
        err.textContent = '';
      }
      if (modal) {
        modal.classList.add('active');
        setTimeout(() => {
          const emailInput = document.getElementById('np-login-email');
          if (emailInput) emailInput.focus();
        }, 100);
      }
    },

    closeLoginModal() {
      if (REQUIRE_AUTH && !currentUser) {
        // App is locked until user logs in
        return;
      }
      const modal = document.getElementById('np-auth-modal-root');
      if (modal) modal.classList.remove('active', 'np-blocking');
    },

    async handleLoginSubmit(e) {
      if (e) e.preventDefault();
      const emailInput = document.getElementById('np-login-email');
      const passwordInput = document.getElementById('np-login-password');
      const errorBox = document.getElementById('np-auth-error');
      const submitBtn = document.getElementById('np-btn-submit');
      const btnText = document.getElementById('np-btn-text');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        if (errorBox) {
          errorBox.textContent = 'Please enter both email and password.';
          errorBox.classList.add('visible');
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.innerHTML = '<span class="np-spinner"></span> Signing in...';
      if (errorBox) errorBox.classList.remove('visible');

      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase client is not available.');

        const { data, error } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data && data.user) {
          const profile = await fetchUserProfile(data.user);
          const devCheck = await verifyAndBindDevice(profile);
          if (!devCheck.allowed) {
            await client.auth.signOut();
            currentUser = null;
            try { localStorage.removeItem('nihongo_pathway_user'); } catch (_) {}
            checkAccessGate();
            updateAuthUI();
            if (errorBox) {
              errorBox.textContent = '⚠️ ' + devCheck.message;
              errorBox.classList.add('visible');
            }
            return;
          }

          currentUser = profile;
          try {
            localStorage.setItem('nihongo_pathway_user', JSON.stringify(currentUser));
          } catch (_) {}

          checkAccessGate();
          updateAuthUI();
          authListeners.forEach(fn => fn(currentUser));
        }
      } catch (err) {
        let msg = err.message || 'Login failed. Please check your credentials.';
        if (msg.includes('Invalid login credentials')) {
          msg = 'Incorrect email or password. Please try again.';
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          msg = 'Network error: Please verify your internet connection.';
        }
        if (errorBox) {
          errorBox.textContent = msg;
          errorBox.classList.add('visible');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Sign In';
      }
    },

    async signOut() {
      try {
        const client = getSupabaseClient();
        if (client) await client.auth.signOut();
      } catch (e) {
        console.warn('[NihongoAuth] Sign out warning:', e);
      }
      currentUser = null;
      try {
        localStorage.removeItem('nihongo_pathway_user');
      } catch (_) {}
      checkAccessGate();
      updateAuthUI();
      authListeners.forEach(fn => fn(null));
    },

    onAuthChange(fn) {
      if (typeof fn === 'function') {
        authListeners.push(fn);
        if (currentUser) fn(currentUser);
      }
    }
  };

  // Init on DOM ready
  function init() {
    // Restore cached user first to prevent UI flicker
    try {
      const cached = localStorage.getItem('nihongo_pathway_user');
      if (cached) {
        currentUser = JSON.parse(cached);
      }
    } catch (_) {}

    ensureAuthContainers();
    updateAuthUI();
    injectAuthModal();
    checkAccessGate();

    ensureSupabaseScript(async () => {
      const client = getSupabaseClient();
      if (!client) return;

      try {
        const { data } = await client.auth.getSession();
        if (data && data.session && data.session.user) {
          const profile = await fetchUserProfile(data.session.user);
          const devCheck = await verifyAndBindDevice(profile);
          if (!devCheck.allowed) {
            await client.auth.signOut();
            currentUser = null;
            try { localStorage.removeItem('nihongo_pathway_user'); } catch (_) {}
            checkAccessGate();
            updateAuthUI();
            const errEl = document.getElementById('np-auth-error');
            if (errEl) {
              errEl.textContent = '⚠️ ' + devCheck.message;
              errEl.classList.add('visible');
            }
            return;
          }

          currentUser = profile;
          try {
            localStorage.setItem('nihongo_pathway_user', JSON.stringify(currentUser));
          } catch (_) {}
          checkAccessGate();
          updateAuthUI();
          authListeners.forEach(fn => fn(currentUser));
        } else if (!data || !data.session) {
          // If no active session, clear cached user
          currentUser = null;
          try {
            localStorage.removeItem('nihongo_pathway_user');
          } catch (_) {}
          checkAccessGate();
          updateAuthUI();
          authListeners.forEach(fn => fn(null));
        }
      } catch (e) {
        console.warn('[NihongoAuth] Session check fallback:', e);
      }

      client.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          currentUser = await fetchUserProfile(session.user);
          try {
            localStorage.setItem('nihongo_pathway_user', JSON.stringify(currentUser));
          } catch (_) {}
        } else {
          currentUser = null;
          try {
            localStorage.removeItem('nihongo_pathway_user');
          } catch (_) {}
        }
        checkAccessGate();
        updateAuthUI();
        authListeners.forEach(fn => fn(currentUser));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
