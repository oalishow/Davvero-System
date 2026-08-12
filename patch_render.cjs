const fs = require('fs');
let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const search = `            {activeTab === "appointments" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <AppointmentsPanel member={member} />
              </motion.div>
            )}`;

file = file.replace(search, '');
fs.writeFileSync('src/components/StudentPortal.tsx', file);
