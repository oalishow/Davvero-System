const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

// Grouping logic before rendering
const renderTableStr = `          <div className="space-y-8">
            {Object.entries(
              filteredLogs.reduce((acc, log) => {
                const sem = log.seminary || "Outros / Sem Seminário";
                if (!acc[sem]) acc[sem] = [];
                acc[sem].push(log);
                return acc;
              }, {} as Record<string, DobloLog[]>)
            ).map(([seminaryName, groupLogs]) => (
              <div key={seminaryName} className="overflow-hidden">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 px-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Car className="w-4 h-4 text-emerald-500" />
                  {seminaryName}
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-xs">{groupLogs.length}</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Data</th>
                        <th className="px-4 py-3">Condutor / Destino</th>
                        <th className="px-4 py-3 text-center">Saída</th>
                        <th className="px-4 py-3 text-center">Chegada</th>
                        <th className="px-4 py-3 text-right">Km Total</th>
                        {(isAdmin || currentUser) && <th className="px-4 py-3 rounded-r-xl">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {groupLogs.map(log => {
                        const [y, m, d] = log.date.split("-");
                        const dateStr = \`\${d}/\${m}\`;
                        const kmDiff = log.arrivalKm ? (log.arrivalKm - log.departureKm).toFixed(1) : "-";
                        const isAuthor = currentUser && log.authorId === currentUser.id;
                        const logDate = new Date(log.date + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffTime = today.getTime() - logDate.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        const canEdit = isAdmin || (isAuthor && diffDays <= 1);
                        
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium">{dateStr}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{log.name}</div>
                              <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={log.destination}>{log.destination || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium text-emerald-600 dark:text-emerald-400">{log.departureTime}</div>
                              <div className="text-[10px] text-slate-500">{log.departureKm} km</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium text-slate-700 dark:text-slate-300">{log.arrivalTime || "-"}</div>
                              <div className="text-[10px] text-slate-500">{log.arrivalKm ? \`\${log.arrivalKm} km\` : "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-white">
                              {kmDiff !== "-" ? \`\${kmDiff} km\` : ""}
                            </td>
                            {(isAdmin || currentUser) && (
                              <td className="px-4 py-3 text-right">
                                {canEdit && (
                                  <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-600 p-1 mr-2" title="Editar">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {(isAdmin || (isAuthor && diffDays <= 1)) && (
                                  <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-600 p-1" title="Excluir">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>`;

content = content.replace(
    /<div className="overflow-x-auto">[\s\S]*?<\/table>\s*<\/div>/,
    renderTableStr
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched grouping");
