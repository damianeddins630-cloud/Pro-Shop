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
        ink: "#000000",
        black: "#0a0a0a",
        panel: "#121212",
        red: {
          DEFAULT: "#e10600",
          deep: "#b00000",
        },
        chalk: "#ffffff",
        mist: "#d7d7d7",
        steel: "#8a8a8a",
        // keep old tokens mapped so existing classnames still work
        amber: {
          DEFAULT: "#e10600",
          deep: "#b00000",
        },
        navy: "#0a0a0a",
        lane: "#161616",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
