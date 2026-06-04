export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base:         '#0F172A',
        navy:         '#0F172A',
        surface:      '#1E293B',
        'surface-hi': '#263248',
        accent:       '#6366F1',
        'accent-hi':  '#818CF8',
        muted:        '#94A3B8',
        glow:         '#818CF8',
        cyan: { DEFAULT: '#6366F1' },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.2)',
        glow: '0 4px 32px rgba(99,102,241,0.10)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
