"use client";
import { useEffect } from "react";

export default function SecurityLayer() {
  useEffect(() => {
    // 1. SAĞ TIK ENGELLEME (Context Menu Disable)
    const handleContext = (e) => {
      e.preventDefault();
      return false;
    };

    // 2. KLAVYE KISAYOLLARI ENGELLEME (F12, CTRL+SHIFT+I, CTRL+U vb.)
    const handleKeys = (e) => {
      if (
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
        (e.ctrlKey && e.keyCode === 85) || // Ctrl+U (Kaynak Görüntüle)
        (e.ctrlKey && e.keyCode === 83) // Ctrl+S (Kaydet)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 3. DEBUGGER TUZAĞI (DevTools açılırsa tarayıcıyı kasar/durdurur)
    const antiDebug = setInterval(() => {
      (function () {
        (function a() {
          try {
            (function b(i) {
              if (("" + i / i).length !== 1 || i % 20 === 0) {
                (function () {}.constructor("debugger")());
              } else {
                debugger;
              }
              b(++i);
            })(0);
          } catch (e) {
            setTimeout(a, 5000);
          }
        })();
      })();
    }, 1000);

    // 4. DEVTOOLS TESPİTİ VE EKRAN BLUR (Pencere boyutu değişimi taktiği)
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        document.body.style.filter = "blur(20px) grayscale(100%)";
        document.body.style.pointerEvents = "none"; // Tıklamayı engelle
        document.body.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100vh;color:red;font-size:3rem;background:black;font-weight:bold'>SECURITY ALERT: DEVTOOLS DETECTED</div>";
      } else {
        // Normale dön (Opsiyonel, genelde ceza kalıcı olsun isteriz)
        // document.body.style.filter = "none";
      }
    };
    
    const devToolsCheck = setInterval(detectDevTools, 1000);

    // Event Listener'ları Ekle
    document.addEventListener("contextmenu", handleContext);
    document.addEventListener("keydown", handleKeys);

    // Temizlik (Component unmount olursa)
    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.removeEventListener("keydown", handleKeys);
      clearInterval(antiDebug);
      clearInterval(devToolsCheck);
    };
  }, []);

  return null; // Bu bileşen görünmez, sadece arkada çalışır
}
