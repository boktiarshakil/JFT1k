/**
 * Nihongo Pathway Authentication Integration for JFT-Basic
 * Connects directly to Supabase project: https://bynxrlybssnxjrbijitq.supabase.co
 */

(function () {
  const SUPABASE_URL = 'https://bynxrlybssnxjrbijitq.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_egUPz76TLOJdocc8XollaQ_HjuPz4Y3';

  let supabaseClient = null;
  let currentUser = null;
  let authListeners = [];

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
              Don't have an account yet? Visit <a href="https://nihongopathway.com" target="_blank" rel="noopener">Nihongo Pathway</a>
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
      const modal = document.getElementById('np-auth-modal-root');
      if (modal) modal.classList.remove('active');
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
          currentUser = await fetchUserProfile(data.user);
          try {
            localStorage.setItem('nihongo_pathway_user', JSON.stringify(currentUser));
          } catch (_) {}

          window.NihongoAuth.closeLoginModal();
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

    ensureSupabaseScript(async () => {
      const client = getSupabaseClient();
      if (!client) return;

      try {
        const { data } = await client.auth.getSession();
        if (data && data.session && data.session.user) {
          currentUser = await fetchUserProfile(data.session.user);
          try {
            localStorage.setItem('nihongo_pathway_user', JSON.stringify(currentUser));
          } catch (_) {}
          updateAuthUI();
          authListeners.forEach(fn => fn(currentUser));
        } else if (!data || !data.session) {
          // If no active session, clear cached user
          currentUser = null;
          try {
            localStorage.removeItem('nihongo_pathway_user');
          } catch (_) {}
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
