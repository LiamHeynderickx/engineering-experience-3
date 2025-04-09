/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        hitFlash: {
          '0%': { opacity: '0.7' },
          '100%': { opacity: '0' }
        },
        hitRipple: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(6)', opacity: '0' }
        }
      },
      animation: {
        hitFlash: 'hitFlash 0.3s ease-out',
        hitRipple: 'hitRipple 0.8s ease-out'
      }
    },
  },
  plugins: [],
}

