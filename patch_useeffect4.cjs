const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

content = content.replace(/  \}, \[allStudents, appointments, professionals\]\);\n\n\n    return \(\) => \{\n      unsubAvail\(\);\n      unsubAppt\(\);\n    \};\n  \}, \[\]\);/g, '  }, [allStudents, appointments, professionals]);');

fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched useEffects!");
