import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cc: {
          black: '#000000',
          dark: '#0a0a0a',
          surface: '#111111',
          border: '#222222',
          'border-light': '#333333',
          muted: '#666666',
          sub: '#999999',
          text: '#cccccc',
          white: '#ffffff',
          pink: '#ff3e8e',
          'pink-dim': '#cc2a6e',
          'pink-glow': 'rgba(255, 62, 142, 0.1)',
          'pink-border': 'rgba(255, 62, 142, 0.25)',
        },
      },
      fontFamily: {
        pixel: ['"Handjet"', 'monospace'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'blink': 'blink 1s steps(1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
