const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

// First, let's remove the badly placed handleVerifyCertificate
const badPlacement = `    const handleVerifyCertificate = (code: string) => {
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

  if (validationResult) {`;

file = file.replace(badPlacement, `  if (validationResult) {`);

// Now let's place it correctly. Where should we put it? Before return!
const correctPlacementStr = `  if (validationResult) {
    return (
      <div className="w-full flex-col justify-center max-w-lg mx-auto py-4 sm:py-8">
        <VerificationResult`;

const replacementStr = `  const handleVerifyCertificate = (code: string) => {
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

  if (validationResult) {
    return (
      <div className="w-full flex-col justify-center max-w-lg mx-auto py-4 sm:py-8">
        <VerificationResult`;

file = file.replace(correctPlacementStr, replacementStr);

fs.writeFileSync('src/components/Verifier.tsx', file);
