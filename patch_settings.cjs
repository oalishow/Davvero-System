const fs = require('fs');
let file = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');

file = file.replace(
  /appointmentType\?: "whatsapp" \| "google_calendar" \| "other" \}\[\];/g,
  'appointmentType?: "whatsapp" | "google_calendar" | "other", whatsappNumber?: string }[];'
);

fs.writeFileSync('src/context/SettingsContext.tsx', file);
