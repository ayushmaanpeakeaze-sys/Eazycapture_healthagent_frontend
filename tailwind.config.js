/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3eeff",
          100: "#e6dcff",
          200: "#cdb8ff",
          300: "#ad8dff",
          400: "#8c63fb",
          500: "#7142ee",
          600: "#5d2fd9",
          700: "#4920b4",
          800: "#3a1a92",
          900: "#2d1473",
        },
        nav: {
          DEFAULT: "#5d2fd9",
          top: "#6e3df2",
          bottom: "#4a23b8",
          hover: "rgba(255,255,255,0.08)",
          active: "rgba(255,255,255,0.15)",
          divider: "rgba(255,255,255,0.12)",
        },
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Instrument Serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "flow-right": {
          "0%": { transform: "translateX(-110%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateX(110%)", opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "tick-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "flow-right": "flow-right 3.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "tick-up": "tick-up 400ms ease-out",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
        "card-hover":
          "0 6px 12px -2px rgba(93,47,217,0.10), 0 8px 24px -6px rgba(15,23,42,0.10)",
        brand:
          "0 6px 16px -4px rgba(113,66,238,0.45), 0 2px 4px rgba(93,47,217,0.20)",
        // Layered soft elevation — the "3D lift" look. Pronounced so cards
        // clearly float off the page.
        float:
          "0 2px 4px rgba(15,23,42,0.06), 0 10px 20px -4px rgba(15,23,42,0.10), 0 24px 48px -8px rgba(15,23,42,0.14)",
        "float-lg":
          "0 4px 8px rgba(15,23,42,0.08), 0 18px 36px -6px rgba(15,23,42,0.14), 0 40px 64px -12px rgba(15,23,42,0.20)",
        "float-brand":
          "0 4px 10px -2px rgba(113,66,238,0.35), 0 18px 40px -8px rgba(113,66,238,0.45), 0 30px 60px -12px rgba(73,32,180,0.30)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #7142ee 0%, #5d2fd9 50%, #4920b4 100%)",
        "nav-gradient":
          "linear-gradient(180deg, #6e3df2 0%, #5d2fd9 55%, #4a23b8 100%)",
      },
    },
  },
  plugins: [],
};
