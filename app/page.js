"use client";
import { useRouter } from "next/navigation";
import { useTheme } from "./providers";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <button onClick={toggle} className="p-3 rounded-full border border-gray-300 dark:border-zinc-800 bg-white dark:bg-black text-xl">
            {/* Sadece client tarafında render olduğunda ikonu göster */}
            {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}
        </button>
      </div>

      <div className="max-w-4xl w-full space-y-12 text-center animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            AGILE
          </h1>
          <p className="text-gray-500 dark:text-zinc-500 font-mono text-xs tracking-[0.6em] uppercase">Secure Collaboration Suite</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <button onClick={() => router.push('/retro')} className="group h-80 rounded-[3rem] border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-2xl transition-all duration-500 flex flex-col items-center justify-center gap-4 hover:-translate-y-2">
            <span className="text-6xl group-hover:scale-110 transition-transform">🚀</span>
            <h2 className="text-3xl font-black text-blue-600 dark:text-blue-500 italic">RETRO</h2>
            <p className="text-xs font-mono opacity-50">Sprint Retrospective</p>
          </button>

          <button onClick={() => router.push('/poker')} className="group h-80 rounded-[3rem] border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-2xl transition-all duration-500 flex flex-col items-center justify-center gap-4 hover:-translate-y-2">
            <span className="text-6xl group-hover:scale-110 transition-transform">🃏</span>
            <h2 className="text-3xl font-black text-purple-600 dark:text-purple-500 italic">POKER</h2>
            <p className="text-xs font-mono opacity-50">Sprint Estimation</p>
          </button>
        </div>
      </div>
    </div>
  );
}
