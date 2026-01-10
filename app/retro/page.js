"use client";
import { useState, useEffect } from "react";
import { db } from "../firebase"; 
import { useTheme } from "../providers";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, addDoc, onSnapshot, query, where, 
  orderBy, doc, updateDoc, deleteDoc, serverTimestamp, increment 
} from "firebase/firestore";

// --- UI COMPONENTS ---
const Toast = ({ msg }) => (
  <div className="fixed bottom-6 right-6 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 z-[100] flex items-center gap-3 font-bold">
    <span>✅</span> {msg}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, colorClass = "text-zinc-900 dark:text-white" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-[40px] shadow-2xl border border-zinc-200 dark:border-zinc-800 scale-100 animate-in zoom-in-95">
        <h3 className={`text-2xl font-black mb-6 uppercase tracking-tighter ${colorClass}`}>{title}</h3>
        {children}
        <button onClick={onClose} className="absolute top-6 right-8 text-zinc-400 hover:text-zinc-600 text-xl">✕</button>
      </div>
    </div>
  );
};

export default function Retro() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rid, setRid] = useState("");
  const [items, setItems] = useState([]);
  
  // Modals & State
  const [toast, setToast] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, id: "", text: "" });
  const [addModal, setAddModal] = useState({ open: false, type: "", text: "" }); // YENİ: Ekleme Modalı
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    const r = searchParams.get("room");
    if(r) setRid(r); else router.push('/');
  }, [searchParams]);

  useEffect(() => {
    if (!rid) return;
    const q = query(collection(db, "retros"), where("room", "==", rid), orderBy("timestamp", "asc"));
    return onSnapshot(q, (s) => setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [rid]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleVote = async (id, type) => {
    const field = type === 'like' ? 'likes' : 'dislikes';
    await updateDoc(doc(db, "retros", id), { [field]: increment(1) });
  };

  const COLUMNS = [
    { id: 'start', label: 'START', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900', text: 'text-emerald-700 dark:text-emerald-400', btn: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' },
    { id: 'stop', label: 'STOP', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-100 dark:border-rose-900', text: 'text-rose-700 dark:text-rose-400', btn: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200' },
    { id: 'continue', label: 'CONTINUE', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900', text: 'text-blue-700 dark:text-blue-400', btn: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' }
  ];

  return (
    <div className="h-screen flex flex-col font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors duration-500">
      {toast && <Toast msg={toast} />}

      <header className="h-20 px-8 flex justify-between items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 z-50">
        <button onClick={()=>router.push('/')} className="font-bold text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition flex items-center gap-2">
          <span>←</span> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500">{rid}</span>
          <button onClick={()=>{navigator.clipboard.writeText(window.location.href); showToast("Link copied to clipboard!")}} className="text-xs font-bold px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl hover:scale-105 transition">Share Board</button>
          <button onClick={toggle} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition">{theme === 'dark' ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {COLUMNS.map(col => (
          <div key={col.id} className={`flex flex-col rounded-[32px] overflow-hidden border ${col.border} ${col.bg} shadow-sm`}>
             <div className="p-6 flex justify-between items-center">
               <h3 className={`font-black tracking-widest text-sm ${col.text}`}>{col.label}</h3>
               <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-white/50 dark:bg-black/20 ${col.text}`}>{items.filter(i=>i.type===col.id).length}</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {items.filter(i=>i.type===col.id).map(i => (
                  <div key={i.id} className="p-5 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 group hover:shadow-md transition-all">
                    <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{i.text}</p>
                    <div className="flex justify-between items-center pt-4 mt-2 border-t border-zinc-50 dark:border-zinc-800">
                      <div className="flex gap-3">
                        <button onClick={()=>handleVote(i.id, 'like')} className="text-xs font-bold text-emerald-600 hover:scale-110 transition flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">👍 {i.likes||0}</button>
                        <button onClick={()=>handleVote(i.id, 'dislike')} className="text-xs font-bold text-rose-600 hover:scale-110 transition flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">👎 {i.dislikes||0}</button>
                      </div>
                      <button onClick={()=>setEditModal({open: true, id: i.id, text: i.text})} className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase text-zinc-400 hover:text-blue-500 transition">Edit</button>
                    </div>
                  </div>
                ))}
             </div>
             
             <div className="p-4">
                <button 
                  onClick={() => setAddModal({ open: true, type: col.id, text: "" })} // YENİ: Modal aç
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition hover:brightness-110 active:scale-95 ${col.btn}`}
                >
                  + Add Item
                </button>
             </div>
          </div>
        ))}
      </main>

      {/* --- MODALS --- */}

      {/* 1. ADD MODAL */}
      <Modal 
        isOpen={addModal.open} 
        onClose={() => setAddModal({ ...addModal, open: false })} 
        title={`Add to ${addModal.type}`}
        colorClass={COLUMNS.find(c => c.id === addModal.type)?.text}
      >
        <textarea 
          autoFocus
          value={addModal.text} 
          onChange={e => setAddModal({ ...addModal, text: e.target.value })} 
          placeholder="What's on your mind?" 
          className="w-full p-4 h-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none resize-none focus:ring-2 ring-zinc-400 mb-6"
        />
        <button 
          onClick={async () => {
            if(addModal.text.trim()) {
              await addDoc(collection(db, "retros"), {
                text: addModal.text, 
                type: addModal.type, 
                room: rid, 
                timestamp: serverTimestamp(), 
                likes: 0, 
                dislikes: 0
              });
              setAddModal({ open: false, type: "", text: "" });
              showToast("Note added!");
            }
          }} 
          className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold uppercase text-xs hover:scale-[1.02] transition"
        >
          Post Note
        </button>
      </Modal>

      {/* 2. EDIT MODAL */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ ...editModal, open: false })} title="Edit Note">
        <textarea 
          value={editModal.text} 
          onChange={e => setEditModal({ ...editModal, text: e.target.value })} 
          className="w-full p-4 h-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none resize-none focus:ring-2 ring-blue-500 mb-6"
        />
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(editModal.id)} className="flex-1 py-4 border-2 border-red-100 dark:border-red-900 text-red-500 rounded-2xl font-bold uppercase text-xs hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
          <button onClick={async () => { await updateDoc(doc(db, "retros", editModal.id), { text: editModal.text }); setEditModal({ ...editModal, open: false }); showToast("Updated!"); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase text-xs hover:bg-blue-700">Save</button>
        </div>
      </Modal>

      {/* 3. DELETE CONFIRMATION */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Are you sure?">
        <p className="mb-8 text-zinc-500">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-xs uppercase">Cancel</button>
          <button onClick={async () => { await deleteDoc(doc(db, "retros", deleteId)); setDeleteId(null); setEditModal({ ...editModal, open: false }); showToast("Deleted!"); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase hover:bg-red-600">Yes, Delete</button>
        </div>
      </Modal>
    </div>
  );
}