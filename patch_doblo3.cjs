const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

if (!content.includes('EditDobloModal')) {
    content = content.replace(
        `import { Car, Trash2, Calendar, Search } from "lucide-react";`,
        `import { Car, Trash2, Calendar, Search, Edit2 } from "lucide-react";\nimport EditDobloModal from "./EditDobloModal";`
    );
    
    content = content.replace(
        `interface DobloLog {`,
        `interface DobloLog {\n  deletedAt?: string;`
    );
    
    content = content.replace(
        `const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");`,
        `const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");
  const [editingLog, setEditingLog] = useState<DobloLog | null>(null);`
    );
    
    // soft delete
    content = content.replace(
        `await deleteDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id));`,
        `await updateDoc(doc(db, \`artifacts/\${appId}/public/data/doblo_logs\`, id), { deletedAt: new Date().toISOString() });`
    );
    
    content = content.replace(
        `import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";`,
        `import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from "firebase/firestore";`
    );
    
    content = content.replace(
        `const filteredLogs = logs.filter(log => {`,
        `const filteredLogs = logs.filter(log => {
    if (log.deletedAt) return false;`
    );
    
    // Add edit button
    content = content.replace(
        `<button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>`,
        `<button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-600 p-1 mr-2">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>`
    );
    
    // Add modal at the end
    content = content.replace(
        `      </div>
    </div>
  );
}`,
        `      </div>
      {editingLog && (
         <EditDobloModal 
           log={editingLog} 
           onClose={() => setEditingLog(null)} 
           onSuccess={() => showAlert("Registro atualizado com sucesso!", { type: "success" })}
         />
      )}
    </div>
  );
}`
    );
    
    fs.writeFileSync('src/components/DobloControl.tsx', content);
    console.log("Patched DobloControl with edit and soft delete");
}
