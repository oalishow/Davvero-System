import { collection, query, getDocs } from "firebase/firestore";
import { db, appId } from "./firebase";

const DB_NAME = 'davvero_autobackups';
const STORE_NAME = 'backups';

async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const fetchFullBackup = async () => {
  const backup: any = {
    metadata: {
      timestamp: new Date().toISOString(),
      appId,
      version: 1
    },
    system: {},
    firebase: {}
  };

  // 1. System Info (localStorage)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      backup.system[key] = localStorage.getItem(key);
    }
  }

  // 2. Firebase Info
  const cols = [
    'students',
    'events',
    'attendances',
    'appointments',
    'availabilities',
    'notifications',
    'mural_posts'
  ];

  for (const c of cols) {
    const snap = await getDocs(query(collection(db, `artifacts/${appId}/public/data/${c}`)));
    backup.firebase[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (c === 'mural_posts') {
      for (const post of backup.firebase[c]) {
        const commentsSnap = await getDocs(query(collection(db, `artifacts/${appId}/public/data/mural_posts/${post.id}/comments`)));
        post.comments_backup = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }
  }

  return backup;
};

export const getAutoBackupsList = async (): Promise<any[]> => {
  const dbInstance = await getDB();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      // return list without the heavy 'data' payload for display
      resolve(all.map(b => ({ id: b.id, timestamp: b.timestamp, size: b.size })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    req.onerror = () => reject(req.error);
  });
};

export const downloadAutoBackup = async (id: string) => {
  const dbInstance = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record && record.data) {
        const blob = new Blob([JSON.stringify(record.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `DAVVERO_AutoBackup_${id}.json`;
        link.click();
        URL.revokeObjectURL(url);
        resolve();
      } else {
        reject(new Error("Backup not found"));
      }
    };
    req.onerror = () => reject(req.error);
  });
};

export const deleteAutoBackup = async (id: string) => {
  const dbInstance = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const performAutoBackupIfDue = async () => {
  try {
    const lastBackupTimeStr = localStorage.getItem('davvero_last_auto_backup_time');
    const now = new Date();
    
    // Check if we need to backup (once a week = 7 * 24 * 60 * 60 * 1000 ms)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    
    if (lastBackupTimeStr) {
      const lastTime = new Date(lastBackupTimeStr);
      if (now.getTime() - lastTime.getTime() < SEVEN_DAYS_MS) {
        return; // not due yet
      }
    }
    
    // Perform backup
    const data = await fetchFullBackup();
    const id = now.toISOString().split("T")[0]; // YYYY-MM-DD
    
    const dbInstance = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const payload = {
        id,
        timestamp: now.toISOString(),
        size: JSON.stringify(data).length,
        data
      };
      
      const req = store.put(payload); // insert or update
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    
    // Remember when we last backed up
    localStorage.setItem('davvero_last_auto_backup_time', now.toISOString());
    
    // Optional: Keep only last 4 backups to save space
    const list = await getAutoBackupsList();
    if (list.length > 4) {
      const toDelete = list.slice(4); // from 5th to end
      for (const b of toDelete) {
        await deleteAutoBackup(b.id);
      }
    }
    
  } catch(e) {
    console.error("Auto backup failed", e);
  }
};
