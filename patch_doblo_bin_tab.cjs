const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

content = content.replace(
    'const [activeTab, setActiveTab] = useState<"members" | "doblo">("members");',
    'const [activeTab, setActiveTab] = useState<"members" | "doblo">("doblo");'
);

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);
console.log("Patched Doblo bin tab");
