const fs = require('fs');
let c = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

c = c.replace(/<button[^>]*onClick=\{\(\) => setShowPrintAppointments\(true\)\}[^>]*>[\s\S]*?<\/button>/, '');
c = c.replace(/import PrintAppointmentsModal from "\.\/PrintAppointmentsModal";\n?/, '');
c = c.replace(/<PrintAppointmentsModal onClose=\{\(\) => setShowPrintAppointments\(false\)\} \/>\n?/, '');
c = c.replace(/const \[showPrintAppointments, setShowPrintAppointments\] = useState\(false\);\n?/, '');

fs.writeFileSync('src/components/AdminPanel.tsx', c);
