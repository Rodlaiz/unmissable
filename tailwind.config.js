/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e54835', // Red-Orange from web app
          50: '#fdf4f3',
          100: '#fce8e6',
          200: '#fad2ce',
          300: '#f6b0a9',
          400: '#f18379',
          500: '#e54835',
          600: '#d93421',
          700: '#b52b1b',
          800: '#912316',
          900: '#7a1f14',
        },
      },
    },
  },
  plugins: [],
};
