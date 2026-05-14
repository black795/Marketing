import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#FF2D8A',
          yellow: '#FFF466',
        },
      },
    },
  },
  plugins: [],
};

export default config;
