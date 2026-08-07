const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetStr = `      setAppointments(appts);
      setLoading(false);
    });
  // Auto-link unmatched appointments`;

const replacementStr = `      setAppointments(appts);
      setLoading(false);
    });

    return () => {
      unsubAvail();
      unsubAppt();
    };
  }, []);

  // Auto-link unmatched appointments`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/AdminAppointments.tsx', content);
console.log("Patched finally!");
