import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_API_KEY } from '$env/static/public';

interface AuthState {
  authenticated: boolean;
  checking: boolean;
  loggingOut: boolean;
  error: string | null;
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': PUBLIC_API_KEY,
  'X-Requested-With': 'XMLHttpRequest'
} as const;

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    authenticated: false,
    checking: true, // Start true -- prevents flash of login page
    loggingOut: false,
    error: null
  });

  const initialized = writable(false);

  // Race condition guard (pattern from wines.ts)
  let fetchCounter = 0;
  let activeController: AbortController | null = null;

  async function checkAuth(): Promise<void> {
    if (!browser) return;

    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;
    const thisCheck = ++fetchCounter;

    update(s => ({ ...s, checking: true, error: null }));

    try {
      const response = await fetch('/resources/php/auth/checkAuth.php', {
        headers: AUTH_HEADERS,
        signal: controller.signal
      });

      if (thisCheck !== fetchCounter) return;
      const json = await response.json();

      set({
        authenticated: response.ok && json.success && json.data?.authenticated === true,
        checking: false,
        loggingOut: false,
        error: null
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (thisCheck !== fetchCounter) return;
      console.error('[Auth] Check failed:', e);
      set({ authenticated: false, checking: false, loggingOut: false, error: 'Connection error' });
    }
  }

  return {
    subscribe,
    isInitialized: { subscribe: initialized.subscribe },

    initialize: async () => {
      if (get(initialized)) return;
      initialized.set(true);
      await checkAuth();
    },

    checkAuth,

    login: async (password: string): Promise<boolean> => {
      if (!browser) return false;
      update(s => ({ ...s, checking: true, error: null }));

      try {
        const response = await fetch('/resources/php/auth/login.php', {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({ password })
        });
        const json = await response.json();

        if (response.ok && json.success) {
          set({ authenticated: true, checking: false, loggingOut: false, error: null });
          return true;
        }
        set({
          authenticated: false,
          checking: false,
          loggingOut: false,
          error: json.message || 'Login failed'
        });
        return false;
      } catch (e) {
        console.error('[Auth] Login failed:', e);
        set({ authenticated: false, checking: false, loggingOut: false, error: 'Connection error' });
        return false;
      }
    },

    logout: async (): Promise<void> => {
      if (!browser) return;
      update(s => ({ ...s, loggingOut: true, error: null }));

      try {
        await fetch('/resources/php/auth/logout.php', {
          method: 'POST',
          headers: AUTH_HEADERS
        });
      } catch (e) {
        console.error('[Auth] Logout request failed:', e);
      }
      // Always clear local state even if server fails
      set({ authenticated: false, checking: false, loggingOut: false, error: null });
    }
  };
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, $a => $a.authenticated);
export const isAuthChecking = derived(auth, $a => $a.checking);
export const isAuthLoggingOut = derived(auth, $a => $a.loggingOut);
export const authError = derived(auth, $a => $a.error);
