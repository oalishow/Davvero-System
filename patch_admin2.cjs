const fs = require('fs');
let c = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

c = c.replace(/\{showPrintAppointments && \(\s*\)\}/g, '');

fs.writeFileSync('src/components/AdminPanel.tsx', c);
