const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetGroupLogic = `  // Group by date
  const groupedByDate: Record<string, Availability[]> = {};
  filteredAvailabilities.forEach(a => {
    if (!groupedByDate[a.date]) groupedByDate[a.date] = [];
    groupedByDate[a.date].push(a);
  });
  
  // Sort dates
  const sortedDates = Object.keys(groupedByDate).sort((a,b) => a.localeCompare(b));`;

const replacementGroupLogic = `  // Group by seminary then date
  const groupedBySeminary: Record<string, Record<string, Availability[]>> = {};
  filteredAvailabilities.forEach(a => {
    const sem = a.seminary || "Outros / Sem Seminário";
    if (!groupedBySeminary[sem]) groupedBySeminary[sem] = {};
    if (!groupedBySeminary[sem][a.date]) groupedBySeminary[sem][a.date] = [];
    groupedBySeminary[sem][a.date].push(a);
  });
  
  const sortedSeminaries = Object.keys(groupedBySeminary).sort((a,b) => a.localeCompare(b));
`;

content = content.replace(targetGroupLogic, replacementGroupLogic);

const targetRender = `        {sortedDates.length === 0 ? (
           <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium text-sm">
             Nenhum horário cadastrado para este mês.
           </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(dateKey => {
              const dateAvails = groupedByDate[dateKey].sort((a,b) => a.startTime.localeCompare(b.startTime));
              const parts = dateKey.split('-');
              const formattedDate = \`\${parts[2]}/\${parts[1]}\`;`;

const replacementRender = `        {sortedSeminaries.length === 0 ? (
           <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium text-sm">
             Nenhum horário cadastrado para este mês.
           </div>
        ) : (
          <div className="space-y-10">
            {sortedSeminaries.map(semKey => {
               const groupedByDate = groupedBySeminary[semKey];
               const sortedDates = Object.keys(groupedByDate).sort((a,b) => a.localeCompare(b));
               
               return (
                 <div key={semKey} className="space-y-4">
                   <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">{semKey}</h3>
                   <div className="space-y-6">
                   {sortedDates.map(dateKey => {
                     const dateAvails = groupedByDate[dateKey].sort((a,b) => a.startTime.localeCompare(b.startTime));
                     const parts = dateKey.split('-');
                     const formattedDate = \`\${parts[2]}/\${parts[1]}\`;`;

content = content.replace(targetRender, replacementRender);

const targetRenderEnd = `                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}`;

const replacementRenderEnd = `                    </div>
                  </div>
                </div>
              );
            })}
                   </div>
                 </div>
               );
            })}
          </div>
        )}`;

content = content.replace(targetRenderEnd, replacementRenderEnd);

fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched render loop");
