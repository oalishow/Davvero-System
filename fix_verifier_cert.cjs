const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const search = `                <input
                  type="text"
                  placeholder="Código do Certificado (ex: ABCD12-EFGH34)"
                  className="w-full p-4 rounded-xl text-sm font-mono text-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-sky-500"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter' && codeInput) {
                        handleGlobalVerify(codeInput);
                     }
                  }}
                />
                <button
                  onClick={() => handleGlobalVerify(codeInput)}
                  disabled={!codeInput || isProcessing}
                  className="w-full btn-modern px-6 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? "Verificando..." : "Validar Código"}
                </button>`;

const replace = `                <input
                  type="text"
                  placeholder="Código do Certificado (ex: ABCD12-EFGH34)"
                  className="w-full p-4 rounded-xl text-sm font-mono text-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-sky-500"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter' && codeInput) {
                        handleVerifyCertificate(codeInput);
                     }
                  }}
                />
                <button
                  onClick={() => handleVerifyCertificate(codeInput)}
                  disabled={!codeInput || isProcessing}
                  className="w-full btn-modern px-6 py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? "Verificando..." : "Validar Código"}
                </button>`;

file = file.replace(search, replace);

// Insert handleVerifyCertificate definition before return
const search2 = `  if (validationResult) {`;
const replace2 = `
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

  if (validationResult) {`;

file = file.replace(search2, replace2);
fs.writeFileSync('src/components/Verifier.tsx', file);
