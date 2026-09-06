/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        corporate: {
          bg: '#F5F7FA',
          surface: '#FFFFFF',
          border: '#E2E8F0',
          borderDark: '#CBD5E1',
          muted: '#64748B',
          text: '#1E293B',
          heading: '#0F172A',
        },
        navy: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#627D98',
          500: '#486581',
          600: '#334E68',
          700: '#243B53',
          800: '#1E3A8A', // Dark Blue
          900: '#0F2744', // Primary Navy
          950: '#0B192C',
        },
        primary: {
          DEFAULT: '#0F2744',
          hover: '#1E3A8A',
          light: '#EEF4FF',
          blue: '#2563EB',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#ECFDF5',
          border: '#A7F3D0',
          text: '#065F46',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FFFBEB',
          border: '#FDE68A',
          text: '#92400E',
        },
        critical: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
          border: '#FECACA',
          text: '#991B1B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '10px',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'elevated': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
}
