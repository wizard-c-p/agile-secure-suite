"use client";
import { useState, useEffect } from "react";
import { useTheme } from "./providers";
import { useRouter } from "next/navigation";

export default function Home() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState("MENU"); // MENU, POKER_FORM, RETRO_FORM
  const [formData, setFormData] = useState({ name: "", roomId: "" });

  useEffect(() => {
    const savedName = localStorage.getItem("poker_identity_global");
    if (savedName) setFormData(prev => ({ ...prev, name: savedName }));
  }, []);

  const handleJoin = (type, isNew) => {
    if (!formData.name && type === 'poker') return alert("Name is required");
    if (!isNew && !formData.roomId) return alert("Room ID is required");

    const rid = isNew ? Math.random().toString(36).substring(2, 8).toUpperCase() : formData.roomId;
    
    // Save Identity locally for convenience
    if(formData.name) localStorage.setItem(`poker_identity_global`, formData.name);

    router.push(`/${type}?room=${rid}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <button onClick={toggle} className="absolute top-6 right-6 p-3 rounded-full bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-2xl text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-50">
            Agile<span className="text-zinc-400 italic font-serif">Suite</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">Enterprise grade estimation & retrospective tools.</p>
        </div>

        {mode === "MENU" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <button onClick={() => setMode("POKER_FORM")} className="group relative p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-all bg-white dark:bg-zinc-900 shadow-sm hover:shadow-xl text-left">
              <div className="absolute top-6 right-6 text-4xl opacity-20 group-hover:opacity-100 group-hover:scale-110 transition duration-300">🃏</div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Planning Poker</h2>
              <p className="text-sm text-zinc-500 mt-2">Real-time estimation with AI assistance and Fibonacci decks.</p>
            </button>
            <button onClick={() => setMode("RETRO_FORM")} className="group relative p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-all bg-white dark:bg-zinc-900 shadow-sm hover:shadow-xl text-left">
              <div className="absolute top-6 right-6 text-4xl opacity-20 group-hover:opacity-100 group-hover:scale-110 transition duration-300">🚀</div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Retro Board</h2>
              <p className="text-sm text-zinc-500 mt-2">Collaborative Start, Stop, Continue boards with voting.</p>
            </button>
          </div>
        )}

        {mode === "POKER_FORM" && (
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Join Poker</h3>
              <button onClick={() => setMode("MENU")} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
            </div>
            <input 
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 ring-zinc-900 dark:ring-zinc-100 transition"
              placeholder="Your Name"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleJoin('poker', true)} className="py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition">Create New</button>
              <div className="flex flex-col gap-2">
                <input 
                  className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-center uppercase text-sm font-mono"
                  placeholder="Room ID"
                  value={formData.roomId}
                  onChange={e => setFormData({...formData, roomId: e.target.value.toUpperCase()})}
                />
                <button onClick={() => handleJoin('poker', false)} className="py-2 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition">JOIN</button>
              </div>
            </div>
          </div>
        )}

        {mode === "RETRO_FORM" && (
           <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center">
               <h3 className="text-xl font-semibold">Join Retro</h3>
               <button onClick={() => setMode("MENU")} className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
             </div>
             <input 
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-center uppercase font-mono focus:ring-2 ring-zinc-900 dark:ring-zinc-100 transition"
                placeholder="Room ID (Leave empty to create)"
                value={formData.roomId}
                onChange={e => setFormData({...formData, roomId: e.target.value.toUpperCase()})}
              />
              <button onClick={() => handleJoin('retro', !formData.roomId)} className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition">
                {formData.roomId ? "Join Board" : "Create New Board"}
              </button>
           </div>
        )}
      </div>
    </main>
  );
}