import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#030308', 900: '#06070d', 850: '#0a0b14', 800: '#0f111c', 700: '#171a29', 600: '#232739' },
        neon: { blue: '#4f8cff', violet: '#8b5cf6', purple: '#b04cff', cyan: '#3ee0ff', pink: '#ff4fd8' },
        seat: { available: '#3a4560', selected: '#8b5cf6', occupied: '#20232f', premium: '#f2c14e', held: '#fb923c', vip: '#ff5fa2', recliner: '#38d9a9' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(139,92,246,.55)',
        'glow-blue': '0 0 40px -8px rgba(79,140,255,.55)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,.06), 0 20px 60px -20px rgba(0,0,0,.8)',
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(120deg,#4f8cff 0%,#8b5cf6 45%,#b04cff 100%)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pulseRing: { '0%': { transform: 'scale(.8)', opacity: '.8' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
