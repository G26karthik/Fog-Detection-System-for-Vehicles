import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Add a cool gradient background
        "foggy-sky": "linear-gradient(to bottom, #607D8B, #455A64, #263238)", // Example gradient
        "clear-sky": "linear-gradient(to bottom, #0288D1, #03A9F4, #4FC3F7)", // Example gradient
      },
      colors: {
        // Add some vibrant colors
        'primary-glow': 'rgba(79, 70, 229, 0.8)', // Indigo glow
        'accent-pink': '#EC4899',
        'accent-teal': '#14B8A6',
        'status-safe': '#10B981', // Green
        'status-warn': '#F59E0B', // Amber
        'status-danger': '#EF4444', // Red
        'dark-bg': '#1a1a2e', // Dark background
        'light-text': '#e0e0e0', // Light text for dark bg
        'card-bg': 'rgba(40, 42, 54, 0.8)', // Semi-transparent card background
      },
      boxShadow: {
        'glow-indigo': '0 0 15px 5px rgba(79, 70, 229, 0.5)',
        'glow-pink': '0 0 15px 5px rgba(236, 72, 153, 0.5)',
        'glow-teal': '0 0 15px 5px rgba(20, 184, 166, 0.5)',
      },
      keyframes: {
        // Add a subtle pulse animation
        pulseGlow: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        pulseGlow: 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
