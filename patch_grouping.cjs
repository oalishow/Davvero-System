const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetGroup = `  const groupedBySeminary: Record<string, Record<string, Availability[]>> = {};
  filteredAvailabilities.forEach(a => {
    const sem = a.seminary || "Outros / Sem Seminário";
    if (!groupedBySeminary[sem]) groupedBySeminary[sem] = {};
    if (!groupedBySeminary[sem][a.date]) groupedBySeminary[sem][a.date] = [];
    groupedBySeminary[sem][a.date].push(a);
  });`;

const replacementGroup = `  const groupedBySeminary: Record<string, Record<string, Availability[]>> = {};
  filteredAvailabilities.forEach(a => {
    let sem = a.seminary || "Geral / Não Especificado";
    if (a.status === 'OCUPADO') {
       const appt = appointments.find(ap => ap.availabilityId === a.id);
       if (appt && appt.memberId && appt.memberId !== 'unmatched') {
          const student = allStudents.find(s => s.id === appt.memberId);
          if (student && student.seminary) {
             sem = student.seminary;
          }
       }
    }
    if (!groupedBySeminary[sem]) groupedBySeminary[sem] = {};
    if (!groupedBySeminary[sem][a.date]) groupedBySeminary[sem][a.date] = [];
    groupedBySeminary[sem][a.date].push(a);
  });`;

content = content.replace(targetGroup, replacementGroup);
fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched grouping in AdminAppointments!");
