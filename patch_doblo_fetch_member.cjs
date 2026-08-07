const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('davveroId_student_identity')) {
    content = content.replace(
        `import { Member, AVAILABLE_SEMINARIES } from "../types";`,
        `import { Member, AVAILABLE_SEMINARIES } from "../types";
import { getDoc, getDocs, limit, where } from "firebase/firestore";`
    );

    content = content.replace(
        `export default function DobloControl({ currentUser, isAdmin }: { currentUser: Member | null; isAdmin: boolean }) {`,
        `export default function DobloControl({ currentUser: initialCurrentUser, isAdmin: initialIsAdmin }: { currentUser: Member | null; isAdmin: boolean }) {
  const [currentUser, setCurrentUser] = useState<Member | null>(initialCurrentUser);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  useEffect(() => {
    if (initialCurrentUser) {
      setCurrentUser(initialCurrentUser);
      setIsAdmin(initialIsAdmin || initialCurrentUser.roles?.includes("ADMIN") || false);
    } else {
      const loadBonded = async () => {
        const bondedId = localStorage.getItem("davveroId_student_identity");
        if (bondedId) {
          try {
            let found = null;
            try {
              const docSnap = await getDoc(doc(db, \`artifacts/\${appId}/public/data/students\`, bondedId));
              if (docSnap.exists()) found = { id: docSnap.id, ...docSnap.data() } as Member;
            } catch (e) {}
            if (!found) {
              const q = query(collection(db, \`artifacts/\${appId}/public/data/students\`), where("alphaCode", "==", bondedId), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) {
                found = { id: snap.docs[0].id, ...snap.docs[0].data() } as Member;
              }
            }
            if (found) {
              setCurrentUser(found);
              setIsAdmin(initialIsAdmin || found.roles?.includes("ADMIN") || false);
            }
          } catch (err) {}
        }
      };
      loadBonded();
    }
  }, [initialCurrentUser, initialIsAdmin]);`
    );

    fs.writeFileSync('src/components/DobloControl.tsx', content);
    console.log("Patched member fetching in DobloControl");
}
