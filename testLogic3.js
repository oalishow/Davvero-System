const validStudents = [
  { id: '1', name: 'João Victor Ferreira', seminary: 'Seminário Diocesano', diocese: 'Marília' },
  { id: '2', name: 'Marcos Giovane', seminary: 'SPSCJ', diocese: '' },
  { id: '3', name: 'Giovane Silva', seminary: 'SPSCJ', diocese: '' },
  { id: '4', name: 'Gabriel Danelon', seminary: 'SPSCJ', diocese: '' },
  { id: '5', name: 'Gabriel Roberto', seminary: 'SPSCJ', diocese: '' },
  { id: '6', name: 'João Valencio', seminary: 'SPSCJ', diocese: '' },
  { id: '7', name: 'João Pedro', seminary: 'SPSCJ', diocese: '' },
  { id: '8', name: 'Leonardo', seminary: 'Religiosos', diocese: '' },
];

const prof = { id: 'p1', name: 'Padre Alan', seminary: 'SPSCJ', diocese: '' };
const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function matchStudent(cleanName) {
  const normalizedParam = normalizeString(cleanName);
  
  const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel.') || normalizedParam.includes('(rel)');
  const cleanParam = normalizedParam.replace(/\(religioso\)/g, '').replace(/religioso/g, '').replace(/rel\./g, '').replace(/\(rel\)/g, '').trim();
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
           // allow abbreviation match like 'r' for 'roberto'
           if (sParts.some(sp => sp === p || (p.length === 1 && sp.startsWith(p)))) {
              partsMatched++;
           } else {
              hasMismatchedParts = true;
           }
        }
        
        if (partsMatched === nameParts.length && !hasMismatchedParts) {
           score = 70;
           if (isFirstMatch) score += 10;
           if (sParts.length === nameParts.length) score += 10; // Exact parts match
        } else if (partsMatched > 0) {
           score = 20 + (partsMatched * 10);
           if (isFirstMatch) score += 5;
           if (hasMismatchedParts) score -= 15; // Penalty for having parts that don't match anything
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
               // If no hint was provided, being a religioso might mean they should match a religioso
               // Let's add a minor boost if it's the exact name, else maybe penalty if others are SPSCJ?
               // The user said Leonardo is religioso.
               score += 2;
           }
        }
        
        if (score > bestScore) {
           bestScore = score;
           bestMatch = s;
        }
     }
  }
  return bestMatch;
}

console.log("Giovane ->", matchStudent("Giovane"));
console.log("Marcos Giovane ->", matchStudent("Marcos Giovane"));
console.log("Gabriel R. ->", matchStudent("Gabriel R."));
console.log("João Pedro ->", matchStudent("João Pedro"));
console.log("Leonardo ->", matchStudent("Leonardo"));
console.log("Ferreira ->", matchStudent("Ferreira"));

