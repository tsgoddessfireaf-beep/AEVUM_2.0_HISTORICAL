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
          900: '#0E2C27',   // teal-deep (darkest)
          800: '#123A33',   // teal-bg
          700: '#16433A',   // teal-panel
          600: '#1E5248',   // teal-border
        },
        bone:   '#EDE7D3',
        silver: '#AEB6B8',
      },
      fontFamily: {
        serif: ['Orbitron', 'sans-serif'],           // display / headings
        sans:  ['Lato', 'system-ui', 'sans-serif'],  // body
      },
    },
  },
  plugins: [],
};
