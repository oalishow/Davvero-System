const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `import { Car, Trash2, Calendar, Search, Edit2, Fingerprint, FileDown, CheckCircle2 } from "lucide-react";`,
    `import { Car, Trash2, Calendar, Search, Edit2, Fingerprint, FileDown, CheckCircle2, KeyRound, X } from "lucide-react";`
);

content = content.replace(
    `const [editingLog, setEditingLog] = useState<DobloLog | null>(null);
  const [biometricSignature, setBiometricSignature] = useState(false);`,
    `const [editingLog, setEditingLog] = useState<DobloLog | null>(null);
  const [biometricSignature, setBiometricSignature] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");`
);

const pinFunc = `
  const handlePinSubmit = () => {
    const savedPin = localStorage.getItem("student_fallback_pin");
    if (!savedPin) {
      setPinError("Você não tem um PIN cadastrado no perfil.");
      return;
    }
    if (pinInput === savedPin) {
      setBiometricSignature(true);
      setShowPinModal(false);
      setPinInput("");
      setPinError("");
      showAlert("Assinatura com PIN confirmada!", { type: "success" });
    } else {
      setPinError("PIN Incorreto");
    }
  };
`;

content = content.replace(
    `const handleBiometry = async`,
    pinFunc + `\n  const handleBiometry = async`
);

content = content.replace(
    `<button type="button" onClick={handleBiometry} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                       <Fingerprint className="w-4 h-4" /> Assinar (Biometria)
                    </button>`,
    `<div className="flex gap-2">
                       <button type="button" onClick={handleBiometry} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                          <Fingerprint className="w-4 h-4" /> Biometria
                       </button>
                       <button type="button" onClick={() => { setShowPinModal(true); setPinInput(""); setPinError(""); }} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors">
                          <KeyRound className="w-4 h-4" /> PIN
                       </button>
                    </div>`
);

const modalStr = `
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-500" />
                Assinar com PIN
              </h3>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="****"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center text-3xl tracking-[1em] font-black bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-4 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all dark:text-white"
              />
              {pinError && <p className="text-rose-500 text-xs font-bold text-center">{pinError}</p>}
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(
    `    </div>
  );
}`,
    modalStr + `    </div>\n  );\n}`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched DobloControl with PIN");
