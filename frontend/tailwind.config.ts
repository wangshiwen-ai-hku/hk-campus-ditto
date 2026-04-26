import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        aura: "#FF0066", // Neon Crimson
        harbour: "#0099FF", // Electric Blue
        jade: "#00F5D4", // Neon Jade
        gold: "#FFD700", // Golden street lights
        ink: "#010409", // Deep obsidian
      },
      boxShadow: {
        soft: "0 12px 40px rgba(23,17,29,0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
