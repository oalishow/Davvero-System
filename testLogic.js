const validStudents = [
  { id: '1', name: 'João Silva', seminary: 'SPSCJ' },
  { id: '2', name: 'João Silva', seminary: 'Religiosos' }
];

const prof = { id: 'p1', name: 'Padre Alan', seminary: 'SPSCJ' };
const cleanName = 'João Silva';
const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const normalizedParam = normalizeString(cleanName);

let bestMatch = null;
let bestScore = -1;

for (const s of validStudents) {
   const normName = normalizeString(s.name);
   let score = -1;
   
   if (normName === normalizedParam) {
      score = 100;
   } else {
      const nameParts = normalizedParam.split(' ');
      const sParts = normName.split(' ');
      if (nameParts.length > 0 && sParts[0] === nameParts[0] && sParts.some(p => nameParts.includes(p))) {
         score = 50;
      } else if (normName.includes(normalizedParam) || normalizedParam.includes(normName)) {
         score = 30;
      }
   }
   
   if (score > 0) {
      if (prof?.seminary && s.seminary && s.seminary.includes(prof.seminary)) {
         score += 10;
      } else if (prof?.seminary && prof.seminary.includes(s.seminary)) {
         score += 10;
      } else if (s.seminary === prof?.seminary) {
         score += 10;
      }
      
      if (score > bestScore) {
         bestScore = score;
         bestMatch = s;
      }
   }
}

console.log(bestMatch);
