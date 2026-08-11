const fs = require('fs');
let file = fs.readFileSync('src/context/SettingsContext.tsx', 'utf8');

file = file.replace(
  /professionals: \[\n\s*\{ id: "prof_altair", name: "Padre Altair", role: "REITOR", photoUrl: null, appointmentLink: "" \},\n\s*\{ id: "prof_anderson", name: "Padre Anderson", role: "VICE-REITOR", photoUrl: null, appointmentLink: "https:\/\/calendar\.app\.google\/shVAPdZTNeDs2PaGA" \},\n\s*\{ id: "prof_braz", name: "Padre Bráz", role: "DIRETOR ESPIRITUAL", photoUrl: null \},\n\s*\{ id: "prof_alessandra", name: "Dra\. Alessandra", role: "PSICÓLOGA", photoUrl: null \}\n\s*\],/,
  `professionals: [
    { id: "prof_altair", name: "Padre Altair", role: "REITOR", photoUrl: null, appointmentLink: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP", appointmentType: "whatsapp", whatsappNumber: "" },
    { id: "prof_anderson", name: "Padre Anderson", role: "VICE-REITOR", photoUrl: null, appointmentLink: "https://calendar.app.google/shVAPdZTNeDs2PaGA", appointmentType: "google_calendar", whatsappNumber: "" },
    { id: "prof_braz", name: "Padre Bráz", role: "DIRETOR ESPIRITUAL", photoUrl: null, appointmentLink: "", appointmentType: "whatsapp", whatsappNumber: "" },
    { id: "prof_alessandra", name: "Dra. Alessandra", role: "PSICÓLOGA", photoUrl: null, appointmentLink: "", appointmentType: "whatsapp", whatsappNumber: "" }
  ],`
);

fs.writeFileSync('src/context/SettingsContext.tsx', file);
