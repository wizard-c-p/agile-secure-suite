"use client";
import { useState, useEffect } from "react";
import { db } from "../../firebase"; 
import { useTheme } from "../providers";
import { useRouter } from "next/navigation";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, getDocs, limit } from "firebase/firestore";

export default function Retro() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [view, setView] = useState("lobby");
  const [rid, setRid] = useState("");
  const [joinId, setJoinId] = useState("");
  const [lst, setLst] = useState([]);
  const [txt, setTxt] = useState("");
  const [act, setAct] = useState(null);
  const [eid, setEid] = useState(null);
  const [etx, setEtx] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("room");
    if(r) { setRid(r); setView("board"); }
  }, []);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setRid(id); setView("board");
    window.history.pushState({}, '', `?room=${id}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if(!joinId.trim()) return;
    setRid(joinId.trim()); setView("board");
    window.history.pushState({}, '', `?room=${joinId.trim()}`);
  };

  useEffect(() => {
    if (view !== "board" || !rid) return;
    const q = query(collection(db, "retros"), where("room", "==", rid), orderBy("timestamp", "asc"));
    return onSnapshot(q, (s) => setLst(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [rid, view]);

  const add = async (e, ty) => {
    e.preventDefault();
    if (!txt.trim()) return;
    await addDoc(collection(db, "retros"), { text: txt.trim(), type: ty, room: rid, timestamp: serverTimestamp(), votes: 0, dislikes: 0 });
    setTxt(""); setAct(null);
  };

  const update = (id, data) => updateDoc(doc(db, "retros", id), data);
  const del = (id) => { if(confirm("Delete?")) deleteDoc(doc(db, "retros", id)); };

  const COLS = [
    { k: "start", l: "START", color: "text-emerald-600 dark:text-emerald-400" },
    { k: "stop", l: "STOP", color: "text-rose-600 dark:text-rose-400" },
    { k: "continue", l: "CONTINUE", color: "text-blue-600 dark:text-blue-400" }
  ];

  if (view === "lobby") return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-zinc-800 space-y-8">
        <h1 className="text-5xl font-black italic text-center text-blue-600 dark:text-blue-500">RETRO</h1>
        <button onClick={createRoom} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black shadow-lg">CREATE NEW ROOM</button>
        <div className="text-center opacity-50 text-xs">OR</div>
        <form onSubmit={joinRoom} className="flex gap-2">
            <input value={joinId} onChange={e=>setJoinId(e.target.value)} placeholder="Enter Room ID" className="flex-1 p-4 bg-gray-50 dark:bg-black border rounded-xl outline-none"/>
            <button className="px-6 font-bold border rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800">JOIN</button>
        </form>
        <div className="flex justify-center gap-4 pt-4">
             <button onClick={() => router.push('/')} className="text-xs font-bold opacity-50 hover:opacity-100">← HOME</button>
             <button onClick={toggle} className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
      <header className="px-6 py-4 flex justify-between items-center bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center gap-6">
            <h2 className="font-black text-2xl text-blue-600 dark:text-blue-500 italic">RETRO</h2>
            <nav className="hidden md:flex gap-4 text-xs font-bold text-gray-400">
                <button onClick={() => router.push('/')} className="hover:text-blue-500">HOME</button>
                <button onClick={() => router.push('/poker')} className="hover:text-purple-500">POKER</button>
            </nav>
        </div>
        <div className="flex gap-3">
             <span className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs font-mono opacity-50">{rid}</span>
             <button onClick={toggle} className="p-2 border rounded-full border-gray-200 dark:border-zinc-700">{theme==='dark'?'☀️':'🌙'}</button>
             <button onClick={() => {navigator.clipboard.writeText(window.location.href); alert("Copied!")}} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black">SHARE</button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-x-auto">
        <div className="grid md:grid-cols-3 gap-6 h-full min-w-[900px] md:min-w-0 mx-auto">
          {COLS.map(c => (
            <div key={c.k} className="flex flex-col h-full rounded-[2rem] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className={`p-5 font-black text-xs tracking-widest border-b border-gray-100 dark:border-zinc-800 flex justify-between ${c.color}`}>
                <span>{c.l}</span>
                <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[10px] text-gray-500">{lst.filter(x => x.type === c.k).length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {lst.filter(x => x.type === c.k).map(i => (
                  <div key={i.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-zinc-700 transition group">
                    {eid === i.id ? (
                        <div className="flex flex-col gap-2">
                            <textarea value={etx} onChange={e=>setEtx(e.target.value)} autoFocus className="w-full bg-white dark:bg-black border p-2 rounded-lg text-sm" rows="3"/>
                            <div className="flex justify-end gap-2">
                                <button onClick={()=>setEid(null)} className="text-[10px] font-bold opacity-50">CANCEL</button>
                                <button onClick={()=>{update(i.id, {text:etx}); setEid(null)}} className="text-[10px] font-bold text-blue-500">SAVE</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{i.text}</p>
                            <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 dark:border-zinc-800">
                                <div className="flex gap-3">
                                    <button onClick={()=>update(i.id,{votes:(i.votes||0)+1})} className="text-xs hover:scale-110 transition">👍 {i.votes}</button>
                                    <button onClick={()=>update(i.id,{dislikes:(i.dislikes||0)+1})} className="text-xs hover:scale-110 transition">👎 {i.dislikes}</button>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={()=>{setEid(i.id); setEtx(i.text)}} className="text-[10px] font-bold text-blue-500">EDIT</button>
                                    <button onClick={()=>del(i.id)} className="text-[10px] font-bold text-red-500">DEL</button>
                                </div>
                            </div>
                        </>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50">
                 {act === c.k ? (
                    <form onSubmit={e=>add(e, c.k)}>
                        <textarea value={txt} onChange={e=>setTxt(e.target.value)} autoFocus placeholder="..." className="w-full p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none" rows="2"/>
                        <button className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">ADD CARD</button>
                    </form>
                 ) : (
                    <button onClick={()=>{setAct(c.k); setTxt("")}} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-black opacity-40 hover:opacity-100 hover:border-blue-400 transition">+ ADD</button>
                 )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
