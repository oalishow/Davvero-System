const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    /Object\.entries\(\s*filteredLogs\.reduce\(/,
    '(Object.entries(\n              filteredLogs.reduce('
);

content = content.replace(
    /\} as Record<string, DobloLog\[\]>\)\s*\)\.map\(\(\[seminaryName, groupLogs\]\) => \(/,
    `} as Record<string, DobloLog[]>)\n            ) as [string, DobloLog[]][]).map(([seminaryName, groupLogs]) => (`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched grouping types");
