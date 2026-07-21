import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: "#07121d",
        navy: "#0d2438",
        lane: "#16324a",
        amber: {
          DEFAULT: "#f0b429",
          deep: "#d99214",
        },
        chalk: "#f4f0e6",
        mist: "#c9d3de",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
