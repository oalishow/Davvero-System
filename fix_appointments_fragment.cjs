const fs = require('fs');
let file = fs.readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8');

file = file.replace(
  /          \) : \(\n          <div className="flex flex-col sm:flex-row/,
  `          ) : (
          <>
          <div className="flex flex-col sm:flex-row`
);

file = file.replace(
  /        <\/div>\n        \)\}\n        <\/>/,
  `        </div>
          </>
        )}
        </>`
);

fs.writeFileSync('src/components/PublicAppointmentsList.tsx', file);
