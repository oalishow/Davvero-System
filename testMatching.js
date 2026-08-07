const prof = { id: 'p1', name: 'Padre Alan', seminary: 'SPSCJ', diocese: '' };
const allStudents = [
  { id: '1', name: 'João Silva', seminary: 'SPSCJ', diocese: '' },
  { id: '2', name: 'João Souza', seminary: 'Religiosos', diocese: '' },
  { id: '3', name: 'Valencio', seminary: 'SPSCJ', diocese: '' },
  { id: '4', name: 'Valencio (Religioso)', seminary: 'Religiosos', diocese: '' },
  { id: '5', name: 'Gabriel Roberto', seminary: 'SPSCJ', diocese: '' },
  { id: '6', name: 'Gabriel Danelon', seminary: 'SPSCJ', diocese: '' }
];

const normalizeString = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function matchStudent(cleanName) {
  const normalizedParam = normalizeString(cleanName);
  let bestMatch = null;
  let bestScore = -1;
  
  for (const s of allStudents) {
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
  return bestMatch;
}

console.log("Luan ->", matchStudent("Luan"));
console.log("Valencio ->", matchStudent("Valencio"));
console.log("João ->", matchStudent("João"));
console.log("Gabriel R ->", matchStudent("Gabriel R"));

