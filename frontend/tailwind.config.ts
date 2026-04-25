import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17111d",
        rose: "#ff6fae",
        blush: "#ffe7f1",
        butter: "#fff7db",
        mint: "#d7fff0",
        lilac: "#ece6ff"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(23,17,29,0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
