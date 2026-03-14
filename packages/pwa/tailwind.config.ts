import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#1a1a2e',
          surface: '#16213e',
          accent: '#e94560',
          muted: '#888',
        },
      },
    },
  },
  plugins: [],
};

export default config;
