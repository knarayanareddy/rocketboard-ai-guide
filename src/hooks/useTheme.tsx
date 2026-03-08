import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeKey = "cyber" | "ember" | "aurora" | "phantom" | "sakura";

export interface ThemeMeta {
  key: ThemeKey;
  label: string;
  description: string;
  preview: { bg: string; primary: string; accent: string };
}

export const THEMES: ThemeMeta[] = [
  {
    key: "cyber",
    label: "Cyber Cyan",
    description: "Mission-control dark with cyan & purple accents",
    preview: { bg: "#0f1318", primary: "#22d3c5", accent: "#7c3aed" },
  },
  {
    key: "ember",
    label: "Ember",
    description: "Warm dark theme with amber & crimson tones",
    preview: { bg: "#141110", primary: "#f59e0b", accent: "#ef4444" },
  },
  {
    key: "aurora",
    label: "Aurora",
    description: "Deep space with emerald & teal glow",
    preview: { bg: "#0c1410", primary: "#10b981", accent: "#06b6d4" },
  },
  {
    key: "phantom",
    label: "Phantom",
    description: "Monochrome silver with cool blue accents",
    preview: { bg: "#111114", primary: "#a1a1aa", accent: "#6366f1" },
  },
  {
    key: "sakura",
    label: "Sakura",
    description: "Soft dark with rose & blush highlights",
    preview: { bg: "#141012", primary: "#f472b6", accent: "#c084fc" },
  },
];

const STORAGE_KEY = "rocketboard-theme";

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "cyber",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some((t) => t.key === stored)) return stored as ThemeKey;
    } catch {}
    return "cyber";
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes, then add the active one
    THEMES.forEach((t) => root.classList.remove(`theme-${t.key}`));
    root.classList.add(`theme-${theme}`);
    // Ensure dark mode is always on (all themes are dark variants)
    root.classList.add("dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
