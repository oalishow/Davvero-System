const fs = require('fs');

// Patch SchedulingManager.tsx
let file = fs.readFileSync('src/components/SchedulingManager.tsx', 'utf8');

const importStatement = `import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";`;
if (!file.includes('DEFAULT_PROFESSIONALS')) {
  file = file.replace(/import \{ useDialog \} from "\.\.\/context\/DialogContext";/, `import { useDialog } from "../context/DialogContext";\n${importStatement}`);
}

file = file.replace(
  /const \[localProfs, setLocalProfs\] = useState\(settings\.professionals \|\| \[\]\);/,
  `const [localProfs, setLocalProfs] = useState(
    settings.professionals && settings.professionals.length > 0 
      ? settings.professionals 
      : DEFAULT_PROFESSIONALS.map(p => ({
          id: p.id,
          name: p.name,
          role: p.roles?.[0] || "PROFISSIONAL",
          photoUrl: null,
          appointmentLink: p.id === 'prof_anderson' ? 'https://calendar.app.google/shVAPdZTNeDs2PaGA' : (p.id === 'prof_altair' ? 'https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP' : ''),
          appointmentType: p.id === 'prof_anderson' ? 'google_calendar' : (p.id === 'prof_altair' ? 'whatsapp' : 'other'),
          whatsappNumber: ""
        }))
  );`
);
fs.writeFileSync('src/components/SchedulingManager.tsx', file);

// Patch SettingsModal.tsx
let file2 = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');
const importStmt2 = `import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";`;
if (!file2.includes('DEFAULT_PROFESSIONALS')) {
  file2 = file2.replace(/import \{ db, appId \} from "\.\.\/lib\/firebase";/, `import { db, appId } from "../lib/firebase";\n${importStmt2}`);
}

file2 = file2.replace(
  /const \[professionals, setProfessionals\] = useState<.*?>\(\n\s*cloudSettings\.professionals \|\| \[\],\n\s*\);/,
  `const [professionals, setProfessionals] = useState<{ id: string, name: string, role: string, photoUrl: string | null, appointmentLink?: string, appointmentType?: string, whatsappNumber?: string }[]>(
    cloudSettings.professionals && cloudSettings.professionals.length > 0 
      ? cloudSettings.professionals 
      : DEFAULT_PROFESSIONALS.map(p => ({
          id: p.id,
          name: p.name,
          role: p.roles?.[0] || "PROFISSIONAL",
          photoUrl: null,
          appointmentLink: p.id === 'prof_anderson' ? 'https://calendar.app.google/shVAPdZTNeDs2PaGA' : (p.id === 'prof_altair' ? 'https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP' : ''),
          appointmentType: p.id === 'prof_anderson' ? 'google_calendar' : (p.id === 'prof_altair' ? 'whatsapp' : 'other'),
          whatsappNumber: ""
        }))
  );`
);

fs.writeFileSync('src/components/SettingsModal.tsx', file2);
