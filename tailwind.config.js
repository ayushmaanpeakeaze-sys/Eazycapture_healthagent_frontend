export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        scrim: "rgb(var(--scrim) / <alpha-value>)",
        nav: {
          DEFAULT: "#5d2fd9",
          top: "#6e3df2",
          bottom: "#4a23b8",
          hover: "rgba(255,255,255,0.08)",
          active: "rgba(255,255,255,0.15)",
          divider: "rgba(255,255,255,0.12)",
        },
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        rose: {
          50: "rgb(var(--rose-50) / <alpha-value>)",
          100: "rgb(var(--rose-100) / <alpha-value>)",
          200: "rgb(var(--rose-200) / <alpha-value>)",
          300: "rgb(var(--rose-300) / <alpha-value>)",
          400: "rgb(var(--rose-400) / <alpha-value>)",
          500: "rgb(var(--rose-500) / <alpha-value>)",
          600: "rgb(var(--rose-600) / <alpha-value>)",
          700: "rgb(var(--rose-700) / <alpha-value>)",
          800: "rgb(var(--rose-800) / <alpha-value>)",
        },
        emerald: {
          50: "rgb(var(--emerald-50) / <alpha-value>)",
          100: "rgb(var(--emerald-100) / <alpha-value>)",
          200: "rgb(var(--emerald-200) / <alpha-value>)",
          300: "rgb(var(--emerald-300) / <alpha-value>)",
          400: "rgb(var(--emerald-400) / <alpha-value>)",
          500: "rgb(var(--emerald-500) / <alpha-value>)",
          600: "rgb(var(--emerald-600) / <alpha-value>)",
          700: "rgb(var(--emerald-700) / <alpha-value>)",
        },
        amber: {
          50: "rgb(var(--amber-50) / <alpha-value>)",
          100: "rgb(var(--amber-100) / <alpha-value>)",
          200: "rgb(var(--amber-200) / <alpha-value>)",
          300: "rgb(var(--amber-300) / <alpha-value>)",
          400: "rgb(var(--amber-400) / <alpha-value>)",
          500: "rgb(var(--amber-500) / <alpha-value>)",
          600: "rgb(var(--amber-600) / <alpha-value>)",
          700: "rgb(var(--amber-700) / <alpha-value>)",
          800: "rgb(var(--amber-800) / <alpha-value>)",
        },
        sky: {
          50: "rgb(var(--sky-50) / <alpha-value>)",
          100: "rgb(var(--sky-100) / <alpha-value>)",
          200: "rgb(var(--sky-200) / <alpha-value>)",
          300: "rgb(var(--sky-300) / <alpha-value>)",
          500: "rgb(var(--sky-500) / <alpha-value>)",
          600: "rgb(var(--sky-600) / <alpha-value>)",
          700: "rgb(var(--sky-700) / <alpha-value>)",
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
        "blink-red": {
          "0%, 100%": { backgroundColor: "rgba(244, 63, 94, 0.16)" },
          "50%": { backgroundColor: "rgba(244, 63, 94, 0)" },
        },
        "blink-amber": {
          "0%, 100%": { backgroundColor: "rgba(245, 158, 11, 0.16)" },
          "50%": { backgroundColor: "rgba(245, 158, 11, 0)" },
        },
      },
      animation: {
        "flow-right": "flow-right 3.4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "tick-up": "tick-up 400ms ease-out",
        "blink-red": "blink-red 1.4s ease-in-out infinite",
        "blink-amber": "blink-amber 1.4s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
        "card-hover":
          "0 6px 12px -2px rgba(93,47,217,0.10), 0 8px 24px -6px rgba(15,23,42,0.10)",
        brand:
          "0 6px 16px -4px rgba(113,66,238,0.45), 0 2px 4px rgba(93,47,217,0.20)",
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
