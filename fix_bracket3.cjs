const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

// Find the line that starts with `             )` after handleRestoreDoblo
const parts = content.split('handleRestoreDoblo(log.id)');
if (parts.length > 1) {
    const after = parts[1];
    // Find the end of that map loop
    const newAfter = after.replace(/\}[\s\S]*/, `} className="w-full sm:w-auto flex-shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-all dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500 hover:text-emerald-800 dark:hover:text-white">
                       Restaurar
                     </button>
                   </div>
                 );
               })
             )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
`);
    content = parts[0] + 'handleRestoreDoblo(log.id)' + newAfter;
}

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
