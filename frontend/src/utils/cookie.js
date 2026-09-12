/**
 * Utility helper for managing Browser Cookies & multi-storage auth synchronization
 */

export const getCookie = (name) => {
  try {
    if (typeof document === 'undefined') return null;
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
  } catch (e) {
    console.error(`Error reading cookie ${name}:`, e);
  }
  return null;
};

export const setCookie = (name, value, days = 30) => {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${isSecure}`;
  } catch (e) {
    console.error(`Error setting cookie ${name}:`, e);
  }
};

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
 * Universal Token Getter (Checks Cookie -> LocalStorage -> SessionStorage)
 */
export const getStoredToken = () => {
  try {
    return (
      getCookie('digiqa_token') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('digiqa_token')) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('digiqa_token')) ||
      null
    );
  } catch {
    return null;
  }
};

/**
 * Universal User Object Getter (Checks Cookie -> LocalStorage -> SessionStorage)
 */
export const getStoredUser = () => {
  try {
    const fromCookie = getCookie('digiqa_user');
    if (fromCookie) {
      try { return JSON.parse(fromCookie); } catch { return null; }
    }
    const fromLocal = typeof localStorage !== 'undefined' && localStorage.getItem('digiqa_user');
    if (fromLocal) {
      try { return JSON.parse(fromLocal); } catch { return null; }
    }
    const fromSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('digiqa_user');
    if (fromSession) {
      try { return JSON.parse(fromSession); } catch { return null; }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Universal Auth Saver (Saves simultaneously to Cookies, LocalStorage, and SessionStorage)
 */
export const saveAuthSession = (token, user) => {
  try {
    if (token) {
      setCookie('digiqa_token', token, 30);
      if (typeof localStorage !== 'undefined') localStorage.setItem('digiqa_token', token);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('digiqa_token', token);
    }
    if (user) {
      const userStr = typeof user === 'string' ? user : JSON.stringify(user);
      setCookie('digiqa_user', userStr, 30);
      if (typeof localStorage !== 'undefined') localStorage.setItem('digiqa_user', userStr);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('digiqa_user', userStr);
    }
  } catch (e) {
    console.error('Failed to save auth session:', e);
  }
};

/**
 * Universal Auth Clearer (Removes from Cookies, LocalStorage, and SessionStorage)
 */
export const clearAuthSession = () => {
  try {
    removeCookie('digiqa_token');
    removeCookie('digiqa_user');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('digiqa_token');
      localStorage.removeItem('digiqa_user');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('digiqa_token');
      sessionStorage.removeItem('digiqa_user');
    }
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
};
