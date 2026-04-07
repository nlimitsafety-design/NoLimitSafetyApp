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
          50: '#0F172A',
          100: '#1E293B',
          200: '#334155',
          300: '#475569',
          400: '#64748B',
          500: '#94A3B8',
          600: '#CBD5E1',
          700: '#E2E8F0',
          800: '#F1F5F9',
          900: '#FFFFFF',
          950: '#F8F9FC',
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
