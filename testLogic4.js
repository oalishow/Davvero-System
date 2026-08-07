const validStudents = [
  { id: '4', name: 'Gabriel Danelon', seminary: 'SPSCJ', diocese: '' },
  { id: '5', name: 'Gabriel Roberto', seminary: 'SPSCJ', diocese: '' },
];
const prof = { id: 'p1', name: 'Padre Alan', seminary: 'SPSCJ', diocese: '' };
const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase().trim();

function matchStudent(cleanName) {
  const normalizedParam = normalizeString(cleanName);
  const cleanParam = normalizedParam.replace(/religioso/g, '').replace(/rel/g, '').trim();
  const nameParts = cleanParam.split(' ').filter(p => p.length > 0);
  
  let bestMatch = null;
  let bestScore = -1;

  for (const s of validStudents) {
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
        if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
           score += 15;
        } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
           score += 5;
        }
        if (score > bestScore) {
           bestScore = score;
           bestMatch = s;
        }
     }
  }
  return bestMatch;
}
console.log("Gabriel R. ->", matchStudent("Gabriel R."));
