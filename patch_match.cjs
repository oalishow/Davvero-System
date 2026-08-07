const fs = require('fs');
let content = fs.readFileSync('src/components/ImportWhatsappModal.tsx', 'utf8');

const target = `            // Exact match
            let match = validStudents.find(s => normalizeString(s.name) === normalizedParam);
            
            // First name match
            if (!match) {
              const nameParts = normalizedParam.split(' ');
              if (nameParts.length > 0) {
                 const first = nameParts[0];
                 match = validStudents.find(s => {
                    const sParts = normalizeString(s.name).split(' ');
                    return sParts[0] === first && sParts.some(p => nameParts.includes(p));
                 });
              }
            }
            
            // Contains match
            if (!match) {
               match = validStudents.find(s => normalizeString(s.name).includes(normalizedParam) || normalizedParam.includes(normalizeString(s.name)));
            }
            
            if (match) {
              matchedMemberId = match.id;
            }`;

const replacement = `            let bestMatch = null;
            let bestScore = -1;
            
            for (const s of validStudents) {
               const normName = normalizeString(s.name);
               let score = -1;
               
               if (normName === normalizedParam) {
                  score = 100;
               } else {
                  const nameParts = normalizedParam.split(' ');
                  const sParts = normName.split(' ');
                  if (nameParts.length > 0 && sParts[0] === nameParts[0] && nameParts.length > 1 && sParts.some(p => nameParts.slice(1).includes(p))) {
                     score = 50;
                  } else if (normName.includes(normalizedParam) || normalizedParam.includes(normName)) {
                     score = 30;
                  }
               }
               
               if (score > 0) {
                  // Prioritize students from the same seminary/diocese as the professional
                  if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
                     score += 10;
                  } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
                     score += 5;
                  }
                  
                  if (score > bestScore) {
                     bestScore = score;
                     bestMatch = s;
                  }
               }
            }
            
            if (bestMatch) {
              matchedMemberId = bestMatch.id;
            }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ImportWhatsappModal.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Target not found!");
}
