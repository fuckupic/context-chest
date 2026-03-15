import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        vault: {
          base: '#1e1e2e',
          mantle: '#181825',
          crust: '#11111b',
          surface: '#313244',
          'surface-hover': '#3b3b50',
          overlay: '#45475a',
          border: '#2a2a3c',
          text: '#cdd6f4',
          subtext: '#a6adc8',
          muted: '#6c7086',
          pink: '#f472b6',
          'pink-hover': '#ec4899',
          'pink-dim': '#be185d',
          'pink-glow': 'rgba(244, 114, 182, 0.08)',
          'pink-border': 'rgba(244, 114, 182, 0.2)',
          gold: '#c9a84c',
          'gold-dim': '#8a7234',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
        'slide-right': 'slideRight 0.6s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
