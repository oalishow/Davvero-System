const fs = require('fs');
let content = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

// Add import
const importLucideOld = `  Library
} from "lucide-react";`;
const importLucideNew = `  Library,
  Bell,
  BellRing
} from "lucide-react";
import { usePushNotifications } from "../hooks/usePushNotifications";`;
content = content.replace(importLucideOld, importLucideNew);

// Add hook
const hookOld = `  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const portalContainerRef = useRef<HTMLDivElement>(null);`;
const hookNew = `  const [modalUnlinkOpen, setModalUnlinkOpen] = useState(false);
  const portalContainerRef = useRef<HTMLDivElement>(null);
  const { isSupported, subscription, subscribe } = usePushNotifications();`;
content = content.replace(hookOld, hookNew);

// Add button
const buttonsOld = `              {!isOverrideMode && (
                <>
                  <button
                    onClick={() => {`;
const buttonsNew = `              {!isOverrideMode && (
                <>
                  {isSupported && !subscription && (
                    <button
                      onClick={() => {
                        playSound('click');
                        subscribe();
                      }}
                      className="p-2 text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 transition-colors animate-pulse relative"
                      title="Ativar Notificações"
                    >
                      <Bell className="w-5 h-5" />
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                    </button>
                  )}
                  {isSupported && subscription && (
                    <button
                      className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors cursor-default"
                      title="Notificações Ativas"
                    >
                      <BellRing className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {`;
content = content.replace(buttonsOld, buttonsNew);

fs.writeFileSync('src/components/StudentPortal.tsx', content);
console.log("Patched StudentPortal");
