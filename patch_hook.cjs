const fs = require('fs');
let content = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const hookOld = `  const { showAlert, showConfirm } = useDialog();`;
const hookNew = `  const { showAlert, showConfirm } = useDialog();
  const { isSupported, subscription, subscribe } = usePushNotifications();`;
content = content.replace(hookOld, hookNew);

fs.writeFileSync('src/components/StudentPortal.tsx', content);
console.log("Patched hook");
