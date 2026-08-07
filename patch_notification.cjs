const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationObserver.tsx', 'utf8');

if (!content.includes('useDobloMonitor')) {
    content = content.replace(
        "import { useNotifications } from '../hooks/useNotifications';",
        "import { useNotifications } from '../hooks/useNotifications';\nimport { useDobloMonitor } from '../hooks/useDobloMonitor';"
    );
    
    content = content.replace(
        "const { notifications, unreadCount } = useNotifications(recipientId);",
        "const { notifications, unreadCount } = useNotifications(recipientId);\n  useDobloMonitor(recipientId);"
    );
}

fs.writeFileSync('src/components/NotificationObserver.tsx', content);
console.log("Patched NotificationObserver");
