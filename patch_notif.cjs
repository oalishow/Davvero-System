const fs = require('fs');
let file = fs.readFileSync('src/components/NotificationsManager.tsx', 'utf8');

file = file.replace(
  '      let targetSubscriptions: any[] = [];',
  '      let targetTokens: string[] = [];'
);
file = file.replace(
  '      const subPath = "push_subscriptions";',
  '      const subPath = "fcm_tokens";'
);
file = file.replace(
  '          targetSubscriptions = subsSnapshot.docs.map(doc => doc.data());',
  '          targetTokens = subsSnapshot.docs.map(doc => doc.data().token).filter(Boolean);'
);
file = file.replace(
  '          targetSubscriptions = subsSnapshot.docs',
  '          targetTokens = subsSnapshot.docs'
);
file = file.replace(
  '            .map(doc => doc.data())',
  '            .map(doc => doc.data())'
);
file = file.replace(
  '            .filter(sub => targetMemberIds.includes(sub.userId) || audienceMode === "todos");',
  '            .filter(sub => targetMemberIds.includes(sub.userId) || audienceMode === "todos").map(sub => sub.token).filter(Boolean);'
);
file = file.replace(
  '      if (targetSubscriptions.length > 0) {',
  '      if (targetTokens.length > 0) {'
);
file = file.replace(
  '            body: JSON.stringify({ title, message, url: "/", subscriptions: targetSubscriptions }),',
  '            body: JSON.stringify({ title, message, url: "/", tokens: targetTokens }),'
);
fs.writeFileSync('src/components/NotificationsManager.tsx', file);
