const fs = require('fs');
let c = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

c = c.replace(/<div className="border-t border-slate-200 dark:border-slate-700 pt-4">[\s\S]*?<\/div>\s*<\/div>/, '</div>');

fs.writeFileSync('src/components/AdminAppointments.tsx', c);
