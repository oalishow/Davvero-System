const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

if (!content.includes('DobloLog')) {
    content = content.replace(
        `import type { Member } from '../types';`,
        `import type { Member } from '../types';\ninterface DobloLog { id: string; name: string; date: string; departureTime: string; destination: string; deletedAt?: string; }`
    );

    content = content.replace(
        `const [deletedMembers, setDeletedMembers] = useState<Member[]>([]);`,
        `const [deletedMembers, setDeletedMembers] = useState<Member[]>([]);
  const [deletedDobloLogs, setDeletedDobloLogs] = useState<DobloLog[]>([]);
  const [activeTab, setActiveTab] = useState<"members" | "doblo">("members");`
    );
    
    // update useEffect
    content = content.replace(
        `    const q = query(collection(db, \`artifacts/\${appId}/public/data/students\`));
    const unsub = onSnapshot(q, async (snapshot) => {`,
        `    const q = query(collection(db, \`artifacts/\${appId}/public/data/students\`));
    const unsub = onSnapshot(q, async (snapshot) => {`
    );
    
    content = content.replace(
        `setLoading(false);
    }, (err) => {`,
        `    const qDoblo = query(collection(db, \`artifacts/\${appId}/public/data/doblo_logs\`));
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
      setLoading(false);
      return unsubDoblo;
    }, (err) => {`
    );
    
    content = content.replace(
        `unsub();
      document.body.style.overflow = 'unset';`,
        `unsub();
      // unsubDoblo is managed internally or we can just ignore it for modal, wait, let's just do it cleanly`
    );
}

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
