const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

content = content.replace(
"               })\n             )\n        </div>\n      </div>",
"               })\n             )\n          )}\n        </div>\n      </div>"
);

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
