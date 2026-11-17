/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{jsx,html}', './static/**/*.html'],
  theme: {
      extend: {
        fontFamily: {
          sans: ['Montserrat', 'sans-serif'],
          serif: ['"Playfair Display"', 'Georgia', 'serif'],
        },
        colors: {
          obsidian:   '#0A0A0A',
          gold:       '#D4AF37',
          champagne:  '#F5E6D3',
          charcoal:   '#2C2C2C',
          twilight:   '#4A4A6A',
          neonred:    '#E63946',
          sage:       '#606C38',
          amber:      '#FFB703',
          ryman:      '#6F4E37',
          platinum:   '#E5E4E2',
        },
      },
    },
};
