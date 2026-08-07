const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetUseEffect = `    const unsubAppt = onSnapshot(qAppt, (snap) => {
      const appts: Appointment[] = [];
      snap.forEach(d => appts.push({ ...d.data(), id: d.id } as Appointment));
      setAppointments(appts);
      setLoading(false);
    });`;

const replacementUseEffect = `    const unsubAppt = onSnapshot(qAppt, (snap) => {
      const appts: Appointment[] = [];
      snap.forEach(d => appts.push({ ...d.data(), id: d.id } as Appointment));
      setAppointments(appts);
      setLoading(false);
    });`;

// Wait, I can just append my useEffect below it.
const injection = `
  // Auto-link unmatched appointments when students are loaded
  useEffect(() => {
    if (allStudents.length === 0 || appointments.length === 0 || professionals.length === 0) return;
    
    const normalizeString = (str: string) => {
      return str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9 ]/gi, "").toLowerCase().replace(/\\s+/g, ' ').trim();
    };

    const runAutoLink = async () => {
      const unmatched = appointments.filter(a => a.memberId === "unmatched" && a.studentName && a.studentName !== "Desconhecido");
      if (unmatched.length === 0) return;
      
      let updatedCount = 0;
      
      for (const appt of unmatched) {
         const prof = professionals.find(p => p.id === appt.professionalId);
         const normalizedParam = normalizeString(appt.studentName);
         
         const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
         const cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
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
                if (hasReligiosoHint) {
                   if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
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
         
         if (bestMatch && bestScore > 20) {
             try {
                await updateDoc(doc(db, \`artifacts/\${appId}/public/data/appointments\`, appt.id), {
                   memberId: bestMatch.id,
                   studentName: bestMatch.name
                });
                updatedCount++;
             } catch(e) {
                console.error("Error auto linking", e);
             }
         }
      }
      
      if (updatedCount > 0) {
         console.log(\`Auto-linked \${updatedCount} appointments\`);
      }
    };
    runAutoLink();
  }, [allStudents, appointments, professionals]);
`;

if (!content.includes("runAutoLink")) {
    content = content.replace(targetUseEffect, targetUseEffect + injection);
    fs.writeFileSync('src/components/AdminAppointments.tsx', content);
    console.log("Patched runAutoLink");
} else {
    console.log("Already patched runAutoLink");
}

