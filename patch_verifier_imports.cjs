const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

file = file.replace(
  /Camera, XCircle, Search, ScanLine, CheckCircle, ArrowLeft, Loader2/,
  "Camera, XCircle, Search, ScanLine, CheckCircle, ArrowLeft, Loader2, ExternalLink, ShieldCheck"
);

fs.writeFileSync('src/components/Verifier.tsx', file);
