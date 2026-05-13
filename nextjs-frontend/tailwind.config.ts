import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        sidebar: {
          bg: "#ffffff",
          border: "#e2e8f0",
          text: "#64748b",
          active: "#2563eb",
        },
        brand: {
          50: "#eff6ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        danger: {
          50: "#fef2f2",
          500: "#dc2626",
          600: "#b91c1c",
        },
        warning: {
          50: "#fffbeb",
          500: "#d97706",
        },
        success: {
          50: "#f0fdf4",
          500: "#059669",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 12px 32px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)",
        "card-lg": "0 20px 48px rgba(0,0,0,0.14), 0 8px 20px rgba(0,0,0,0.08)",
        modal: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)",
        float: "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      animation: {
        "risk-pulse": "risk-pulse 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite linear",
      },
      keyframes: {
        "risk-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
