const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('import { auth } from "../lib/firebase";')) {
    content = content.replace(
        `import { db, appId, handleFirestoreError, OperationType } from "../lib/firebase";`,
        `import { db, appId, handleFirestoreError, OperationType, auth } from "../lib/firebase";`
    );
}

if (!content.includes('import { onAuthStateChanged } from "firebase/auth";')) {
    content = content.replace(
        `import { getDoc, getDocs, limit, where } from "firebase/firestore";`,
        `import { getDoc, getDocs, limit, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";`
    );
}

content = content.replace(
    `const [isAdmin, setIsAdmin] = useState(initialIsAdmin);`,
    `const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAdmin(true);
      }
    });
    return () => unsub();
  }, []);`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched DobloControl admin auth check");
