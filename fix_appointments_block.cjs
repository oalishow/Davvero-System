const fs = require('fs');
let file = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

// I will just replace the exact problematic end.
// Currently it is:
//           })}
//                 </div>
//           </>
//         )}
//         </>
//       )}

file = file.replace(
  /          \}\)\}\n                <\/div>\n          <\/>\n        \)\}\n        <\/>\n      \)\}/,
  `          })}
                </div>
      )}
          </>
        )}
        </>
      )}`
);

fs.writeFileSync('src/components/PublicAppointmentsList.tsx', file);
