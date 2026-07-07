import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        crowd: {
          low: "#10b981",       // emerald-500
          moderate: "#f59e0b",  // amber-500
          high: "#f97316",      // orange-500
          critical: "#ef4444",  // red-500
        },
        stadium: {
          dark: "#0a0f1e",
          navy: "#0f1932",
          card: "#111827",
          border: "rgba(255,255,255,0.08)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "stadium-gradient": "linear-gradient(135deg, #0a0f1e, #0f1932)",
      },
      animation: {
        "fade-in": "fade-in 0.25s ease forwards",
        "slide-up": "slide-up 0.3s ease forwards",
        "pulse-ring": "pulse-ring 1.8s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.15)", opacity: "0.2" },
          "100%": { transform: "scale(0.9)", opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

