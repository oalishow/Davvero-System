const fs = require('fs');
let file = fs.readFileSync('src/types.ts', 'utf8');

file = file.replace(
  /appointmentLink\?: string;/,
  'appointmentLink?: string;\n  appointmentType?: "whatsapp" | "google_calendar" | "other";'
);

fs.writeFileSync('src/types.ts', file);
