"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase"; 
import { useTheme } from "../providers";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, doc, setDoc, getDoc, onSnapshot, 
  updateDoc, deleteDoc, serverTimestamp, query, 
  orderBy, writeBatch, addDoc 
} from "firebase/firestore";

// --- UI COMPONENTS ---

const Toast = ({ msg }) => (
  <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-5 z-[200] font-bold text-sm tracking-wide flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
    <span>✨</span> {msg}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar p-8 rounded-[32px] shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 relative">
        <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter text-purple-600 dark:text-purple-400 sticky top-0 bg-white dark:bg-zinc-900 z-10">{title}</h3>
        {children}
        <button onClick={onClose} className="absolute top-6 right-8 text-zinc-400 hover:text-zinc-600 text-xl font-bold z-20">✕</button>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = false }) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-zinc-600 dark:text-zinc-400 mb-8 font-medium">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-black uppercase text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-xs hover:scale-[1.02] transition shadow-lg ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

const CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];

export default function Poker() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // --- STATE ---
  const [rid, setRid] = useState("");
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [gameState, setGameState] = useState({ revealed: false, activeIssueId: null, autoReveal: true, adminUid: null });
  const joinedAt = useRef(Date.now()); 
  
  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("tasks");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [tempName, setTempName] = useState("");
  const [toast, setToast] = useState(null);

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTaskModal, setEditTaskModal] = useState({ open: false, id: null, title: "", desc: "", url: "" });
  const [showAiModal, setShowAiModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ 
    open: false, title: "", message: "", onConfirm: () => {}, isDanger: false, confirmText: "Confirm"
  });

  const [taskForm, setTaskForm] = useState({ title: "", desc: "", url: "" });

  // --- INITIALIZATION ---
  useEffect(() => {
    const room = searchParams.get("room");
    if (!room) return router.push('/');
    setRid(room);

    const savedUid = localStorage.getItem(`poker_uid_${room}`);
    const savedName = localStorage.getItem(`poker_name_${room}`);
    
    if (savedUid && savedName) {
      initUser(room, savedName, savedUid);
    }
  }, [searchParams]);

  const initUser = async (roomId, name, existingUid = null) => {
    let uid = existingUid || Math.random().toString(36).substring(7);
    localStorage.setItem(`poker_uid_${roomId}`, uid);
    localStorage.setItem(`poker_name_${roomId}`, name);
    joinedAt.current = Date.now(); 

    const roomRef = doc(db, "poker_rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    let isAdmin = false;

    // Strict Admin Check
    if (!roomSnap.exists()) {
      await setDoc(roomRef, { revealed: false, activeIssueId: null, autoReveal: true, adminUid: uid });
      isAdmin = true;
    } else {
      const dbAdminUid = roomSnap.data().adminUid;
      if (dbAdminUid === uid) isAdmin = true;
    }

    const userData = { id: uid, name, vote: null, isAdmin, isSpectator: false, lastActive: serverTimestamp() };
    await setDoc(doc(db, "poker_rooms", roomId, "players", uid), userData, { merge: true });
    setUser(userData);
  };

  // --- REALTIME LISTENERS ---
  useEffect(() => {
    if (!rid || !user) return;
    
    const unsubRoom = onSnapshot(doc(db, "poker_rooms", rid), (d) => {
        if (d.exists()) setGameState(d.data());
    });
    
    const unsubPlayers = onSnapshot(collection(db, "poker_rooms", rid, "players"), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(list);
      
      const me = list.find(p => p.id === user.id);
      if (me) {
        if (me.isAdmin !== user.isAdmin) setUser(prev => ({ ...prev, isAdmin: me.isAdmin }));
        if (me.isSpectator !== user.isSpectator) setUser(prev => ({ ...prev, isSpectator: me.isSpectator }));
        
        if (me.isAdmin && gameState.autoReveal && !gameState.revealed && gameState.activeIssueId) {
          const voters = list.filter(p => !p.isSpectator && !p.isBot);
          if (voters.length > 0 && voters.every(p => p.vote !== null)) {
             updateDoc(doc(db, "poker_rooms", rid), { revealed: true });
          }
        }
      }

      // Strict Admin Succession
      const officialAdminUid = gameState.adminUid;
      const adminIsPresent = list.some(p => p.id === officialAdminUid);

      if (list.length > 0 && officialAdminUid && !adminIsPresent) {
         const stabilityPeriod = 3000; 
         const isStable = (Date.now() - joinedAt.current) > stabilityPeriod;

         if (isStable) {
            const sortedList = [...list].sort((a,b) => (a.lastActive?.seconds || 0) - (b.lastActive?.seconds || 0));
            const oldest = sortedList[0];
            
            if (oldest && oldest.id === user.id) {
               const batch = writeBatch(db);
               batch.update(doc(db, "poker_rooms", rid, "players", user.id), { isAdmin: true });
               batch.update(doc(db, "poker_rooms", rid), { adminUid: user.id });
               batch.commit().then(() => {
                  showToast("Previous Admin left. You are now Admin.");
               });
            }
         }
      }
    });

    const unsubIssues = onSnapshot(query(collection(db, "poker_rooms", rid, "issues"), orderBy("order", "asc")), (s) => {
      setIssues(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRoom(); unsubPlayers(); unsubIssues(); };
  }, [rid, user?.id, gameState.autoReveal, gameState.revealed, gameState.activeIssueId, gameState.adminUid, user?.isSpectator, user?.isAdmin]);

  // --- ACTIONS ---
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    await addDoc(collection(db, "poker_rooms", rid, "issues"), { 
      title: taskForm.title, desc: taskForm.desc, url: taskForm.url, order: issues.length, status: "PENDING", score: null 
    });
    setTaskForm({ title: "", desc: "", url: "" });
    setShowTaskModal(false);
    showToast("Task Added");
  };

  const updateTask = async () => {
    if (!editTaskModal.title.trim()) return;
    await updateDoc(doc(db, "poker_rooms", rid, "issues", editTaskModal.id), {
      title: editTaskModal.title, desc: editTaskModal.desc, url: editTaskModal.url
    });
    setEditTaskModal({ open: false, id: null, title: "", desc: "", url: "" });
    showToast("Task Updated");
  };

  const reorderTask = async (taskId, currentOrder, direction) => {
    const newOrder = direction === 'up' ? currentOrder - 1.5 : currentOrder + 1.5;
    await updateDoc(doc(db, "poker_rooms", rid, "issues", taskId), { order: newOrder });
  };

  const handleDeleteTask = (taskId) => {
    setConfirmModal({
      open: true, title: "Delete Task?", message: "This will permanently remove the task.", isDanger: true, confirmText: "Delete",
      onConfirm: () => deleteDoc(doc(db, "poker_rooms", rid, "issues", taskId))
    });
  };

  const handleKickUser = (playerId, playerName) => {
    setConfirmModal({
      open: true, title: `Kick ${playerName}?`, message: "User will be removed from the room.", isDanger: true, confirmText: "Kick",
      onConfirm: () => deleteDoc(doc(db, "poker_rooms", rid, "players", playerId))
    });
  };

  const handleGrantAdmin = (playerId, playerName) => {
    setConfirmModal({
      open: true, title: "Promote to Admin?", message: `Transfer room control to ${playerName}?`, isDanger: false, confirmText: "Promote",
      onConfirm: async () => {
          const batch = writeBatch(db);
          batch.update(doc(db, "poker_rooms", rid, "players", playerId), { isAdmin: true });
          batch.update(doc(db, "poker_rooms", rid), { adminUid: playerId });
          await batch.commit();
      }
    });
  };

  const handleToggleSpectator = async () => {
      const newState = !user.isSpectator;
      await updateDoc(doc(db, "poker_rooms", rid, "players", user.id), { 
          isSpectator: newState,
          vote: null 
      });
  };

  const handleResetVotes = () => {
    setConfirmModal({
        open: true, title: "Reset Votes?", message: "Clear all current votes?", isDanger: true, confirmText: "Reset",
        onConfirm: async () => {
            const batch = writeBatch(db);
            batch.update(doc(db, "poker_rooms", rid), { revealed: false });
            players.forEach(p => batch.update(doc(db, "poker_rooms", rid, "players", p.id), { vote: null }));
            if(players.find(p => p.isBot)) batch.delete(doc(db, "poker_rooms", rid, "players", "ai_bot"));
            await batch.commit();
        }
    });
  };

  const askAi = async () => {
    setShowAiModal(false);
    const activeTask = issues.find(i => i.id === gameState.activeIssueId);
    if (!activeTask) return;
    setIsAiThinking(true);
    try {
      const res = await fetch("/api/estimate", { method: "POST", body: JSON.stringify({ title: activeTask.title, description: activeTask.desc }) });
      const data = await res.json();
      await setDoc(doc(db, "poker_rooms", rid, "players", "ai_bot"), {
        name: "🤖 AI Agent", isBot: true, isAdmin: false, isSpectator: false, vote: data.score.toString(), reason: data.reason
      });
      showToast("AI Joined");
    } catch(e) { alert("AI Error"); } finally { setIsAiThinking(false); }
  };

  const handleSaveAndNext = async () => {
    const validVotes = players.filter(p => !p.isSpectator && p.vote && !isNaN(p.vote));
    const avgScore = validVotes.length > 0 ? (validVotes.reduce((a,b)=>a+Number(b.vote),0) / validVotes.length).toFixed(1) : "0";
    const batch = writeBatch(db);
    batch.update(doc(db, "poker_rooms", rid, "issues", gameState.activeIssueId), { score: avgScore, status: 'ESTIMATED' });
    const currentIndex = issues.findIndex(i => i.id === gameState.activeIssueId);
    const nextTask = issues[currentIndex + 1];
    if (nextTask) {
        batch.update(doc(db, "poker_rooms", rid), { activeIssueId: nextTask.id, revealed: false });
        showToast(`Next: ${nextTask.title}`);
    } else {
        batch.update(doc(db, "poker_rooms", rid), { revealed: false });
        showToast("Session finished.");
    }
    players.forEach(p => batch.update(doc(db, "poker_rooms", rid, "players", p.id), { vote: null }));
    if(players.find(p => p.isBot)) batch.delete(doc(db, "poker_rooms", rid, "players", "ai_bot"));
    await batch.commit();
  };

  const activeTask = issues.find(i => i.id === gameState.activeIssueId);

  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="bg-white dark:bg-zinc-900 p-10 rounded-[40px] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm text-center">
        <h2 className="text-2xl font-black mb-4 dark:text-white">Planning Poker</h2>
        <input value={tempName} onChange={e=>setTempName(e.target.value)} placeholder="Enter Name" className="w-full p-4 bg-zinc-50 dark:bg-black border rounded-2xl mb-4 font-bold text-center" />
        <button onClick={() => tempName.trim() && initUser(rid, tempName)} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black hover:scale-105 transition">JOIN ROOM</button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      
      {toast && <Toast msg={toast} />}

      <header className="h-16 shrink-0 px-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <button onClick={()=>setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" /></svg>
          </button>
          <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-lg">AgileSuite</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
            <span className="text-xs font-mono text-zinc-500">{rid}</span>
          </div>
          <button onClick={()=>{navigator.clipboard.writeText(window.location.href); showToast("Link Copied")}} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition">🔗</button>
          <button onClick={toggle} className="p-2 text-lg hover:rotate-12 transition">{theme==='dark' ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR WITH VERTICAL SCROLLBAR */}
        <aside className={`absolute inset-y-0 left-0 z-40 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 shadow-2xl flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <button onClick={()=>setMenuTab("tasks")} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest ${menuTab==="tasks"?"text-purple-600 border-b-2 border-purple-600":"text-zinc-400"}`}>TASKS</button>
            <button onClick={()=>setMenuTab("users")} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest ${menuTab==="users"?"text-purple-600 border-b-2 border-purple-600":"text-zinc-400"}`}>TEAM</button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-wrap justify-center gap-4 md:gap-6 pt-4 content-start p-4">
            {menuTab === "users" ? players.map(p => (
              <div key={p.id} className="w-full flex justify-between items-center p-3 rounded-2xl bg-zinc-50 dark:bg-black border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.isBot ? 'bg-purple-100 text-purple-600' : 'bg-zinc-200 dark:bg-zinc-800'}`}>{p.isBot ? '🤖' : p.name.charAt(0)}</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[100px]">{p.name} {p.isAdmin && '👑'}</span>
                    {p.isSpectator && <span className="text-[9px] text-zinc-400">Spectator</span>}
                  </div>
                </div>
                
                {user.id === p.id && (
                     <button onClick={handleToggleSpectator} className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded hover:bg-blue-100 transition">
                         {p.isSpectator ? "🃏 JOIN" : "👁️ SPEC"}
                     </button>
                )}
                
                {user.isAdmin && !p.isBot && user.id !== p.id && (
                    <div className="flex gap-1">
                        <button onClick={()=>handleGrantAdmin(p.id, p.name)} className="text-[9px] font-bold text-zinc-400 hover:text-green-500 bg-zinc-100 dark:bg-zinc-900 p-1 rounded">ADMIN</button>
                        <button onClick={()=>handleKickUser(p.id, p.name)} className="text-[9px] font-bold text-zinc-400 hover:text-red-500 bg-zinc-100 dark:bg-zinc-900 p-1 rounded">KICK</button>
                    </div>
                )}
              </div>
            )) : issues.map(i => (
              <div key={i.id} className={`w-full p-4 border rounded-2xl group relative ${gameState.activeIssueId===i.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex justify-between mb-2">
                   <span className="text-[10px] font-black px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{i.score || 'PENDING'}</span>
                   {user.isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition absolute right-2 top-2 bg-white dark:bg-zinc-950 p-1 rounded-lg border shadow-sm z-10">
                       <button onClick={()=>reorderTask(i.id, i.order, 'up')} className="hover:text-purple-600 px-1">⬆</button>
                       <button onClick={()=>reorderTask(i.id, i.order, 'down')} className="hover:text-purple-600 px-1">⬇</button>
                       <button onClick={()=>{setEditTaskModal({open:true, id:i.id, title:i.title, desc:i.desc, url:i.url}); setIsMenuOpen(false);}} className="hover:text-blue-500 px-1">✎</button>
                       <button onClick={()=>handleDeleteTask(i.id)} className="hover:text-red-500 px-1">✕</button>
                    </div>
                   )}
                </div>
                <p className="text-xs font-bold truncate pr-4">{i.title}</p>
                {user.isAdmin && gameState.activeIssueId !== i.id && <button onClick={()=>updateDoc(doc(db,"poker_rooms",rid), {activeIssueId: i.id, revealed: false})} className="w-full mt-2 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-[10px] font-black uppercase">VOTE</button>}
              </div>
            ))}
          </div>
          {menuTab === "tasks" && user.isAdmin && <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0"><button onClick={()=>{setShowTaskModal(true); setIsMenuOpen(false);}} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase">+ ADD TASK</button></div>}
        </aside>

        <main className="flex-1 flex flex-col items-center relative overflow-hidden" onClick={()=>isMenuOpen && setIsMenuOpen(false)}>
           <div className="w-full p-4 shrink-0 z-10 flex flex-col items-center bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm transition-all">
             {activeTask ? (
               <div className="w-full max-w-2xl text-center space-y-4 animate-in zoom-in duration-300">
                  <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-none truncate">{activeTask.title}</h2>
                  {activeTask.desc && <div className="text-left bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap max-h-24 overflow-y-auto custom-scrollbar">{activeTask.desc}</div>}
                  
                  {/* Restored Reference Link */}
                  {activeTask.url && <a href={activeTask.url.startsWith('http') ? activeTask.url : `https://${activeTask.url}`} target="_blank" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline">🔗 Open Link ↗</a>}
                  
                  <div className="flex justify-center gap-2 flex-wrap items-center">
                    <button onClick={()=>setShowAiModal(true)} disabled={isAiThinking} className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase hover:bg-zinc-50 transition shadow-sm flex items-center gap-2"> {isAiThinking ? "..." : "🤖 Ask AI"} </button>
                    {user.isAdmin && (
                      <>
                        <button onClick={()=>updateDoc(doc(db,"poker_rooms",rid), {revealed: !gameState.revealed})} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl text-[10px] font-black uppercase hover:scale-105 transition shadow-lg">{gameState.revealed ? "HIDE" : "REVEAL"}</button>
                        
                        <button 
                            onClick={()=>updateDoc(doc(db,"poker_rooms",rid), {autoReveal: !gameState.autoReveal})} 
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition border ${gameState.autoReveal ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}
                        >
                            ⚡ Auto-Reveal: {gameState.autoReveal ? 'ON' : 'OFF'}
                        </button>

                        {gameState.revealed && (
                           <>
                              <button onClick={handleResetVotes} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 transition shadow-lg">RESET</button>
                              <button onClick={handleSaveAndNext} className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition shadow-lg animate-pulse">SAVE & NEXT ➔</button>
                           </>
                        )}
                      </>
                    )}
                  </div>
                  {gameState.revealed && (
                    <div className="mt-2 p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-2 border-purple-500 rounded-3xl shadow-xl animate-in zoom-in inline-block">
                      <span className="text-[10px] font-black opacity-40 uppercase tracking-widest block mb-1">Average</span>
                      <span className="text-5xl font-black text-purple-600 tracking-tighter">
                        {(players.filter(p=>!p.isSpectator && p.vote && !isNaN(p.vote)).reduce((a,b)=>a+Number(b.vote),0) / players.filter(p=>!p.isSpectator && p.vote && !isNaN(p.vote)).length || 0).toFixed(1)}
                      </span>
                    </div>
                  )}
               </div>
             ) : ( <div className="flex flex-col items-center justify-center opacity-20 py-10"> <div className="text-6xl mb-2 grayscale">🃏</div> <p className="text-xl font-black uppercase tracking-widest">Waiting...</p> </div> )}
           </div>

           <div className="w-full flex-1 overflow-y-auto custom-scrollbar px-6 pb-32">
             <div className="flex flex-wrap justify-center gap-4 md:gap-6 pt-4">
                {players.map(p => (
                  <div key={p.id} className="group flex flex-col items-center">
                    <div className={`relative w-16 h-24 md:w-20 md:h-28 rounded-2xl flex items-center justify-center font-black text-2xl md:text-4xl shadow-lg border-2 transition-all duration-300
                      ${p.isSpectator ? 'border-dashed border-zinc-300 opacity-40 bg-transparent' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'}
                      ${p.vote && !gameState.revealed && !p.isSpectator ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 -translate-y-2 shadow-xl' : ''}
                      ${gameState.revealed && p.vote ? 'text-purple-600 border-purple-600 bg-purple-50 dark:bg-purple-900/20 scale-105 z-10' : ''}
                      ${p.isBot ? 'shadow-purple-500/20 border-purple-200' : ''}
                    `}>
                      {p.isSpectator ? '👁️' : (gameState.revealed ? p.vote : (p.vote ? <span className="text-3xl">🃏</span> : ''))}
                      {p.isBot && <div className="absolute -top-2 -right-2 text-xl bg-white dark:bg-zinc-800 rounded-full shadow-md border p-0.5">🤖</div>}
                    </div>
                    <div className="mt-2 flex flex-col items-center"> <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.vote && !gameState.revealed ? 'bg-green-100 text-green-700' : 'bg-zinc-100 dark:bg-zinc-800'}`}> {p.name} </span> </div>
                  </div>
                ))}
             </div>
           </div>
        </main>
      </div>

      {!user.isSpectator && activeTask && !gameState.revealed && (
        <div className="fixed bottom-0 w-full bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-30 py-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          <div className="flex gap-2 overflow-x-auto justify-start md:justify-center px-6 custom-scrollbar pb-2">
            {CARDS.map(c => ( <button key={c} onClick={()=>updateDoc(doc(db,"poker_rooms",rid,"players",user.id), {vote: c})} className={`shrink-0 w-12 h-16 rounded-xl font-black text-lg border transition-all active:scale-95 ${user.vote === c ? 'bg-purple-600 text-white border-purple-600 -translate-y-2 shadow-lg shadow-purple-600/40' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:border-purple-300 hover:text-purple-600'}`}> {c} </button> ))}
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ ...confirmModal, open: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} isDanger={confirmModal.isDanger} />
      {/* Restored URL Inputs in Modals */}
      <Modal isOpen={showTaskModal} onClose={()=>setShowTaskModal(false)} title="New Task"> <div className="space-y-4"> <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Title" className="w-full p-4 bg-zinc-50 dark:bg-black border rounded-2xl outline-none font-bold" /> <textarea value={taskForm.desc} onChange={e=>setTaskForm({...taskForm,desc:e.target.value})} placeholder="Description" className="w-full p-4 h-24 bg-zinc-50 dark:bg-black border rounded-2xl outline-none resize-none" /> <input value={taskForm.url} onChange={e=>setTaskForm({...taskForm,url:e.target.value})} placeholder="URL (e.g. Jira Link)" className="w-full p-4 bg-zinc-50 dark:bg-black border rounded-2xl outline-none" /> <button onClick={saveTask} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase hover:brightness-110">Save</button> </div> </Modal>
      <Modal isOpen={editTaskModal.open} onClose={()=>setEditTaskModal({...editTaskModal, open:false})} title="Edit Task"> <div className="space-y-4"> <input value={editTaskModal.title} onChange={e=>setEditTaskModal({...editTaskModal,title:e.target.value})} className="w-full p-4 bg-zinc-50 dark:bg-black border rounded-2xl outline-none font-bold" /> <textarea value={editTaskModal.desc} onChange={e=>setEditTaskModal({...editTaskModal,desc:e.target.value})} className="w-full p-4 h-24 bg-zinc-50 dark:bg-black border rounded-2xl outline-none resize-none" /> <input value={editTaskModal.url} onChange={e=>setEditTaskModal({...editTaskModal,url:e.target.value})} className="w-full p-4 bg-zinc-50 dark:bg-black border rounded-2xl outline-none" /> <button onClick={updateTask} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase hover:brightness-110">Update</button> </div> </Modal>
      <Modal isOpen={showAiModal} onClose={()=>setShowAiModal(false)} title="Consult AI?"> <p className="mb-6 text-zinc-500">AI will join and vote.</p> <div className="flex gap-3"> <button onClick={()=>setShowAiModal(false)} className="flex-1 py-3 border rounded-xl font-bold">Cancel</button> <button onClick={askAi} className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold">Yes</button> </div> </Modal>
    </div>
  );
}