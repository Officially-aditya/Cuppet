/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Instrument Serif'", 'ui-serif', 'Georgia', 'serif'],
        body: ["'DM Sans'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f2f8f3',
          100: '#e2f0e5',
          200: '#c5dec9',
          300: '#9ac3a3',
          400: '#67a476',
          500: '#43855b',
          600: '#316a47',
          700: '#28553b',
          800: '#224432',
          900: '#1c382a',
          950: '#0e2017',
        },
      },
    },
  },
  plugins: [],
}

export default config
