/**
 * Authentication Integration for AvalonMind
 * Bridge between new TypeScript auth system and existing JavaScript code
 */

// ============== Configuration ==============

const AUTH_CONFIG = {
  supabaseUrl: window.SUPABASE_URL || 'https://your-supabase-url.supabase.co',
  supabaseAnonKey: window.SUPABASE_ANON_KEY || 'your-anon-key',
  siteUrl: window.location.origin,
};

// ============== State Management ==============

let authState = {
  isAuthenticated: false,
  user: null,
  session: null,
  isLoading: false,
  error: null,
};

const authListeners = new Set();

function notifyAuthListeners() {
  authListeners.forEach(listener => listener(authState));
}

function updateAuthState(updates) {
  authState = { ...authState, ...updates };
  notifyAuthListeners();
}

// ============== Auth Service Integration ==============

class AuthIntegration {
  constructor() {
    this.service = null;
    this.initializeService();
  }

  async initializeService() {
    try {
      // Dynamically import the TypeScript service
      const module = await import('./supabase.service.js');
      const { createSupabaseAuthService } = module;
      
      this.service = createSupabaseAuthService(
        AUTH_CONFIG.supabaseUrl,
        AUTH_CONFIG.supabaseAnonKey,
        AUTH_CONFIG.siteUrl
      );
      
      console.log('[AuthIntegration] Service initialized successfully');
      await this.checkSession();
    } catch (error) {
      console.error('[AuthIntegration] Failed to initialize service:', error);
      // Fall back to legacy auth
      this.useLegacyAuth();
    }
  }

  useLegacyAuth() {
    console.warn('[AuthIntegration] Falling back to legacy authentication');
    this.service = {
      // Mock service that uses existing API endpoints
      register: async (email, password) => {
        return this.callLegacyApi('/api/auth/register', { email, password });
      },
      login: async (email, password, rememberMe) => {
        return this.callLegacyApi('/api/auth/login', { email, password, remember_me: rememberMe });
      },
      logout: async () => {
        return this.callLegacyApi('/api/auth/logout', {}, 'POST');
      },
      resendConfirmation: async (email) => {
        return this.callLegacyApi('/api/auth/resend_confirmation', { email });
      },
      getSession: async () => {
        return this.callLegacyApi('/api/auth/me');
      },
    };
  }

