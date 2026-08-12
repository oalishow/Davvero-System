const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const lines = file.split('\n');

const newLines = `  const handleVerifyCertificate = (code: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      const parts = code.split('-');
      if (parts.length !== 2) {
         showAlert("Código de certificado inválido.", { type: "error" });
         setIsProcessing(false);
         return;
      }
      
      const eventPart = parts[0];
      const memberPart = parts[1];
      
      const evt = eventsCache.find(e => e.id.slice(0, 8).toUpperCase() === eventPart || e.id.slice(0, 6).toUpperCase() === eventPart);
      const mem = membersCache.find(m => {
          const mId = (m.id || "").slice(0, 8).toUpperCase();
          const mId6 = (m.id || "").slice(0, 6).toUpperCase();
          const ra = (m.ra || "").slice(0, 8).toUpperCase();
          const ra6 = (m.ra || "").slice(0, 6).toUpperCase();
          return mId === memberPart || mId6 === memberPart || ra === memberPart || ra6 === memberPart;
      });
      
      if (evt && (mem || memberPart === "DOC")) {
          // Success! Show validation result
          setValidationResult({
             member: mem || { name: "Participante Externo / Visitante", role: "VISITOR", id: "DOC", email: "" } as any,
             status: "VALID_CERTIFICATE" as any,
             event: evt
          });
      } else {
          setValidationResult({ member: null, status: "NOT_FOUND" });
      }
      setIsProcessing(false);
    }, 800);
  };

  useEffect(() => {
    if (validationResult) {
      if (validationResult.status === "VALID" || validationResult.status === "JUST_CHECKED_IN" || validationResult.status === "VALID_CERTIFICATE") {
        playSound('success');
      } else {
        playSound('error');
      }
    }
  }, [validationResult]);`.split('\n');

// Replaces lines 81 to 127 (inclusive, 0-indexed is 80 to 126)
// Oh wait! 82 was `  useEffect(() => {`, 83 was `    const handleVerifyCertificate = ...`.
// Let's find the exact line indices.
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("  useEffect(() => {") && lines[i+1] && lines[i+1].includes("    const handleVerifyCertificate = (code: string) => {")) {
        startIdx = i;
        for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].includes("  }, [validationResult]);")) {
                endIdx = j;
                break;
            }
        }
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
} else {
    console.log("Could not find the block to replace", startIdx, endIdx);
}

fs.writeFileSync('src/components/Verifier.tsx', lines.join('\n'));
