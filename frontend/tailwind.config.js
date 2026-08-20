/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a', // slate-900
        surface: '#1e293b', // slate-800
        primary: '#38bdf8', // sky-400
        text: '#f8fafc', // slate-50
        muted: '#94a3b8', // slate-400
        border: '#334155', // slate-700
      }
    },
  },
  plugins: [],
}
