const fs = require('fs');
let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');
file = file.replace('import AppointmentsPanel from "./AppointmentsPanel";\n', '');
fs.writeFileSync('src/components/StudentPortal.tsx', file);
