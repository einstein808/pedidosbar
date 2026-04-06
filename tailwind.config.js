/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { 
      colors: {
        oldbrick: '#9a1c22',
        aubergine: '#350a0e',
        anzac: '#e1bb3e',
        rosefog: '#e9c5b5',
        cinnabar: '#e35436',
        // Barman Palette Custom
        barsand: '#F5F0EA',
        bardark: '#1c1f0f',
        bargold: '#cc9e6f',
        bargreen: '#78a764',
        barolive: '#707b55',
      }
    },
  },
  plugins: [],
}