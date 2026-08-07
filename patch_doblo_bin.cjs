const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('import RecycleBinModal')) {
    content = content.replace(
        `import EditDobloModal from "./EditDobloModal";`,
        `import EditDobloModal from "./EditDobloModal";
import RecycleBinModal from "./RecycleBinModal";`
    );
}

if (!content.includes('const [showRecycleBin, setShowRecycleBin] = useState(false);')) {
    content = content.replace(
        `const [showPinModal, setShowPinModal] = useState(false);`,
        `const [showPinModal, setShowPinModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);`
    );
}

if (!content.includes('<Trash2 className="w-4 h-4" /> Lixeira')) {
    content = content.replace(
        `{isAdmin && (
            <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}`,
        `{isAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowRecycleBin(true)} className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                <Trash2 className="w-4 h-4" /> Lixeira
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                <FileDown className="w-4 h-4" /> PDF
              </button>
            </div>
          )}`
    );
}

if (!content.includes('<RecycleBinModal onClose={() => setShowRecycleBin(false)} />')) {
    content = content.replace(
        `{showPinModal && (`,
        `{showRecycleBin && <RecycleBinModal onClose={() => setShowRecycleBin(false)} />}
      {showPinModal && (`
    );
}

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched RecycleBin button");
