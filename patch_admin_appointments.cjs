const fs = require('fs');
let file = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

file = file.replace(
  /import \{ BriefcaseMedical, Settings \} from "lucide-react";\nimport \{ useSettings \} from "\.\.\/context\/SettingsContext";/,
  'import { BriefcaseMedical, Settings } from "lucide-react";\nimport { useSettings } from "../context/SettingsContext";\nimport SchedulingManager from "./SchedulingManager";'
);

file = file.replace(
  /      <\/div>\n    <\/div>/,
  '      </div>\n      \n      <div className="mt-8 text-left">\n        <SchedulingManager />\n      </div>\n    </div>'
);

fs.writeFileSync('src/components/AdminAppointments.tsx', file);