  async callLegacyApi(endpoint, data = null, method = 'POST') {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(endpoint, options);
      const result = await response.json();
      
      return {
        success: response.ok,
        data: result,
        error: response.ok ? null : { message: result.error || 'Request failed' },
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message || 'Network error' },
      };
    }
  }

  // ============== Public API ==============

  async register(email, password) {
    updateAuthState({ isLoading: true, error: null });
    
    try {
      if (!this.service) {
        throw new Error('Auth service not initialized');
      }
      
      const result = await this.service.register(email, password);
      
      if (result.success) {
        if (result.data.requiresConfirmation) {
          updateAuthState({
            isLoading: false,
            error: null,
            requiresConfirmation: true,
            pendingEmail: email,
          });
          return {
            success: true,
            requiresConfirmation: true,
            message: 'Please check your email to confirm your account',
          };
        } else {
          updateAuthState({
            isLoading: false,
            isAuthenticated: true,
            user: result.data.user,
            session: result.data.session,
            error: null,
          });
          return { success: true };
        }
      } else {
        updateAuthState({
          isLoading: false,
          error: result.error?.message || 'Registration failed',
        });
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      updateAuthState({
        isLoading: false,
        error: error.message || 'Registration failed',
      });
      return { success: false, error: error.message };
    }
  }

  async login(email, password, rememberMe = false) {
    updateAuthState({ isLoading: true, error: null });
    
    try {
      if (!this.service) {
        throw new Error('Auth service not initialized');
      }
      
      const result = await this.service.login(email, password, rememberMe);
      
      if (result.success) {
        updateAuthState({
          isLoading: false,
          isAuthenticated: true,
          user: result.data.user,
          session: result.data.session,
          error: null,
        });
        return { success: true };
      } else {
        // Check for email confirmation error
        if (result.error?.code === 'email_not_confirmed') {
          updateAuthState({
            isLoading: false,
            requiresConfirmation: true,
            pendingEmail: email,
            error: result.error?.message,
          });
          return {
            success: false,
            requiresConfirmation: true,
            error: result.error?.message,
          };
        }
        
        updateAuthState({
          isLoading: false,
          error: result.error?.message || 'Login failed',
        });
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      updateAuthState({
        isLoading: false,
        error: error.message || 'Login failed',
      });
      return { success: false, error: error.message };
    }
  }

  async logout() {
    updateAuthState({ isLoading: true });
    
    try {
      if (!this.service) {
        throw new Error('Auth service not initialized');
      }
      
      const result = await this.service.logout();
      
      if (result.success) {
        updateAuthState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          session: null,
          error: null,
        });
        return { success: true };
      } else {
        updateAuthState({
          isLoading: false,
          error: result.error?.message || 'Logout failed',
        });
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      updateAuthState({
        isLoading: false,
        error: error.message || 'Logout failed',
      });
      return { success: false, error: error.message };
    }
  }

  async resendConfirmation(email) {
    updateAuthState({ isLoading: true, error: null });
    
    try {
      if (!this.service) {
        throw new Error('Auth service not initialized');
      }
      
      const result = await this.service.resendConfirmation(email);
      
      if (result.success) {
        updateAuthState({
          isLoading: false,
          error: null,
        });
        return { success: true, message: 'Confirmation email resent' };
      } else {
        updateAuthState({
          isLoading: false,
          error: result.error?.message || 'Failed to resend confirmation',
        });
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      updateAuthState({
        isLoading: false,
        error: error.message || 'Failed to resend confirmation',
      });
      return { success: false, error: error.message };
    }
  }

  async checkSession() {
    updateAuthState({ isLoading: true });
    
    try {
      if (!this.service) {
        throw new Error('Auth service not initialized');
      }
      
      const result = await this.service.getSession();
      
      if (result.success) {
        if (result.data) {
          updateAuthState({
            isLoading: false,
            isAuthenticated: true,
            user: result.data.user,
            session: result.data,
            error: null,
          });
        } else {
          updateAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            session: null,
            error: null,
          });
        }
        return { success: true, authenticated: !!result.data };
      } else {
        updateAuthState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          session: null,
          error: result.error?.message,
        });
        return { success: false, error: result.error?.message };
      }
    } catch (error) {
      updateAuthState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        session: null,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  // ============== Utility Methods ==============

  getCurrentUser() {
    return authState.user;
  }

  isAuthenticated() {
    return authState.isAuthenticated;
  }

  isLoading() {
    return authState.isLoading;
  }

  getError() {
    return authState.error;
  }

  clearError() {
    updateAuthState({ error: null });
  }

  addListener(listener) {
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  }

  removeListener(listener) {
    authListeners.delete(listener);
  }
}

// ============== Global Instance ==============

window.AvalonAuth = new AuthIntegration();

// ============== Integration with Existing Code ==============

