"use client";

import * as React from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };

function persistTheme(theme: Theme) {
  window.localStorage.setItem("corretop-theme", theme);
  document.cookie = `corretop-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.localStorage.getItem("corretop-theme") === "dark" ? "dark" : "light";
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);

  React.useEffect(() => {
    persistTheme(theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    persistTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
