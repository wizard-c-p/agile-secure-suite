"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function Providers({ children }) {
  // Varsayılan tema 'dark'. Sunucu ve İstemci uyumlu olsun diye.
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(saved);
    } else {
      // İlk açılışta dark zorla
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
  };

  // DÜZELTME: !mounted kontrolü kaldırıldı.
  // Provider ARTIK HER ZAMAN render ediliyor.
  // Hydration mismatch olmaması için children'ı olduğu gibi dönüyoruz.
  
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {/* Sayfa içeriği her zaman Provider içinde */}
      {children} 
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme error: Provider missing in tree");
  }
  return context;
};
