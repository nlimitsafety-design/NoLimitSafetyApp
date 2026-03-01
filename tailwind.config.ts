import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF5F5',
          100: '#FFE0E0',
          200: '#FFC7C7',
          300: '#FFA3A3',
          400: '#FF6B6B',
          500: '#ED1C24',
          600: '#D41920',
          700: '#B5141A',
          800: '#8C1016',
          900: '#6B0D11',
        },
        accent: {
          50: '#FFF8EB',
          100: '#FEECC8',
          200: '#FDDA8C',
          300: '#FCC450',
          400: '#FBAE28',
          500: '#F59200',
          600: '#D97006',
          700: '#B44F09',
          800: '#923D0E',
          900: '#78330F',
        },
        navy: {
          50: '#F0F4FF',
          100: '#E0E8F6',
          200: '#C7D2E8',
          300: '#A4B4D4',
          400: '#7B8FBA',
          500: '#5C6FA3',
          600: '#4A5989',
          700: '#353F5E',
          800: '#1A1F2E',
          900: '#111318',
          950: '#0A0B10',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
