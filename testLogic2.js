const validStudents = [
  { id: '1', name: 'João Silva', seminary: 'SPSCJ', diocese: '' },
  { id: '2', name: 'João Silva', seminary: 'Religiosos', diocese: '' },
  { id: '3', name: 'Valencio Silva', seminary: 'SPSCJ', diocese: '' },
  { id: '4', name: 'Valencio Augusto', seminary: 'Religiosos', diocese: '' }
];

const prof = { id: 'p1', name: 'Padre Alan', seminary: 'SPSCJ', diocese: '' };
const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function matchStudent(cleanName) {
  const normalizedParam = normalizeString(cleanName);
  
  // Detect if there's an explicit "religioso" hint
  const hasReligiosoHint = normalizedParam.includes('religioso') || normalizedParam.includes('rel.') || normalizedParam.includes('(rel)');
  
  // Remove the hint from the param for better name matching
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
     } else {
        if (nameParts.length > 0 && sParts[0] === nameParts[0]) {
           // First name matches
           score = 40;
           // If more parts match, increase score
           if (nameParts.length > 1 && sParts.some(p => nameParts.slice(1).includes(p))) {
              score = 60;
           }
        } else if (normName.includes(cleanParam) || cleanParam.includes(normName)) {
           score = 30;
        }
     }
     
     if (score > 0) {
        if (hasReligiosoHint) {
           if (s.seminary && s.seminary.toUpperCase().includes('RELIGIOSOS')) {
               score += 50; // Huge boost if explicit hint matches seminary
           } else {
               score -= 20; // Penalty if hint is present but they are not religioso
           }
        } else {
           // Standard priority based on prof's seminary/diocese
           if (prof?.seminary && s.seminary && (s.seminary.includes(prof.seminary) || prof.seminary.includes(s.seminary))) {
              score += 15;
           } else if (prof?.diocese && s.diocese && (s.diocese.includes(prof.diocese) || prof.diocese.includes(s.diocese))) {
              score += 5;
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

console.log("Valencio ->", matchStudent("Valencio"));
console.log("Valencio (Religioso) ->", matchStudent("Valencio (Religioso)"));
console.log("Valêncio Rel. ->", matchStudent("Valêncio Rel."));
console.log("João Silva ->", matchStudent("João Silva"));
console.log("João (Religioso) ->", matchStudent("João (Religioso)"));

