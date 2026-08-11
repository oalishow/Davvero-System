const fs = require('fs');
let file = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');

file = file.replace(
  /\{ id: "prof_altair", name: "Padre Altair", role: "REITOR", photoUrl: null, appointmentLink: "[^"]*" \},/,
  '{ id: "prof_altair", name: "Padre Altair", role: "REITOR", photoUrl: null, appointmentLink: "" },'
);
file = file.replace(
  /\{ id: "prof_anderson", name: "Padre Anderson", role: "VICE-REITOR", photoUrl: null \},/,
  '{ id: "prof_anderson", name: "Padre Anderson", role: "VICE-REITOR", photoUrl: null, appointmentLink: "https://calendar.app.google/shVAPdZTNeDs2PaGA" },'
);

fs.writeFileSync('src/context/SettingsContext.tsx', file);
