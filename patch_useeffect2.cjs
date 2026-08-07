const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

const targetStr = `    const unsubAppt = onSnapshot(qAppt, (snap) => {
      const appts: Appointment[] = [];
      snap.forEach(d => appts.push({ ...d.data(), id: d.id } as Appointment));
      setAppointments(appts);
      setLoading(false);
    });
  // Auto-link unmatched appointments when students are loaded`;

const replacementStr = `    const unsubAppt = onSnapshot(qAppt, (snap) => {
      const appts: Appointment[] = [];
      snap.forEach(d => appts.push({ ...d.data(), id: d.id } as Appointment));
      setAppointments(appts);
      setLoading(false);
    });

    return () => {
      unsubAvail();
      unsubAppt();
    };
  }, []);

  // Auto-link unmatched appointments when students are loaded`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    
    // now we need to remove the trailing one that we just replaced from below:
    const trailingTarget = `  }, [allStudents, appointments, professionals]);

    return () => {
      unsubAvail();
      unsubAppt();
    };
  }, []);`;
    const trailingReplacement = `  }, [allStudents, appointments, professionals]);`;
    
    if (content.includes(trailingTarget)) {
        content = content.replace(trailingTarget, trailingReplacement);
        fs.writeFileSync('src/components/AdminAppointments.tsx', content);
        console.log("Patched useEffects!");
    } else {
        console.log("Trailing target not found");
    }
} else {
    console.log("Target string not found");
}
