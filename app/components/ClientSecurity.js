"use client";
import { useEffect } from "react";

export default function ClientSecurity() {
  useEffect(() => {
    // 1. SAĞ TIK ENGELLEME
    const handleContext = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. KISAYOL ENGELLEME
    const handleKeys = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === "U")
      ) {
        e.preventDefault();
        return false;
      }
    };

    // Sadece Production ortamda çalıştır (Geliştirirken seni engellemesin)
    // Test etmek için burayı geçici olarak kaldırabilirsin.
    if (process.env.NODE_ENV === "production") {
      document.addEventListener("contextmenu", handleContext);
      document.addEventListener("keydown", handleKeys);
      
      console.clear();
      console.log("%cSTOP!", "color: red; font-size: 50px; font-weight: bold;");
    }

    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.removeEventListener("keydown", handleKeys);
    };
  }, []);

  return null;
}