export type Theme = "light" | "dark";

const KEY = "eazy.theme";

export const getTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const applyTheme = (t: Theme): void => {
  document.documentElement.classList.toggle("dark", t === "dark");
};

export const setTheme = (t: Theme): void => {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* localStorage blocked */
  }
  applyTheme(t);
};
