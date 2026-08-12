const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const search = `  useEffect(() => {
    if (cacheLoaded && externalCode) {
      runVerification(externalCode, false);
      if (onExternalVerified) onExternalVerified();
    }
  }, [cacheLoaded, externalCode]);`;

const replace = `  useEffect(() => {
    if (cacheLoaded && externalCode) {
      if (externalCode.includes('-')) {
         handleVerifyCertificate(externalCode);
      } else {
         runVerification(externalCode, false);
      }
      if (onExternalVerified) onExternalVerified();
    }
  }, [cacheLoaded, externalCode]);`;

file = file.replace(search, replace);
fs.writeFileSync('src/components/Verifier.tsx', file);
