const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const search = `    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("event")) {
        return "events";
      }
    }`;

const replace = `    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("event")) {
        return "events";
      }
      if (params.has("cert")) {
        return "verifier"; // We will set targetVerifyCode in an effect
      }
    }`;

file = file.replace(search, replace);

const search2 = `  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(null);`;
const replace2 = `  const [targetVerifyCode, setTargetVerifyCode] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("cert")) {
        return params.get("cert");
      }
    }
    return null;
  });`;

file = file.replace(search2, replace2);

fs.writeFileSync('src/App.tsx', file);
