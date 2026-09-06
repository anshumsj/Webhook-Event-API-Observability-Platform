/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Base Canvas & Surfaces
        canvas: '#080b11',
        background: '#080b11', // Backward compatibility for existing screens
        surface: {
          DEFAULT: '#0d131f', // Surface 1
          1: '#0d131f',
          2: '#131b2e',
          3: '#1a243d',
        },
        // Borders
        border: {
          DEFAULT: '#1e293b',
          subtle: '#1e293b',
          strong: '#334155',
        },
        // Accents
        primary: {
          DEFAULT: '#38bdf8',
          hover: '#0ea5e9',
        },
        accent: {
          DEFAULT: '#38bdf8',
          alt: '#0ea5e9',
        },
        // Text
        text: {
          DEFAULT: '#f8fafc',
          primary: '#f8fafc',
          secondary: '#cbd5e1',
        },
        muted: '#64748b',
        // Semantic status tokens
        success: {
          DEFAULT: '#10b981',
          surface: 'rgba(16, 185, 129, 0.1)',
          border: 'rgba(16, 185, 129, 0.2)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          surface: 'rgba(245, 158, 11, 0.1)',
          border: 'rgba(245, 158, 11, 0.2)',
        },
        failure: {
          DEFAULT: '#f43f5e',
          surface: 'rgba(244, 63, 94, 0.1)',
          border: 'rgba(244, 63, 94, 0.2)',
        },
        info: {
          DEFAULT: '#0284c7',
          surface: 'rgba(2, 132, 199, 0.1)',
          border: 'rgba(2, 132, 199, 0.2)',
        },
        inflight: {
          DEFAULT: '#6366f1',
          surface: 'rgba(99, 102, 241, 0.1)',
          border: 'rgba(99, 102, 241, 0.2)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
}
