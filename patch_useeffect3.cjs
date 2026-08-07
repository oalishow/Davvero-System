const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

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
