const fs = require('fs');
let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

file = file.replace(
  'import { getStorage } from "firebase/storage";',
  `import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";`
);

file = file.replace(
  'export const storage = getStorage(app);',
  `export const storage = getStorage(app);
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;`
);

fs.writeFileSync('src/lib/firebase.ts', file);
