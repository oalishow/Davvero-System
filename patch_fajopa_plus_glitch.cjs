const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  /<span className="text-white drop-shadow-\[0_0_8px_rgba\(255,255,255,0\.3\)\]">FAJOPA<\/span>/g,
  '<span className="text-white drop-shadow-md glitch-text-hover-only">FAJOPA</span>'
);

file = file.replace(
  /<span className="text-sky-500 drop-shadow-\[0_0_8px_rgba\(56,189,248,0\.5\)\]">PLUS<\/span>/g,
  '<span className="text-[#3b82f6] drop-shadow-md">PLUS</span>'
);

fs.writeFileSync('src/App.tsx', file);
