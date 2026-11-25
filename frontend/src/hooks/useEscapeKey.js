import { useEffect, useRef } from 'react';

/**
 * Menjalankan handler penutupan modal/popup saat tombol Escape ditekan.
 * Mengabaikan event jika sudah di-handle oleh lapisan dialog di atasnya.
 */
export function useEscapeKey(handler, isActive = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const result = handlerRef.current?.(e);
      if (result !== false) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive]);
}
