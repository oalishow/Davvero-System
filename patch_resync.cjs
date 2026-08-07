const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetBtn = `            <button 
              onClick={() => setShowDeleteModal(true)} 
              className="flex-1 sm:flex-none justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/60 transition"
            >
              <Trash2 className="w-4 h-4"/> Apagar Todos
            </button>`;

const replacementBtn = `            <button 
              onClick={forceResync} 
              className="flex-1 sm:flex-none justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
            >
              <CheckCircle className="w-4 h-4"/> Re-sincronizar
            </button>
            <button 
              onClick={() => setShowDeleteModal(true)} 
              className="flex-1 sm:flex-none justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-200 dark:hover:bg-red-900/60 transition"
            >
              <Trash2 className="w-4 h-4"/> Apagar Todos
            </button>`;

content = content.replace(targetBtn, replacementBtn);

const targetFunc = `  const handleCreateAvailability = async () => {`;
const replacementFunc = `  const forceResync = async () => {
    if (appointments.length === 0) return;
    setLoading(true);
    let updatedCount = 0;
    
    for (const appt of appointments) {
       if (!appt.studentName || appt.studentName === 'Desconhecido' || appt.studentName.trim() === '') continue;
       
       const prof = professionals.find(p => p.id === appt.professionalId);
       const normalizedParam = normalizeString(appt.studentName);
       
       const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
       let cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
       
       if (cleanParam === 'ferreira') cleanParam = 'joao victor ferreira';
       if (cleanParam === 'giovane') cleanParam = 'giovane silva';
       if (cleanParam === 'gabriel r') cleanParam = 'gabriel roberto';
       if (cleanParam === 'leonardo') cleanParam = 'leonardo religioso';
       
       const nameParts = cleanParam.split(' ').filter(p => p.length > 0);
       
       let bestMatch = null;
       let bestScore = -1;
       
       for (const s of allStudents) {
           const normName = normalizeString(s.name);
           const sParts = normName.split(' ').filter(p => p.length > 0);
           let score = -1;
           
           if (normName === cleanParam) {
              score = 100;
           } else if (nameParts.length > 0 && sParts.length > 0) {
              let partsMatched = 0;
              let isFirstMatch = sParts[0] === nameParts[0];
              let hasMismatchedParts = false;
              
              for (const p of nameParts) {
                 if (sParts.some(sp => sp === p || (p.length === 1 && sp.startsWith(p)))) {
                    partsMatched++;
                 } else {
                    hasMismatchedParts = true;
                 }
              }
              
              if (partsMatched === nameParts.length && !hasMismatchedParts) {
                 score = 70;
                 if (isFirstMatch) score += 10;
                 if (sParts.length === nameParts.length) score += 10;
              } else if (partsMatched > 0) {
                 score = 20 + (partsMatched * 10);
                 if (isFirstMatch) score += 5;
                 if (hasMismatchedParts) score -= 15;
              } else if (normName.includes(cleanParam)) {
                 score = 10;
              }
           }
           
           if (score > 0) {
              if (hasReligiosoHint || appt.studentName.toLowerCase().includes('leonardo')) {
                 if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                     score += 50;
                 } else {
                     score -= 20;
                 }
              } else if (appt.studentName.toLowerCase().includes('ferreira')) {
                 if (s.diocese && s.diocese.toUpperCase().includes('MARILIA')) {
                     score += 50;
                 } else {
                     score -= 20;
                 }
              } else {
                 if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
                    score += 15;
                 } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
                    score += 5;
                 }
                 if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
                     score += 2;
                 }
              }
              
              if (score > bestScore) {
                 bestScore = score;
                 bestMatch = s;
              }
           }
       }
       
       const newMemberId = bestMatch ? bestMatch.id : "unmatched";
       
       if (appt.memberId !== newMemberId) {
          try {
             await updateDoc(doc(db, \`artifacts/\${appId}/public/data/appointments\`, appt.id), {
                memberId: newMemberId
             });
             updatedCount++;
          } catch (e) {
             console.error(e);
          }
       }
    }
    setLoading(false);
    showAlert(\`Re-sincronização concluída! \${updatedCount} atendimentos foram corrigidos.\`, 'success');
  };

  const handleCreateAvailability = async () => {`;

content = content.replace(targetFunc, replacementFunc);
fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched resync in AdminAppointments!");
