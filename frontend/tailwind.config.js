/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        senegal: {
          green: '#00853f',
          yellow: '#fcd116',
          red: '#ce1126'
        }
      }
    },
  },
  plugins: [],
}