// Override existing auth functions to use new system
function integrateWithExistingCode() {
  const originalHandleLogin = window.handleLogin;
  const originalHandleRegister = window.handleRegister;
  const originalHandleLogout = window.handleLogout;
  const originalResendConfirmation = window.resendConfirmation;
  const originalCheckAuthStatus = window.checkAuthStatus;

  // Override handleLogin
  window.handleLogin = async function() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password';
      errorEl.classList.remove('hidden');
      return;
    }

    // Close modal immediately
    if (window.closeSettingsModal) {
      window.closeSettingsModal();
    }

    const result = await window.AvalonAuth.login(email, password, rememberMe);

    if (result.success) {
      // Show success notification
      if (window.showGlobalNotification) {
        window.showGlobalNotification('✅ Login successful! Welcome back.', 'success');
      }
      
      // Update UI
      if (originalCheckAuthStatus) {
        await originalCheckAuthStatus();
      }
    } else {
      // Reopen modal for errors
      if (window.openSettingsModal) {
        window.openSettingsModal();
      }
      
      if (result.requiresConfirmation) {
        errorEl.innerHTML = `
          <div class="text-amber-600">
            <p class="font-medium">📧 Email confirmation required</p>
            <p class="text-sm mt-1">Please check your inbox and confirm your email address before logging in.</p>
            <button onclick="window.AvalonAuth.resendConfirmation('${email}')" 
                    class="mt-2 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium rounded transition-colors">
              Resend confirmation email
            </button>
          </div>`;
      } else {
        errorEl.textContent = result.error || 'Login failed';
      }
      errorEl.classList.remove('hidden');
    }
  };

  // Override handleRegister
  window.handleRegister = async function() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password';
      errorEl.classList.remove('hidden');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      errorEl.classList.remove('hidden');
      return;
    }

    // Validate email format
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    if (!emailRegex.test(email)) {
      errorEl.textContent = 'Please enter a valid email address';
      errorEl.classList.remove('hidden');
      return;
    }

    // Close modal immediately
    if (window.closeSettingsModal) {
      window.closeSettingsModal();
    }

    const result = await window.AvalonAuth.register(email, password);

    if (result.success) {
      if (result.requiresConfirmation) {
        // Show success message for email confirmation
        if (window.showGlobalNotification) {
          window.showGlobalNotification('✅ Registration successful! Please check your email to confirm your account.', 'success');
        }
      } else {
        // Update UI for immediate login
        if (originalCheckAuthStatus) {
          await originalCheckAuthStatus();
        }
        if (window.showGlobalNotification) {
          window.showGlobalNotification('✅ Registration successful! You are now logged in.', 'success');
        }
      }
    } else {
      // Reopen modal for errors
      if (window.openSettingsModal) {
        window.openSettingsModal();
      }
      errorEl.textContent = result.error || 'Registration failed';
      errorEl.classList.remove('hidden');
    }
  };

  // Override handleLogout
  window.handleLogout = async function() {
    const result = await window.AvalonAuth.logout();
    
    if (result.success) {
      if (originalHandleLogout) {
        await originalHandleLogout();
      }
    } else {
      console.error('Logout failed:', result.error);
    }
  };

  // Override resendConfirmation
  window.resendConfirmation = async function(email) {
    const result = await window.AvalonAuth.resendConfirmation(email);
    
    if (result.success) {
      if (originalResendConfirmation) {
        await originalResendConfirmation(email);
      }
    } else {
      console.error('Resend confirmation failed:', result.error);
    }
  };

  // Override checkAuthStatus to use new system
  window.checkAuthStatus = async function() {
    const result = await window.AvalonAuth.checkSession();
    
    if (result.success && window.AvalonAuth.isAuthenticated()) {
      const user = window.AvalonAuth.getCurrentUser();
      if (window.updateUIForLoggedInUser) {
        window.updateUIForLoggedInUser({
          email: user.email,
          is_vip: false, // This would come from user profile
          weekly_games: 0, // This would come from backend
        });
      }
    } else {
      if (window.updateUIForLoggedOutUser) {
        window.updateUIForLoggedOutUser();
      }
    }
  };

  console.log('[AuthIntegration] Successfully integrated with existing code');
}

// ============== Initialize on DOM Ready ==============

document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for the auth service to initialize
  setTimeout(() => {
    integrateWithExistingCode();
    
    // Initial auth check
    if (window.checkAuthStatus) {
      window.checkAuthStatus();
    }
  }, 100);
});

// ============== Export ==============

export default AuthIntegration;