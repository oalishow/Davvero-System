const fs = require('fs');
let content = fs.readFileSync('src/components/DobloControl.tsx', 'utf8');

content = content.replace(
    `const [departureTime, setDepartureTime] = useState("");`,
    `const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().substring(0, 5);
  });`
);

content = content.replace(
    `const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DobloLog)));
      setLoading(false);
    }`,
    `const unsub = onSnapshot(q, (snap) => {
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DobloLog));
      setLogs(fetchedLogs);
      
      if (fetchedLogs.length > 0) {
        // Find the most recent log (assuming they are sorted by date desc)
        // Since orderBy is date desc, the first one is the most recent date. 
        // We might want to sort by date + time to be safe.
        const sorted = [...fetchedLogs].sort((a, b) => {
           const timeA = new Date(a.date + 'T' + (a.arrivalTime || a.departureTime || '00:00')).getTime();
           const timeB = new Date(b.date + 'T' + (b.arrivalTime || b.departureTime || '00:00')).getTime();
           return timeB - timeA;
        });
        
        const latestLog = sorted[0];
        setDepartureKm((prev) => prev ? prev : (latestLog.arrivalKm || latestLog.departureKm || "").toString());
      }
      
      setLoading(false);
    }`
);

fs.writeFileSync('src/components/DobloControl.tsx', content);
console.log("Patched DobloControl defaults");
