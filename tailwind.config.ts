import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bone: {
          DEFAULT: "#F5F1EA",
          deep: "#EDE6DC",
        },
        charcoal: {
          DEFAULT: "#2C2A27",
          muted: "#5C5752",
        },
        clay: {
          DEFAULT: "#A89588",
          soft: "#C4B5A8",
        },
        taupe: {
          DEFAULT: "#9A8F85",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      maxWidth: {
        prose: "42rem",
        measure: "65ch",
      },
      transitionDuration: {
        slow: "800ms",
        slower: "1200ms",
      },
    },
  },
  plugins: [],
};

export default config;
