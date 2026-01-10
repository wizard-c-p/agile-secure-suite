"use client";
import { useEffect } from "react";

export default function SecurityLayer() {
  useEffect(() => {
    // 1. SAĞ TIK ENGELLEME (Context Menu Disable)
    const handleContext = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. KLAVYE KISAYOLLARI ENGELLEME (F12, CTRL+SHIFT+I vb.)
    const handleKeys = (e) => {
      if (
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
        (e.ctrlKey && e.keyCode === 85) // Ctrl+U (Kaynak Görüntüle)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 3. SOSYAL MÜHENDİSLİK UYARISI (Self-XSS Koruması)
    // DevTools'u bir şekilde açmayı başaranlar için caydırıcı mesaj.
    const consoleWarning = () => {
      console.clear();
      const styleTitle = "color: red; font-size: 60px; font-weight: bold; text-shadow: 2px 2px black;";
      const styleBody = "color: white; background: red; font-size: 20px; padding: 10px;";
      
      console.log("%cDUR!", styleTitle);
      console.log("%cBu, tarayıcının geliştirici özelliğidir. Birisi size buraya bir şey kopyalayıp yapıştırmanızı söylerse, bu bir dolandırıcılıktır ve hesabınıza erişmelerini sağlar.", styleBody);
      console.log("%cSTOP! This is a browser feature intended for developers. If someone told you to copy-paste something here, it is a scam.", "color: gray; font-size: 14px;");
    };

    // Event Listener'ları Ekle
    document.addEventListener("contextmenu", handleContext);
    document.addEventListener("keydown", handleKeys);
    
    // Konsol uyarısını yüklenince bas
    consoleWarning();
    // Konsol temizlense bile tekrar basmak için aralık (Opsiyonel, sildim performansı etkilemesin)

    // Temizlik
    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.removeEventListener("keydown", handleKeys);
    };
  }, []);

  return null; // Görünür bir UI yok, arka planda çalışır.
}