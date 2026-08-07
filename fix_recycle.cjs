const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

// First restore useEffect to a clean state
content = content.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/, `useEffect(() => {
    setLoading(true);
    const qMembers = query(collection(db, \`artifacts/\${appId}/public/data/students\`));
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
      const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      const now = new Date().getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const filtered = members.filter(m => m.deletedAt);
      const activeDeleted = [];
      for (const m of filtered) {
        if (m.deletedAt) {
          const deleteTime = new Date(m.deletedAt).getTime();
          if (now - deleteTime > thirtyDaysMs) {
            try { await deleteDoc(doc(db, \`artifacts/\${appId}/public/data/students\`, m.id)); } catch {}
            continue;
          }
          activeDeleted.push(m);
        }
      }
      activeDeleted.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      setDeletedMembers(activeDeleted);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const qDoblo = query(collection(db, \`artifacts/\${appId}/public/data/doblo_logs\`));
    const unsubDoblo = onSnapshot(qDoblo, (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DobloLog);
      const now = new Date().getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const filtered = logs.filter(l => l.deletedAt);
      const activeDeleted = [];
      for(const l of filtered) {
        if(l.deletedAt) {
          const deleteTime = new Date(l.deletedAt).getTime();
          if(now - deleteTime > thirtyDaysMs) {
            try { deleteDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, l.id)); } catch {}
            continue;
          }
          activeDeleted.push(l);
        }
      }
      activeDeleted.sort((a,b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
      setDeletedDobloLogs(activeDeleted);
    });

    document.body.style.overflow = 'hidden';
    return () => {
      unsubMembers();
      unsubDoblo();
      document.body.style.overflow = 'unset';
    };
  }, []);`);

// Also add handleRestoreDoblo and update the view
content = content.replace(
`  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, \`artifacts/\${appId}/public/data/students\`, id), { deletedAt: null });
      setDeletedMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
      setErrorMessage('Falha ao restaurar');
    }
  };`,
`  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, \`artifacts/\${appId}/public/data/students\`, id), { deletedAt: null });
      setDeletedMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
      setErrorMessage('Falha ao restaurar');
    }
  };
  
  const handleRestoreDoblo = async (id: string) => {
    try {
      await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: null });
      setDeletedDobloLogs(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
      setErrorMessage('Falha ao restaurar');
    }
  };`
);

// update the view to have tabs
const tabsHtml = `
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 font-bold">
          <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Lixeira (30 dias)
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/30 rounded-2xl mb-4">
            <button
              onClick={() => setActiveTab("members")}
              className={\`flex-1 py-2 rounded-xl text-xs font-bold transition-all \${
                activeTab === "members"
                  ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }\`}
            >
              Membros
            </button>
            <button
              onClick={() => setActiveTab("doblo")}
              className={\`flex-1 py-2 rounded-xl text-xs font-bold transition-all \${
                activeTab === "doblo"
                  ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }\`}
            >
              Doblô
            </button>
        </div>
`;

content = content.replace(
`<div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 font-bold">
          <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Lixeira (30 dias)
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>`,
tabsHtml
);

// update the body
const renderMembers = `
          {loading ? (
             <div className="flex justify-center p-6"><div className="w-6 h-6 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div></div>
          ) : activeTab === "members" ? (
             deletedMembers.length === 0 ? (
               <p className="text-slate-500 italic text-center p-4 text-sm">A lixeira está vazia.</p>
             ) : (
               deletedMembers.map(member => {
                 const now = new Date().getTime();
                 const delTime = new Date(member.deletedAt!).getTime();
                 const daysLeft = Math.max(0, 30 - Math.floor((now - delTime) / (1000 * 60 * 60 * 24)));
                 return (
                   <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 gap-3">
                     <div className="overflow-hidden">
                       <p className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate line-through">{member.name}</p>
                       <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Exclui permanentemente em {daysLeft} dias</p>
                     </div>
                     <button onClick={() => handleRestore(member.id)} className="w-full sm:w-auto flex-shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500 hover:text-emerald-800 dark:hover:text-white">
                       Restaurar
                     </button>
                   </div>
                 );
               })
             )
          ) : (
             deletedDobloLogs.length === 0 ? (
               <p className="text-slate-500 italic text-center p-4 text-sm">A lixeira está vazia.</p>
             ) : (
               deletedDobloLogs.map(log => {
                 const now = new Date().getTime();
                 const delTime = new Date(log.deletedAt!).getTime();
                 const daysLeft = Math.max(0, 30 - Math.floor((now - delTime) / (1000 * 60 * 60 * 24)));
                 return (
                   <div key={log.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-200 dark:border-rose-500/20 gap-3">
                     <div className="overflow-hidden">
                       <p className="font-semibold text-sm text-slate-700 dark:text-slate-300 truncate line-through">{log.name} - {log.destination} ({log.date})</p>
                       <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Exclui permanentemente em {daysLeft} dias</p>
                     </div>
                     <button onClick={() => handleRestoreDoblo(log.id)} className="w-full sm:w-auto flex-shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500 hover:text-emerald-800 dark:hover:text-white">
                       Restaurar
                     </button>
                   </div>
                 );
               })
             )
          )}
`;

content = content.replace(
/\{loading \? \([\s\S]*\}\)/,
renderMembers
);

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
