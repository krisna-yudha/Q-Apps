import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih...',
  icon: Icon,
  variant = 'default', // 'default' (light corporate) | 'dark' (corporate navy dark header) | 'bordered'
  className = '',
  buttonClassName = '',
  menuClassName = '',
  direction = 'down',
  align = 'left',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options to [{ value, label }]
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label || opt.name || String(opt.value || opt.id)
      };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optValue) => {
    if (onChange) {
      onChange({ target: { value: optValue }, value: optValue });
    }
    setIsOpen(false);
  };

  const menuPosClass = direction === 'up'
    ? 'bottom-full mb-1.5'
    : 'top-full mt-1.5';

  const menuAlignClass = align === 'right' ? 'right-0' : 'left-0';

  const isDark = variant === 'dark';

  const defaultButtonStyles = isDark
    ? 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/90 focus:ring-2 focus:ring-blue-500/40 shadow-xs'
    : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 focus:ring-2 focus:ring-blue-600/20 shadow-2xs';

  const defaultOpenButtonStyles = isDark
    ? 'ring-2 ring-blue-500/50 border-blue-500 bg-slate-900'
    : 'ring-2 ring-blue-600/30 border-blue-600 bg-white';

  const defaultMenuStyles = isDark
    ? 'bg-slate-900/95 border border-slate-700 text-slate-100 shadow-2xl backdrop-blur-md divide-y divide-slate-800/60'
    : 'bg-white border border-slate-200/90 text-slate-800 shadow-2xl divide-y divide-slate-100/60';

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl px-3 py-2 text-xs font-bold focus:outline-none flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${defaultButtonStyles} ${
          isOpen ? defaultOpenButtonStyles : ''
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {Icon && (
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />
          )}
          <span className="truncate">{displayLabel}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          } ${isOpen ? `rotate-180 ${isDark ? 'text-blue-400' : 'text-blue-700'}` : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${menuPosClass} ${menuAlignClass} min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-md rounded-xl z-[999] max-h-60 overflow-y-auto py-1 [scrollbar-width:thin] ${
            isDark
              ? '[scrollbar-color:#334155_transparent] bg-slate-900 border border-slate-700/90 text-slate-100 shadow-2xl backdrop-blur-md'
              : '[scrollbar-color:#cbd5e1_transparent] bg-white border border-slate-200 text-slate-800 shadow-2xl'
          } animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
        >
          {normalizedOptions.length === 0 ? (
            <div className={`px-3 py-2 text-xs italic text-center ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
              Tidak ada opsi
            </div>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const itemStyles = isDark
                ? isSelected
                  ? 'bg-blue-600/30 text-blue-300 font-bold border-l-2 border-blue-400'
                  : 'text-slate-200 hover:bg-slate-800/90 font-medium'
                : isSelected
                  ? 'bg-blue-50/90 text-blue-900 font-bold border-l-2 border-blue-600'
                  : 'text-slate-700 hover:bg-slate-50 font-medium';

              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-3 transition cursor-pointer ${itemStyles}`}
                  title={opt.label}
                >
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {isSelected && (
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-700'}`} />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
