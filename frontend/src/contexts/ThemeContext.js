import React, { createContext, useContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material/styles";

const ThemeContext = createContext(null);

export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
};

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    ...(mode === "light"
      ? {
          primary: { main: "#1976d2" },
          secondary: { main: "#dc004e" },
          background: { default: "#f5f7fa", paper: "#ffffff" },
        }
      : {
          primary: { main: "#90caf9" },
          secondary: { main: "#f48fb1" },
          background: { default: "#0a1929", paper: "#0d2137" },
          text: { primary: "#e3f2fd", secondary: "#90caf9" },
        }),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 8 },
});

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("themeMode") || "light";
    } catch {
      return "light";
    }
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("themeMode", next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  const value = useMemo(() => ({ mode, toggleTheme, theme }), [mode, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeContext;
