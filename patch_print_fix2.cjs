const fs = require('fs');
let content = fs.readFileSync('src/components/PrintAppointmentsModal.tsx', 'utf8');

const target2 = `Object.entries(
              filteredAppointments.reduce((acc, item) => {
                const sem = (item as any).studentSeminary || item.avail.seminary || 'Outros / Não Especificado';
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(item);
                return acc;
              }, {} as Record<string, any[]>)
            ).sort(([a], [b]) => a.localeCompare(b)).map(([seminary, items]) => (`;
            
const replacement2 = `(Object.entries(
              filteredAppointments.reduce((acc, item) => {
                const sem = (item as any).studentSeminary || item.avail.seminary || 'Outros / Não Especificado';
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(item);
                return acc;
              }, {} as Record<string, any[]>)
            ) as [string, any[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([seminary, items]) => (`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/components/PrintAppointmentsModal.tsx', content);
console.log("Patched PrintAppointmentsModal type errors!");
