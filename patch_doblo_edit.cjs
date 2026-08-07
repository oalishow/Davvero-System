const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `{isAdmin && <th className="px-4 py-3 rounded-r-xl"></th>}`,
    `{(isAdmin || currentUser) && <th className="px-4 py-3 rounded-r-xl">Ações</th>}`
);

const newBodyStr = `
                  const isAuthor = currentUser && log.authorId === currentUser.id;
                  const logDate = new Date(log.date + 'T00:00:00');
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const diffTime = today.getTime() - logDate.getTime();
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  const canEdit = isAdmin || (isAuthor && diffDays <= 1);
                  
                  return (
`;

content = content.replace(
    `                  return (`,
    newBodyStr
);

const actionsCol = `
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
`;

content = content.replace(
    `                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-600 p-1 mr-2">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}`,
    actionsCol
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
