const fs = require('fs');
let content = fs.readFileSync('src/hooks/useDobloMonitor.ts', 'utf8');

content = content.replace(
    'const pendingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));',
    'const pendingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));'
);

fs.writeFileSync('src/hooks/useDobloMonitor.ts', content);
console.log("Patched hook");
