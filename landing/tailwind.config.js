/** @type {import('tailwindcss').Config} */
export default {
  content: ['./**/*.{html,js,ts,svelte}'],
  theme: {
    extend: {
      colors: {
        // EZCorp Design System
        'ez-dark': '#0A0A0A',
        'ez-light': '#FAFAFA',
        'ez-yellow': '#F4C430',
        'ez-yellow-hover': '#D88420',
        'ez-blue': '#0066FF',
        'ez-green': '#00CC66',
        'ez-purple': '#8B5CF6',
        'ez-border': '#262626',
        'ez-text': '#EDEDED',
        'ez-muted': '#737373',
        'ez-hover': '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
      spacing: {
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
