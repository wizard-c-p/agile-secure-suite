"use client";
import { useState, useEffect } from "react";
import { db } from "../../firebase"; 
import { useTheme } from "../providers";
import { useRouter } from "next/navigation";
import { collection, doc, setDoc, onSnapshot, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";

const CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];

export default function Poker() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  
  const [view, setView] = useState("lobby");
  const [rid, setRid] = useState("");
  const [joinId, setJoinId] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [issues, setIssues] = useState([]); 
  const [gameState, setGameState] = useState({ revealed: false, activeIssueId: null });
  const [myVote, setMyVote] = useState(null);
  const [issueInput, setIssueInput] = useState("");
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [editInput, setEditInput] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("room");
    if(r) setRid(r);
  }, []);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 10);
    setRid(id);
    window.history.pushState({}, '', `?room=${id}`);
  };

  const joinGame = async (e) => {
    e.preventDefault();
    const finalRid = rid || joinId.trim();
    if (!nameInput.trim() || !finalRid) return;
    setRid(finalRid);
    const uid = Math.random().toString(36).substring(7);
    const userData = { name: nameInput.trim(), vote: null, id: uid };
    await setDoc(doc(db, "poker_rooms", finalRid, "players", uid), userData);
    setUser(userData);
    setView("game");
    window.history.pushState({}, '', `?room=${finalRid}`);
  };

  useEffect(() => {
    if (view !== "game" || !rid) return;
    
    const unsubRoom = onSnapshot(doc(db, "poker_rooms", rid), (d) => {
        if(d.exists()) setGameState(d.data());
        else setDoc(doc(db, "poker_rooms", rid), { revealed: false, activeIssueId: null });
    });
    const unsubPlayers = onSnapshot(collection(db, "poker_rooms", rid, "players"), (s) => setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubIssues = onSnapshot(query(collection(db, "poker_rooms", rid, "issues"), orderBy("order", "asc")), (s) => setIssues(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubRoom(); unsubPlayers(); unsubIssues(); };
  }, [rid, view]);

  const addIssue = async (e) => {
    e.preventDefault();
    if (!issueInput.trim()) return;
    await addDoc(collection(db, "poker_rooms", rid, "issues"), { text: issueInput.trim(), status: "PENDING", score: null, order: issues.length, timestamp: serverTimestamp() });
    setIssueInput("");
  };

  const deleteIssue = async (id) => {
    if(confirm("Delete?")) {
        await deleteDoc(doc(db, "poker_rooms", rid, "issues", id));
        if (gameState.activeIssueId === id) await updateDoc(doc(db, "poker_rooms", rid), { activeIssueId: null, revealed: false });
    }
  };

  const startEdit = (issue) => { setEditingIssueId(issue.id); setEditInput(issue.text); };
  const saveEdit = async (id) => { await updateDoc(doc(db, "poker_rooms", rid, "issues", id), { text: editInput }); setEditingIssueId(null); };

  const moveIssue = async (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === issues.length - 1)) return;
    const itemA = issues[index];
    const itemB = issues[index + direction];
    await updateDoc(doc(db, "poker_rooms", rid, "issues", itemA.id), { order: itemB.order });
    await updateDoc(doc(db, "poker_rooms", rid, "issues", itemB.id), { order: itemA.order });
  };

  const setActiveIssue = async (issueId) => {
    await updateDoc(doc(db, "poker_rooms", rid), { activeIssueId: issueId, revealed: false });
    await updateDoc(doc(db, "poker_rooms", rid, "issues", issueId), { status: "ACTIVE" });
    players.forEach(p => updateDoc(doc(db, "poker_rooms", rid, "players", p.id), { vote: null }));
    setMyVote(null);
  };

  const completeVoting = async (score) => {
    if(!gameState.activeIssueId) return;
    await updateDoc(doc(db, "poker_rooms", rid, "issues", gameState.activeIssueId), { score: score, status: "COMPLETED" });
    await updateDoc(doc(db, "poker_rooms", rid), { activeIssueId: null, revealed: false });
    players.forEach(p => updateDoc(doc(db, "poker_rooms", rid, "players", p.id), { vote: null }));
    setMyVote(null);
  };

  const vote = async (val) => {
    if (!user) return;
    setMyVote(val);
    await updateDoc(doc(db, "poker_rooms", rid, "players", user.id), { vote: val });
  };

  const toggleReveal = async () => { await updateDoc(doc(db, "poker_rooms", rid), { revealed: !gameState.revealed }); };

  const validVotes = players.filter(p => p.vote && !isNaN(p.vote)).map(p => Number(p.vote));
  const average = validVotes.length > 0 ? (validVotes.reduce((a, b) => a + b, 0) / validVotes.length).toFixed(1) : 0;
  const activeTask = issues.find(i => i.id === gameState.activeIssueId);

  if (view === "lobby") return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-zinc-800 space-y-6">
            <h1 className="text-5xl font-black italic text-center text-purple-600 dark:text-purple-500">POKER</h1>
            <p className="text-center text-xs font-mono opacity-50">{rid ? `ROOM: ${rid}` : 'AGILE ESTIMATION'}</p>
            <form onSubmit={joinGame} className="space-y-4">
                {!rid && (
                    <div className="flex gap-2">
                         <input value={joinId} onChange={e=>setJoinId(e.target.value)} placeholder="Enter Room ID" className="flex-1 p-4 bg-gray-50 dark:bg-black border rounded-xl outline-none"/>
                         <button type="button" onClick={createRoom} className="px-4 font-bold border rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-xs">NEW</button>
                    </div>
                )}
                <input value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="Your Name" autoFocus className="w-full p-4 bg-gray-50 dark:bg-black border rounded-xl outline-none text-center"/>
                <button className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-lg">ENTER</button>
            </form>
            <div className="flex justify-center gap-4 pt-4">
                 <button onClick={() => router.push('/')} className="text-xs font-bold opacity-50 hover:opacity-100">← HOME</button>
                 <button onClick={toggle} className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex font-sans overflow-hidden transition-colors duration-300">
        <aside className="w-96 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col z-20 shadow-lg">
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                <h2 className="text-xl font-black italic text-purple-600 dark:text-purple-500">BACKLOG</h2>
                <div className="text-[10px] opacity-50 font-mono text-right">ROOM: {rid}<br/>{user?.name}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {issues.map((i, idx) => (
                    <div key={i.id} className={`p-4 rounded-xl border transition-all group ${i.id === gameState.activeIssueId ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500' : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-800'}`}>
                         <div className="flex justify-between items-center mb-2">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${i.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : (i.id === gameState.activeIssueId ? 'bg-purple-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400')}`}>{i.status}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={()=>moveIssue(idx, -1)} className="p-1 hover:text-blue-500 text-xs">▲</button>
                                <button onClick={()=>moveIssue(idx, 1)} className="p-1 hover:text-blue-500 text-xs">▼</button>
                                <button onClick={()=>startEdit(i)} className="p-1 hover:text-yellow-500">✏️</button>
                                <button onClick={()=>deleteIssue(i.id)} className="p-1 hover:text-red-500">🗑️</button>
                            </div>
                        </div>
                        {editingIssueId === i.id ? (
                            <div className="flex gap-2"><input value={editInput} onChange={e=>setEditInput(e.target.value)} autoFocus className="flex-1 bg-white dark:bg-black border p-1 rounded text-sm"/><button onClick={()=>saveEdit(i.id)} className="text-[10px] font-bold text-green-500">OK</button></div>
                        ) : (
                            <p className="text-sm font-medium leading-snug cursor-pointer hover:text-purple-500" onClick={() => setActiveIssue(i.id)}>{i.text}</p>
                        )}
                        {i.id !== gameState.activeIssueId && (<button onClick={() => setActiveIssue(i.id)} className="mt-3 w-full py-2 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-lg text-[10px] font-bold tracking-widest hover:bg-purple-50 dark:hover:bg-purple-900/30 transition text-gray-500 dark:text-gray-300">ESTIMATE</button>)}
                    </div>
                ))}
            </div>
            <form onSubmit={addIssue} className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900"><input value={issueInput} onChange={e=>setIssueInput(e.target.value)} placeholder="+ Add Task" className="w-full bg-transparent border-b border-gray-300 dark:border-zinc-700 p-2 text-sm outline-none focus:border-purple-500 transition"/></form>
        </aside>

        <main className="flex-1 flex flex-col relative bg-gray-50 dark:bg-zinc-950">
            <header className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex-1">{activeTask ? <div className="animate-in slide-in-from-top-4"><span className="text-purple-600 dark:text-purple-400 text-xs font-bold tracking-widest mb-1 block">VOTING ON:</span><h2 className="text-2xl font-bold leading-tight">{activeTask.text}</h2></div> : <div className="opacity-40"><h2 className="text-xl font-bold">Waiting...</h2></div>}</div>
                <div className="flex gap-4 items-center">
                    <nav className="hidden md:flex gap-4 text-xs font-bold text-gray-400 mr-4"><button onClick={() => router.push('/')} className="hover:text-blue-500">HOME</button><button onClick={() => router.push('/retro')} className="hover:text-blue-500">RETRO</button></nav>
                    {activeTask && (<button onClick={toggleReveal} className={`px-6 py-3 rounded-xl text-xs font-black transition shadow-lg text-white ${gameState.revealed ? 'bg-slate-700 dark:bg-zinc-700' : 'bg-purple-600 hover:bg-purple-500'}`}>{gameState.revealed ? 'HIDE' : 'REVEAL'}</button>)}
                    <button onClick={toggle} className="p-2 border rounded-full border-gray-200 dark:border-zinc-700">{theme==='dark'?'☀️':'🌙'}</button>
                </div>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 w-full max-w-6xl">
                    {players.map(p => (
                        <div key={p.id} className="flex flex-col items-center gap-4">
                             <div className={`relative w-24 h-36 rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl transition-all duration-500 transform ${gameState.revealed && p.vote ? 'rotate-y-180 bg-white text-slate-900 scale-110 border-2 border-purple-500' : 'bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-800'} ${p.vote && !gameState.revealed ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500 -translate-y-3' : ''}`}>
                                <span className={gameState.revealed && p.vote ? 'rotate-y-180 inline-block' : ''}>{gameState.revealed ? (p.vote || '-') : (p.vote ? '🃏' : '')}</span>
                            </div>
                            <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500">{p.name}</span>
                        </div>
                    ))}
                </div>
                {gameState.revealed && activeTask && (<div className="absolute bottom-32 z-30 animate-in slide-in-from-bottom-10"><div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-purple-500/30 flex items-center gap-8 shadow-2xl"><div className="text-center"><span className="text-[10px] uppercase opacity-50 block mb-1">AVG</span><span className="text-5xl font-black text-purple-600 dark:text-purple-400">{average}</span></div><button onClick={() => completeVoting(average)} className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition">SAVE & NEXT</button></div></div>)}
            </div>
            <footer className="h-32 border-t border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md flex items-center justify-center z-20"><div className="flex gap-2 px-6 overflow-x-auto w-full justify-center custom-scrollbar py-4">{CARDS.map(c => (<button key={c} onClick={() => vote(c)} disabled={!gameState.activeIssueId} className={`flex-shrink-0 w-16 h-24 rounded-xl font-black border-2 transition-all transform duration-200 ${!gameState.activeIssueId ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:-translate-y-4 cursor-pointer'} ${myVote === c ? 'bg-purple-600 border-purple-400 text-white -translate-y-4 shadow-lg' : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 hover:border-purple-500 hover:text-purple-600'}`}>{c}</button>))}</div></footer>
        </main>
    </div>
  );
}
