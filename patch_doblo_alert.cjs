const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: new Date().toISOString() });`,
    `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: new Date().toISOString() });
        showAlert("Registro movido para a lixeira.", { type: "info" });`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
