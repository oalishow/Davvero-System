const fs = require('fs');
let file = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');

file = file.replace(
  /professionals\?: \{ id: string, name: string, role: string, photoUrl: string \| null, appointmentLink\?: string \}\[\];/g,
  'professionals?: { id: string, name: string, role: string, photoUrl: string | null, appointmentLink?: string, appointmentType?: "whatsapp" | "google_calendar" | "other" }[];'
);

fs.writeFileSync('src/context/SettingsContext.tsx', file);
