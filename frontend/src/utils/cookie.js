/**
 * Utility helper for managing Browser Cookies & multi-storage auth synchronization
 * Guarantees reliable session sharing across all browser tabs and windows.
 */

// Helper to safely read a cookie
export const getCookie = (name) => {
  try {
    if (typeof document === 'undefined') return null;
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        const rawValue = c.substring(nameEQ.length);
        try {
          return decodeURIComponent(rawValue);
        } catch {
          // If decodeURIComponent fails (e.g. malformed URI sequence), return raw string
          return rawValue;
        }
      }
    }
  } catch (e) {
    console.error(`Error reading cookie ${name}:`, e);
  }
  return null;
};

// Helper to safely write a cookie
// If days > 0: Sets persistent cookie (e.g. 30 days)
// If days is null/undefined/0: Sets session cookie (no expires, lives until browser is closed)
export const setCookie = (name, value, days = 30) => {
  try {
    if (typeof document === 'undefined') return;
    let expires = '';
    if (days && Number(days) > 0) {
      expires = `; expires=${new Date(Date.now() + Number(days) * 864e5).toUTCString()}`;
    }
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax${isSecure}`;
  } catch (e) {
    console.error(`Error setting cookie ${name}:`, e);
  }
};

// Helper to safely remove a cookie
export const removeCookie = (name) => {
  try {
    if (typeof document === 'undefined') return;
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=; Max-Age=0; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isSecure}`;
  } catch (e) {
    console.error(`Error removing cookie ${name}:`, e);
  }
};

/**
 * Universal Token Getter
 * Multi-layer fallback: SessionStorage (active session) -> LocalStorage (if Remember Me) -> Cookie
 */
export const getStoredToken = () => {
  try {
    // 1. Check SessionStorage first (current session priority)
    if (typeof sessionStorage !== 'undefined') {
      const sessionToken = sessionStorage.getItem('digiqa_token');
      if (sessionToken && sessionToken.trim() !== '' && sessionToken !== 'null' && sessionToken !== 'undefined') {
        return sessionToken.trim();
      }
    }

    const isRememberOff = typeof localStorage !== 'undefined' && localStorage.getItem('digiqa_remember') === '0';
    if (isRememberOff) {
      // If remember me is disabled, do not read stale token from localStorage
      const cookieToken = getCookie('digiqa_token');
      if (cookieToken && cookieToken.trim() !== '' && cookieToken !== 'null' && cookieToken !== 'undefined') {
        return cookieToken.trim();
      }
      return null;
    }

    // 2. Check LocalStorage (persistent for Remember Me = true)
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('digiqa_token');
      if (token && token.trim() !== '' && token !== 'null' && token !== 'undefined') {
        return token.trim();
      }
    }

    // 3. Check Cookie
    const cookieToken = getCookie('digiqa_token');
    if (cookieToken && cookieToken.trim() !== '' && cookieToken !== 'null' && cookieToken !== 'undefined') {
      return cookieToken.trim();
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Universal User Object Getter
 * Multi-layer fallback with safe parsing
 */
export const getStoredUser = () => {
  try {
    // 1. Check SessionStorage first
    if (typeof sessionStorage !== 'undefined') {
      const fromSession = sessionStorage.getItem('digiqa_user');
      if (fromSession && fromSession !== 'null' && fromSession !== 'undefined') {
        try {
          const parsed = JSON.parse(fromSession);
          if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.role || parsed.name)) {
            return parsed;
          }
        } catch {
          // Ignore
        }
      }
    }

    const isRememberOff = typeof localStorage !== 'undefined' && localStorage.getItem('digiqa_remember') === '0';
    if (isRememberOff) {
      const fromCookie = getCookie('digiqa_user');
      if (fromCookie && fromCookie !== 'null' && fromCookie !== 'undefined') {
        try {
          const parsed = JSON.parse(fromCookie);
          if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.role || parsed.name)) {
            return parsed;
          }
        } catch {
          // Ignore
        }
      }
      return null;
    }

    // 2. Check LocalStorage
    if (typeof localStorage !== 'undefined') {
      const fromLocal = localStorage.getItem('digiqa_user');
      if (fromLocal && fromLocal !== 'null' && fromLocal !== 'undefined') {
        try {
          const parsed = JSON.parse(fromLocal);
          if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.role || parsed.name)) {
            return parsed;
          }
        } catch {
          // Ignore
        }
      }
    }

    // 3. Check Cookie
    const fromCookie = getCookie('digiqa_user');
    if (fromCookie && fromCookie !== 'null' && fromCookie !== 'undefined') {
      try {
        const parsed = JSON.parse(fromCookie);
        if (parsed && typeof parsed === 'object' && (parsed.id || parsed.username || parsed.role || parsed.name)) {
          return parsed;
        }
      } catch {
        // Ignore
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Universal Auth Saver
 * Handles persistent storage for Remember Me vs ephemeral storage for standard session.
 */
export const saveAuthSession = (token, user, rememberMe = true) => {
  try {
    const isRemember = Boolean(rememberMe);

    // 1. Save Token
    if (token && typeof token === 'string' && token.trim() !== '') {
      const cleanToken = token.trim();

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('digiqa_token', cleanToken);
      }

      if (typeof localStorage !== 'undefined') {
        if (isRemember) {
          localStorage.setItem('digiqa_token', cleanToken);
          localStorage.setItem('digiqa_remember', '1');
        } else {
          localStorage.removeItem('digiqa_token');
          localStorage.setItem('digiqa_remember', '0');
        }
      }

      // Set Cookie (30 days if rememberMe, or Session Cookie if false)
      setCookie('digiqa_token', cleanToken, isRemember ? 30 : null);
    }

    // 2. Save User
    if (user) {
      const userObj = typeof user === 'string' ? JSON.parse(user) : user;
      const userStr = JSON.stringify(userObj);

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('digiqa_user', userStr);
      }

      if (typeof localStorage !== 'undefined') {
        if (isRemember) {
          localStorage.setItem('digiqa_user', userStr);
        } else {
          localStorage.removeItem('digiqa_user');
        }
      }

      // Cookies have ~4KB limit. Only set cookie if user string is safe (< 3500 bytes)
      if (userStr.length < 3500) {
        setCookie('digiqa_user', userStr, isRemember ? 30 : null);
      }
    }

    // Trigger local storage event broadcast helper across tabs
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('digiqa_auth_sync', Date.now().toString());
    }
  } catch (e) {
    console.error('Failed to save auth session:', e);
  }
};

/**
 * Universal Auth Clearer
 * Completely removes authentication tokens and user sessions across all storage layers.
 */
export const clearAuthSession = () => {
  try {
    removeCookie('digiqa_token');
    removeCookie('digiqa_user');
    removeCookie('digiqa_remember');

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('digiqa_token');
      localStorage.removeItem('digiqa_user');
      localStorage.removeItem('digiqa_remember');
      localStorage.removeItem('digiqa_last_activity');
      localStorage.setItem('digiqa_auth_sync', 'cleared_' + Date.now());
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('digiqa_token');
      sessionStorage.removeItem('digiqa_user');
      sessionStorage.removeItem('digiqa_splash_shown');
    }
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
};
