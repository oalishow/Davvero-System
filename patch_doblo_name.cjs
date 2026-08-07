const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('useEffect(() => {\\n    if (currentUser?.name)')) {
    content = content.replace(
        `const [name, setName] = useState(currentUser?.name || "");`,
        `const [name, setName] = useState(currentUser?.name || "");

  useEffect(() => {
    if (currentUser?.name) {
      setName(currentUser.name);
    }
  }, [currentUser?.name]);`
    );
    fs.writeFileSync('src/components/DobloControl.tsx', content);
    console.log("Patched name sync");
}
