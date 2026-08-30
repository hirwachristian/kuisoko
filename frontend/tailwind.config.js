/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
