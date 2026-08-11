const fs = require('fs');
let file = fs.readFileSync('src/types.ts', 'utf8');

file = file.replace(
  /appointmentType\?: "whatsapp" \| "google_calendar" \| "other";/,
  'appointmentType?: "whatsapp" | "google_calendar" | "other";\n  whatsappNumber?: string;'
);

fs.writeFileSync('src/types.ts', file);
