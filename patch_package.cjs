const fs = require('fs');
let pkg = fs.readFileSync('package.json', 'utf8');

pkg = pkg.replace('"version": "6.7.0"', '"version": "7.1.0"');

fs.writeFileSync('package.json', pkg);
console.log("Patched package.json");
