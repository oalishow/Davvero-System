const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `    if (!currentUser) {
      showAlert("Você precisa estar logado (ter uma identidade vinculada) para registrar o uso da Doblô.", { type: "warning" });
      return;
    }`,
    ``
);

content = content.replace(
    `authorId: currentUser.id`,
    `authorId: currentUser?.id || "public"`
);

content = content.replace(
    `      {currentUser && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">`,
    `      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">`
);

content = content.replace(
    `          </form>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">`,
    `          </form>
        </div>
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Doblo Control Form updated");
