const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const search = `  useEffect(() => {
    const handleVerifyCertificate = (code: string) => {
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
      if (validationResult.status === "VALID" || validationResult.status === "JUST_CHECKED_IN") {
        playSound('success');
      } else {
        playSound('error');
      }
    }
  }, [validationResult]);`;

const replace = `  useEffect(() => {
    if (validationResult) {
      if (validationResult.status === "VALID" || validationResult.status === "JUST_CHECKED_IN" || validationResult.status === "VALID_CERTIFICATE") {
        playSound('success');
      } else {
        playSound('error');
      }
    }
  }, [validationResult]);`;

file = file.replace(search, replace);

// Let's remove the wrongly placed one near `if (validationResult) { return (`
const search2 = `  const handleVerifyCertificate = (code: string) => {
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

const replace2 = `  const handleVerifyCertificate = (code: string) => {
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

if (!file.includes(search2)) {
    // If it's not there, let's just insert it before `if (validationResult) {`
    const insertSearch = `  if (validationResult) {
    return (
      <div className="w-full flex-col justify-center max-w-lg mx-auto py-4 sm:py-8">
        <VerificationResult`;
        
    file = file.replace(insertSearch, replace2);
} else {
    file = file.replace(search2, replace2);
}

fs.writeFileSync('src/components/Verifier.tsx', file);
