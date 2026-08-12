const fs = require('fs');
let c = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const searchStr = `  const handleBiometricAuth = async () => {
    try {
      setError(null);
      const credId = localStorage.getItem("student_biometric_credential_id");
      if (credId) {
        await verifyBiometric(credId);
        setIsGenerating(true);`;

const replaceStr = `  const handleBiometricAuth = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      const credId = localStorage.getItem("student_biometric_credential_id");
      if (credId) {
        await verifyBiometric(credId);
        playSound('generating');`;

const searchStr2 = `      } else {
        if (!member) return;
        const newCredId = await registerBiometric(member.email || "aluno@fajopa", member.name);
        localStorage.setItem("student_biometric_credential_id", newCredId);
        setIsGenerating(true);
        playSound('generating');`;

const replaceStr2 = `      } else {
        if (!member) {
          setIsGenerating(false);
          return;
        }
        const newCredId = await registerBiometric(member.email || "aluno@fajopa", member.name);
        localStorage.setItem("student_biometric_credential_id", newCredId);
        playSound('generating');`;

c = c.replace(searchStr, replaceStr);
c = c.replace(searchStr2, replaceStr2);

fs.writeFileSync('src/components/StudentPortal.tsx', c);
