const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the inner ErrorBoundary
c = c.replace(/<ErrorBoundary>\s*<Suspense/g, '<Suspense');
c = c.replace(/<\/Suspense>\s*<\/ErrorBoundary>/g, '</Suspense>');

// Wrap the main return
c = c.replace(/return \(\n\s*<div className="min-h-screen relative flex flex-col items-center p-0 sm:p-4 print:block print:p-0">/, 
`return (
    <ErrorBoundary>
    <div className="min-h-screen relative flex flex-col items-center p-0 sm:p-4 print:block print:p-0">`);

c = c.replace(/<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\);\n\}/, 
`</div>
      </div>
    </div>
    </ErrorBoundary>
  );
}`);

fs.writeFileSync('src/App.tsx', c);
