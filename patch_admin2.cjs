const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const target = `         const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
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
         }`;

const replacement = `         const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel');
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
         }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/AdminAppointments.tsx', content);
    console.log("Patched successfully Admin");
} else {
    console.log("Not found in Admin");
}
