const fs = require('fs');
let content = fs.readFileSync('src/components/PrintAppointmentsModal.tsx', 'utf8');

const fetchTarget = `        const qAppts = query(collection(db, \`artifacts/\${appId}/public/data/appointments\`));
        const snapAppts = await getDocs(qAppts);
        const appts = snapAppts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        const combined = avails
          .filter(a => a.status === 'OCUPADO')
          .map(a => {
             const appt = appts.find(ap => ap.availabilityId === a.id);
             return { avail: a, appt: appt as Appointment };
          })
          .filter(item => item.appt != null);
          
        setAppointmentsData(combined);`;

const fetchReplacement = `        const qAppts = query(collection(db, \`artifacts/\${appId}/public/data/appointments\`));
        const snapAppts = await getDocs(qAppts);
        const appts = snapAppts.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        const qStudents = query(collection(db, \`artifacts/\${appId}/public/data/students\`));
        const snapStudents = await getDocs(qStudents);
        const students = snapStudents.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const combined = avails
          .filter(a => a.status === 'OCUPADO')
          .map(a => {
             const appt = appts.find(ap => ap.availabilityId === a.id);
             let studentSeminary = a.seminary || 'Geral';
             if (appt && appt.memberId && appt.memberId !== 'unmatched') {
                 const student = students.find(s => s.id === appt.memberId);
                 if (student && student.seminary) {
                     studentSeminary = student.seminary;
                 }
             }
             return { avail: a, appt: appt as Appointment, studentSeminary };
          })
          .filter(item => item.appt != null);
          
        setAppointmentsData(combined as any);`;

content = content.replace(fetchTarget, fetchReplacement);

// Render part
const renderTarget = `        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 no-print">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">A carregar agendamentos para impressão...</p>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:text-black">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 print:bg-slate-100">
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Data</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Horário</th>
                  {selectedProfessional === 'all' && (
                    <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Profissional</th>
                  )}
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Aluno / Agendado por</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Local</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Seminário</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map(({ avail, appt }) => {
                  const parts = avail.date.split('-');
                  const formattedDate = \`\${parts[2]}/\${parts[1]}/\${parts[0]}\`;
                  return (
                    <tr key={avail.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-bold whitespace-nowrap">{formattedDate} <br/><span className="text-[10px] font-normal text-slate-500">{getDayOfWeek(avail.date)}</span></td>
                      <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-indigo-600">{avail.startTime}</td>
                      {selectedProfessional === 'all' && (
                        <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 font-semibold">{avail.professionalName}</td>
                      )}
                      <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-emerald-600 font-bold">{appt.studentName || 'Desconhecido'}</td>
                      <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600">{avail.location || '-'}</td>
                      <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600">{avail.seminary || 'Geral'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAppointments.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum agendamento encontrado.
              </div>
            )}
          </div>
        )}`;

const renderReplacement = `        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 no-print">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">A carregar agendamentos para impressão...</p>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible space-y-8">
            {Object.entries(
              filteredAppointments.reduce((acc, item) => {
                const sem = (item as any).studentSeminary || item.avail.seminary || 'Outros / Não Especificado';
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(item);
                return acc;
              }, {} as Record<string, typeof filteredAppointments>)
            ).sort(([a], [b]) => a.localeCompare(b)).map(([seminary, items]) => (
              <div key={seminary} className="break-inside-avoid">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3 pb-2 border-b-2 border-slate-800 print:text-black">{seminary}</h3>
                <table className="w-full text-left border-collapse print:text-black mb-6">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 print:bg-slate-100">
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Data</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Horário</th>
                      {selectedProfessional === 'all' && (
                        <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Profissional</th>
                      )}
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Aluno / Agendado por</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ avail, appt }: any) => {
                      const parts = avail.date.split('-');
                      const formattedDate = \`\${parts[2]}/\${parts[1]}/\${parts[0]}\`;
                      return (
                        <tr key={avail.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-bold whitespace-nowrap">{formattedDate} <br/><span className="text-[10px] font-normal text-slate-500">{getDayOfWeek(avail.date)}</span></td>
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-indigo-600">{avail.startTime}</td>
                          {selectedProfessional === 'all' && (
                            <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 font-semibold">{avail.professionalName}</td>
                          )}
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-xs text-emerald-600 font-bold">{appt.studentName || 'Desconhecido'}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600">{avail.location || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            
            {filteredAppointments.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum agendamento encontrado.
              </div>
            )}
          </div>
        )}`;

content = content.replace(renderTarget, renderReplacement);
fs.writeFileSync('src/components/PrintAppointmentsModal.tsx', content);
console.log("Patched PrintAppointmentsModal.tsx!");
