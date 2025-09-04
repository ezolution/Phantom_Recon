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
        // Custom colors for the dark theme
        'terminal': {
          'bg': '#0a0a0a',
          'text': '#00ff00',
          'cursor': '#ffffff',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'terminal-cursor': 'terminal-cursor 1s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor',
          },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'terminal-cursor': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'glow': {
          '0%': { textShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '100%': { textShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,255,65,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.1) 1px, transparent 1px)',
        'scan-lines': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,255,65,0.03) 4px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
    },
  },
  plugins: [],
}
