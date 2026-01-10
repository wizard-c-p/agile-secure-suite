"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase"; 
import { useTheme } from "../providers";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, doc, setDoc, getDoc, onSnapshot, 
  updateDoc, deleteDoc, serverTimestamp, query, 
  orderBy, writeBatch, addDoc, increment 
} from "firebase/firestore";

const CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];

// --- UI COMPONENTS ---

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right-5 fade-in duration-300">
      <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-medium">
        <span>✨</span>
        {message}
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-100 dark:border-zinc-800 transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function Poker() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [rid, setRid] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [gameState, setGameState] = useState({ revealed: false, activeIssueId: null, autoReveal: true });
  
  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("tasks");
  const [taskModal, setTaskModal] = useState({ open: false, mode: 'create', id: null }); // mode: create | edit
  const [taskForm, setTaskForm] = useState({ title: "", desc: "", url: "" });
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [tempName, setTempName] = useState("");
  const [toast, setToast] = useState(null);

  // 1. Initialization & Auto-Login
  useEffect(() => {
    const room = searchParams.get("room");
    if (!room) return router.push('/');
    setRid(room);

    const checkSession = async () => {
      const savedUid = localStorage.getItem(`poker_uid_${room}`);
      if (savedUid) {
        // Attempt auto-login
        const playerRef = doc(db, "poker_rooms", room, "players", savedUid);
        const playerSnap = await getDoc(playerRef);
        
        if (playerSnap.exists()) {
          setUser({ id: savedUid, ...playerSnap.data() });
          setLoading(false);
          return;
        } else {
          // Stale session
          localStorage.removeItem(`poker_uid_${room}`);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, [searchParams]);

  const initUser = async (roomId, name) => {
    setLoading(true);
    let uid = localStorage.getItem(`poker_uid_${roomId}`) || Math.random().toString(36).substring(7);
    localStorage.setItem(`poker_uid_${roomId}`, uid);
    localStorage.setItem(`poker_identity_global`, name);

    const roomRef = doc(db, "poker_rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    let isAdmin = false;

    if (!roomSnap.exists()) {
      await setDoc(roomRef, { revealed: false, activeIssueId: null, autoReveal: true, adminUid: uid });
      isAdmin = true;
    } else {
      if (roomSnap.data().adminUid === uid) isAdmin = true;
    }

    const userData = { 
      id: uid, 
      name, 
      vote: null, 
      isAdmin, 
      isSpectator: false, 
      lastActive: serverTimestamp(),
      joinedAt: serverTimestamp() 
    };
    
    await setDoc(doc(db, "poker_rooms", roomId, "players", uid), userData, { merge: true });
    setUser(userData);
    setLoading(false);
  };

  // 2. Real-time Listeners
  useEffect(() => {
    if (!rid || !user) return;
    
    // Room State
    const unsubRoom = onSnapshot(doc(db, "poker_rooms", rid), (d) => d.exists() && setGameState(d.data()));
    
    // Players & Admin Succession
    const unsubPlayers = onSnapshot(collection(db, "poker_rooms", rid, "players"), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(list);
      
      const me = list.find(p => p.id === user.id);
      if (me) {
        setUser(me);
        
        // Admin Succession Logic
        const activeAdmins = list.filter(p => p.isAdmin);
        if (activeAdmins.length === 0 && list.length > 0) {
          // Sort by join time (approx via ID if timestamp missing, but we added joinedAt)
          const sorted = [...list].sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0));
          if (sorted[0].id === user.id) {
            updateDoc(doc(db, "poker_rooms", rid, "players", user.id), { isAdmin: true });
            updateDoc(doc(db, "poker_rooms", rid), { adminUid: user.id });
          }
        }

        // Auto-Reveal Logic
        if (me.isAdmin && gameState.autoReveal && !gameState.revealed && gameState.activeIssueId) {
          const voters = list.filter(p => !p.isSpectator && !p.isBot);
          if (voters.length > 0 && voters.every(p => p.vote !== null && p.vote !== undefined)) {
             updateDoc(doc(db, "poker_rooms", rid), { revealed: true });
          }
        }
      }
    });

    // Issues
    const unsubIssues = onSnapshot(query(collection(db, "poker_rooms", rid, "issues"), orderBy("order", "asc")), (s) => {
      setIssues(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRoom(); unsubPlayers(); unsubIssues(); };
  }, [rid, user?.id, gameState.autoReveal, gameState.revealed, gameState.activeIssueId]);

  // 3. Actions
  const saveTask = async () => {
    if (!taskForm.title.trim() || !rid) return;
    try {
      if (taskModal.mode === 'create') {
        await addDoc(collection(db, "poker_rooms", rid, "issues"), { 
          title: taskForm.title, 
          desc: taskForm.desc, 
          url: taskForm.url, 
          order: issues.length, 
          status: "PENDING" 
        });
        showToast("Task created successfully");
      } else {
        await updateDoc(doc(db, "poker_rooms", rid, "issues", taskModal.id), {
          title: taskForm.title,
          desc: taskForm.desc,
          url: taskForm.url
        });
        showToast("Task updated");
      }
      setTaskForm({ title: "", desc: "", url: "" });
      setTaskModal({ open: false, mode: 'create', id: null });
    } catch (e) { alert("Error saving task. Check permissions."); }
  };

  const openEditTask = (task) => {
    setTaskForm({ title: task.title, desc: task.desc || "", url: task.url || "" });
    setTaskModal({ open: true, mode: 'edit', id: task.id });
  };

  const moveTask = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === issues.length - 1) return;
    
    const taskA = issues[index];
    const taskB = issues[index + direction];
    
    // Swap orders
    const batch = writeBatch(db);
    batch.update(doc(db, "poker_rooms", rid, "issues", taskA.id), { order: taskB.order });
    batch.update(doc(db, "poker_rooms", rid, "issues", taskB.id), { order: taskA.order });
    await batch.commit();
  };

  const reVote = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, "poker_rooms", rid), { revealed: false });
    players.forEach(p => batch.update(doc(db, "poker_rooms", rid, "players", p.id), { vote: null }));
    await batch.commit();
    showToast("Votes reset!");
  };

  const askAi = async () => {
    setAiModalOpen(false);
    const activeTask = issues.find(i => i.id === gameState.activeIssueId);
    if (!activeTask) return;
    setIsAiThinking(true);
    try {
      const res = await fetch("/api/estimate", { method: "POST", body: JSON.stringify({ title: activeTask.title, description: activeTask.desc }) });
      const data = await res.json();
      
      // Add AI as a bot player
      await setDoc(doc(db, "poker_rooms", rid, "players", "ai-bot"), {
        name: "AI Bot",
        isBot: true,
        vote: data.score,
        isSpectator: false,
        id: "ai-bot"
      });
      showToast("AI has voted!");
    } catch(e) { alert("AI currently unavailable"); } finally { setIsAiThinking(false); }
  };

  const grantAdmin = async (targetUid) => {
    await updateDoc(doc(db, "poker_rooms", rid, "players", targetUid), { isAdmin: true });
    showToast("Admin rights granted");
  };

  const showToast = (msg) => setToast(msg);

  // 4. Render
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-600"></div>
    </div>
  );

  if (!user) return (
    <div className="h-screen flex items-center justify-center p-6 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-zinc-950 dark:to-zinc-900">
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/20 shadow-2xl w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Join Session</h2>
        <input value={tempName} onChange={e=>setTempName(e.target.value)} placeholder="Your Name" className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl mb-4 outline-none focus:ring-2 ring-violet-500 transition" />
        <button onClick={() => tempName.trim() && initUser(rid, tempName)} className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">Enter Room</button>
      </div>
    </div>
  );

  const activeTask = issues.find(i => i.id === gameState.activeIssueId);
  const averageScore = (players.filter(p=>!p.isSpectator && p.vote && !isNaN(p.vote)).reduce((a,b)=>a+Number(b.vote),0) / players.filter(p=>!p.isSpectator && p.vote && !isNaN(p.vote)).length || 0).toFixed(1);

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans bg-zinc-50 dark:bg-zinc-950">
      {toast && <Toast message={toast} onClose={()=>setToast(null)} />}

      {/* HEADER */}
      <header className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <button onClick={()=>setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
             <span className="font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">Planning Poker</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full text-zinc-500 border border-zinc-200 dark:border-zinc-700">{rid}</span>
          <button onClick={()=>{navigator.clipboard.writeText(window.location.href); showToast("Link copied to clipboard!")}} className="text-sm px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition font-medium">Share</button>
          <button onClick={toggle} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">{theme==='dark' ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* HAMBURGER SIDEBAR */}
        <aside className={`absolute inset-y-0 left-0 z-50 w-80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 shadow-2xl ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button onClick={()=>setMenuTab("tasks")} className={`flex-1 py-4 text-sm font-bold tracking-wide ${menuTab==="tasks"?"text-violet-600 border-b-2 border-violet-600":"text-zinc-500"}`}>TASKS</button>
            <button onClick={()=>setMenuTab("users")} className={`flex-1 py-4 text-sm font-bold tracking-wide ${menuTab==="users"?"text-violet-600 border-b-2 border-violet-600":"text-zinc-500"}`}>TEAM</button>
          </div>
          
          <div className="p-4 h-[calc(100%-110px)] overflow-y-auto">
            {menuTab === "users" ? players.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 mb-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${p.vote ? 'bg-green-500' : 'bg-zinc-300'}`}></div>
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.isAdmin && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">ADMIN</span>}
                  {p.isSpectator && <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">SPEC</span>}
                  {p.isBot && <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded">AI</span>}
                </div>
                <div className="flex gap-2">
                  {user.id === p.id && <button onClick={()=>updateDoc(doc(db,"poker_rooms",rid,"players",p.id), {isSpectator: !p.isSpectator, vote: null})} className="text-xs text-blue-600 font-medium hover:underline">{p.isSpectator ? 'Join' : 'Spectate'}</button>}
                  {user.isAdmin && user.id !== p.id && (
                    <>
                      <button onClick={()=>grantAdmin(p.id)} className="text-xs text-zinc-400 hover:text-yellow-600" title="Make Admin">👑</button>
                      <button onClick={()=>deleteDoc(doc(db,"poker_rooms",rid,"players",p.id))} className="text-xs text-zinc-400 hover:text-red-500" title="Kick">✕</button>
                    </>
                  )}
                </div>
              </div>
            )) : (
              <div className="space-y-3">
                {issues.map((i, idx) => (
                  <div key={i.id} onClick={() => user.isAdmin && openEditTask(i)} className={`p-4 border rounded-2xl group cursor-pointer transition-all hover:shadow-md ${gameState.activeIssueId===i.id ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-900/20 ring-1 ring-violet-500' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                    <div className="flex justify-between items-start">
                       <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{i.score || '-'}</span>
                       {user.isAdmin && (
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                            <button onClick={()=>moveTask(idx, -1)} className="p-1 hover:bg-zinc-200 rounded">↑</button>
                            <button onClick={()=>moveTask(idx, 1)} className="p-1 hover:bg-zinc-200 rounded">↓</button>
                            <button onClick={()=>deleteDoc(doc(db,"poker_rooms",rid,"issues",i.id))} className="p-1 text-red-500 hover:bg-red-50 rounded">✕</button>
                         </div>
                       )}
                    </div>
                    <p className="text-sm font-medium mt-2">{i.title}</p>
                    {user.isAdmin && gameState.activeIssueId !== i.id && (
                      <button onClick={(e)=>{e.stopPropagation(); updateDoc(doc(db,"poker_rooms",rid), {activeIssueId: i.id, revealed: false})}} className="w-full mt-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-xs font-medium hover:opacity-90">Vote This</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {menuTab === "tasks" && (
            <div className="absolute bottom-0 w-full p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
               <button onClick={()=>{setTaskForm({title:"",desc:"",url:""}); setTaskModal({open:true, mode:'create', id:null})}} className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-200 dark:shadow-none">+ Add Task</button>
            </div>
          )}
        </aside>

        {/* MAIN STAGE */}
        <main className="flex-1 p-8 flex flex-col items-center justify-center relative" onClick={()=>isMenuOpen && setIsMenuOpen(false)}>
           {/* Background Gradients */}
           <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
           </div>

           {activeTask ? (
             <div className="w-full max-w-4xl text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <span className="inline-block px-4 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold tracking-widest uppercase shadow-sm">Active Issue</span>
                
                <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white drop-shadow-sm">{activeTask.title}</h2>
                
                {activeTask.desc && <div className="text-left bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md p-8 rounded-3xl border border-white/50 dark:border-zinc-700 shadow-xl text-zinc-600 dark:text-zinc-300 text-lg leading-relaxed max-w-2xl mx-auto">{activeTask.desc}</div>}
                
                {activeTask.url && (
                  <a href={activeTask.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-medium hover:bg-blue-100 transition group">
                    <span>🔗</span> <span className="group-hover:underline">Open Reference Link</span>
                  </a>
                )}

                <div className="flex justify-center gap-4">
                  <button onClick={()=>setAiModalOpen(true)} disabled={isAiThinking} className="px-6 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold hover:scale-105 transition shadow-lg flex items-center gap-2">
                    {isAiThinking ? <span className="animate-spin">⚙️</span> : '🤖'} Ask AI
                  </button>
                  {user.isAdmin && (
                    <>
                      <button onClick={()=>updateDoc(doc(db,"poker_rooms",rid), {revealed: !gameState.revealed})} className="px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl hover:scale-105 transition">{gameState.revealed ? "Hide Cards" : "Reveal Cards"}</button>
                      {gameState.revealed && <button onClick={reVote} className="px-6 py-3 bg-orange-100 text-orange-700 rounded-2xl text-sm font-bold hover:bg-orange-200 transition">Re-Vote</button>}
                      <label className="flex items-center gap-2 px-5 py-3 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-white transition">
                        <input type="checkbox" checked={gameState.autoReveal} onChange={e=>updateDoc(doc(db,"poker_rooms",rid),{autoReveal:e.target.checked})} className="w-4 h-4 accent-violet-600"/>
                        <span className="text-xs font-medium">Auto-Reveal</span>
                      </label>
                    </>
                  )}
                </div>

                {gameState.revealed && (
                  <div className="mt-8 p-8 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl animate-in zoom-in-50 duration-300">
                    <div className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-2">Average Score</div>
                    <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-violet-600 to-fuchsia-600">
                      {averageScore}
                    </div>
                  </div>
                )}
             </div>
           ) : (
             <div className="text-center opacity-40">
                <span className="text-8xl">🃏</span>
                <p className="mt-4 text-xl font-medium">Select a task from the menu</p>
             </div>
           )}

           {/* PLAYERS GRID */}
           <div className="mt-12 flex flex-wrap justify-center gap-6 mb-32">
             {players.map(p => (
               <div key={p.id} className="flex flex-col items-center">
                 <div className={`w-20 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg border-2 transition-all duration-500 transform
                   ${p.isSpectator ? 'border-dashed border-zinc-300 opacity-50' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}
                   ${p.vote && !gameState.revealed && !p.isSpectator ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 border-transparent -translate-y-4 shadow-violet-500/30' : ''}
                   ${gameState.revealed && p.vote ? 'text-violet-600 border-violet-200 bg-violet-50 dark:bg-violet-900/20' : ''}
                 `}>
                   {p.isSpectator ? '👁️' : (gameState.revealed ? p.vote : (p.vote ? '' : ''))}
                 </div>
                 <span className="text-xs font-medium mt-2">{p.name}</span>
               </div>
             ))}
           </div>
        </main>
      </div>

      {/* VOTING BAR */}
      {!user.isSpectator && activeTask && !gameState.revealed && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 max-w-[90vw] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 dark:border-zinc-700 p-4 rounded-3xl shadow-2xl z-30">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CARDS.map(c => (
              <button key={c} onClick={()=>updateDoc(doc(db,"poker_rooms",rid,"players",user.id), {vote: c})} className={`shrink-0 w-14 h-20 rounded-xl font-bold border-2 transition-all duration-200 ${user.vote === c ? 'bg-violet-600 border-violet-600 text-white -translate-y-4 shadow-lg shadow-violet-500/40' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-violet-400 hover:-translate-y-1'}`}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      <Modal isOpen={taskModal.open} onClose={()=>setTaskModal({...taskModal, open:false})} title={taskModal.mode === 'create' ? "New Task" : "Edit Task"}>
        <div className="space-y-4">
          <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm, title: e.target.value})} placeholder="Task Title" className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 ring-violet-500" />
          <textarea value={taskForm.desc} onChange={e=>setTaskForm({...taskForm, desc: e.target.value})} placeholder="Description (Optional)" className="w-full p-4 h-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none resize-none focus:ring-2 ring-violet-500" />
          <input value={taskForm.url} onChange={e=>setTaskForm({...taskForm, url: e.target.value})} placeholder="Jira/Ticket URL (Optional)" className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 ring-violet-500" />
          <button onClick={saveTask} className="w-full py-4 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition shadow-lg">Save Task</button>
        </div>
      </Modal>

      <Modal isOpen={aiModalOpen} onClose={()=>setAiModalOpen(false)} title="Consult AI?">
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">The AI will analyze the task title and description to provide a Fibonacci estimate. It will join the table as a bot.</p>
        <div className="flex gap-3">
          <button onClick={()=>setAiModalOpen(false)} className="flex-1 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium">Cancel</button>
          <button onClick={askAi} className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700">Yes, Ask AI</button>
        </div>
      </Modal>
    </div>
  );
}