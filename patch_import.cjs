const fs = require('fs');
let content = fs.readFileSync('src/components/ImportWhatsappModal.tsx', 'utf8');

const target = "    const currentYear = new Date().getFullYear();";
const replacement = `    const currentYear = new Date().getFullYear();
    const prof = professionals.find(p => p.id === selectedProfId);
    const isSpscjProf = prof?.seminary?.includes("SPSCJ") || prof?.diocese?.toUpperCase().includes("SPSCJ");
    
    const validStudents = allStudents.filter(s => {
       if (isSpscjProf) {
         const dio = (s.diocese || "").toUpperCase();
         const sem = (s.seminary || "").toUpperCase();
         if (dio.includes("MARÍLIA") || dio.includes("MARILIA") || dio.includes("BAURU")) return false;
         if (sem.includes("MARÍLIA") || sem.includes("MARILIA") || sem.includes("BAURU")) return false;
       }
       return true;
    });`;

if (content.includes("const validStudents = ")) {
    console.log("Already patched");
} else {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/ImportWhatsappModal.tsx', content);
    console.log("Patched ImportWhatsappModal successfully");
}
