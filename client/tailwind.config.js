/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Aeonic Arts brand palette — Third Eye Emporium
        copper: {
          300: '#D17C49',   // copper-bright
          400: '#BE6B3D',   // copper
          500: '#9E5228',   // copper-dark
        },
        teal: {
          900: 'rgb(var(--color-primary-900-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600-rgb) / <alpha-value>)',
        },
        bone:   '#EDE7D3',
        silver: '#AEB6B8',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
