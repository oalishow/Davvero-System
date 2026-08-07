const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

content = content.replace(
    `                 );
               })
             )`,
    `                 );
               })
             )
          )}`
);

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
