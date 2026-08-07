const fs = require('fs');
let content = fs.readFileSync('src/components/RecycleBinModal.tsx', 'utf8');

content = content.replace(
    'export default function RecycleBinModal({ onClose }: { onClose: () => void }) {',
    'export default function RecycleBinModal({ onClose, initialTab = "members" }: { onClose: () => void, initialTab?: "members" | "doblo" }) {'
);

content = content.replace(
    'const [activeTab, setActiveTab] = useState<"members" | "doblo">("doblo");',
    'const [activeTab, setActiveTab] = useState<"members" | "doblo">(initialTab);'
);

fs.writeFileSync('src/components/RecycleBinModal.tsx', content);

let dobloContent = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');
dobloContent = dobloContent.replace(
    '<RecycleBinModal onClose={() => setShowRecycleBin(false)} />',
    '<RecycleBinModal onClose={() => setShowRecycleBin(false)} initialTab="doblo" />'
);
fs.writeFileSync('src/components/DobloControl.tsx', dobloContent);

console.log("Patched RecycleBinModal props");
