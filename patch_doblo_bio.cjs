const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('biometricSignature')) {
    content = content.replace(
        `import { Car, Trash2, Calendar, Search, Edit2 } from "lucide-react";`,
        `import { Car, Trash2, Calendar, Search, Edit2, Fingerprint, FileDown, CheckCircle2 } from "lucide-react";\nimport jsPDF from "jspdf";\nimport autoTable from "jspdf-autotable";`
    );

    content = content.replace(
        `authorId?: string;`,
        `authorId?: string;\n  biometricSignature?: boolean;`
    );
    
    content = content.replace(
        `const [editingLog, setEditingLog] = useState<DobloLog | null>(null);`,
        `const [editingLog, setEditingLog] = useState<DobloLog | null>(null);
  const [biometricSignature, setBiometricSignature] = useState(false);`
    );
    
    // In handleSubmit
    content = content.replace(
        `authorId: currentUser?.id || "public"`,
        `authorId: currentUser?.id || "public",
        biometricSignature`
    );
    
    content = content.replace(
        `setDestination("");`,
        `setDestination("");
      setBiometricSignature(false);`
    );
    
    // Add handleBiometry and handleExportPDF right before `return (`
    const biometryFunc = `
  const handleBiometry = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);
        
        await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "Controle Doblô" },
            user: {
              id: userId,
              name: currentUser?.name || name || "Usuário",
              displayName: currentUser?.name || name || "Usuário"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required"
            },
            timeout: 60000
          }
        });
        setBiometricSignature(true);
        showAlert("Assinatura digital confirmada!", { type: "success" });
      } catch (err) {
        console.error(err);
        showAlert("Não foi possível confirmar a biometria/senha da tela.", { type: "error" });
      }
    } else {
      showAlert("Seu dispositivo não suporta biometria.", { type: "warning" });
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(\`Relatório de Uso da Doblô - \${viewMode === 'monthly' ? selectedMonth : selectedWeek}\`, 14, 15);
    
    autoTable(doc, {
      startY: 25,
      head: [['Data', 'Condutor', 'Destino', 'Saída', 'Chegada', 'Km Total', 'Assinado']],
      body: filteredLogs.map(log => {
        const [y, m, d] = log.date.split("-");
        const dateStr = \`\${d}/\${m}\`;
        const kmDiff = log.arrivalKm ? (log.arrivalKm - log.departureKm).toFixed(1) : "-";
        return [
          dateStr,
          log.name,
          log.destination || "-",
          \`\${log.departureTime} (\${log.departureKm} km)\`,
          log.arrivalTime ? \`\${log.arrivalTime} (\${log.arrivalKm} km)\` : "-",
          kmDiff !== "-" ? \`\${kmDiff} km\` : "-",
          log.biometricSignature ? "Sim" : "Não"
        ];
      }),
    });
    
    doc.save('doblo_relatorio.pdf');
  };
`;
    content = content.replace(
        `return (
    <div className="space-y-6">`,
        biometryFunc + `\n  return (\n    <div className="space-y-6">`
    );

    // Update the button row in the form
    content = content.replace(
        `<div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">
                Salvar Registro
              </button>
            </div>`,
        `<div className="sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
              <div className="flex flex-col">
                 {!currentUser && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mb-2">Não está logado? Você pode colocar o seu nome ou logar na página inicial.</p>
                 )}
                 {biometricSignature ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">
                       <CheckCircle2 className="w-4 h-4" /> Assinado Digitalmente
                    </div>
                 ) : (
                    <button type="button" onClick={handleBiometry} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                       <Fingerprint className="w-4 h-4" /> Assinar (Biometria)
                    </button>
                 )}
              </div>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto transform hover:-translate-y-0.5">
                Salvar Registro
              </button>
            </div>`
    );
    
    // Add PDF export button next to table header
    content = content.replace(
        `<div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">`,
        `{isAdmin && (
            <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">`
    );
    
    fs.writeFileSync('src/components/DobloControl.tsx', content);
    console.log("Patched DobloControl with bio and PDF");
}
