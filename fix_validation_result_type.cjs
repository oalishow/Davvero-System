const fs = require('fs');
let file = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const search = `  const [validationResult, setValidationResult] = useState<{
    member: Member | null;
    status:
      | "VALID"
      | "INACTIVE"
      | "EXPIRED"
      | "NOT_FOUND"
      | "NOT_ENROLLED"
      | "ALREADY_PRESENT"
      | "JUST_CHECKED_IN"
      | "PENDING";
  } | null>(null);`;

const replace = `  const [validationResult, setValidationResult] = useState<{
    member: Member | null;
    status:
      | "VALID"
      | "INACTIVE"
      | "EXPIRED"
      | "NOT_FOUND"
      | "NOT_ENROLLED"
      | "ALREADY_PRESENT"
      | "JUST_CHECKED_IN"
      | "PENDING"
      | "VALID_CERTIFICATE";
    event?: any;
  } | null>(null);`;

file = file.replace(search, replace);

// And also the VerificationResult component is mounted like this:
const search2 = `<VerificationResult
            member={validationResult.member}
            status={validationResult.status}
            onReset={() => {
              setValidationResult(null);
              setIsScanning(true);
            }}
            onScanNext={() => {
              setValidationResult(null);
              setIsScanning(true);
            }}
          />`;

const replace2 = `<VerificationResult
            member={validationResult.member}
            status={validationResult.status as any}
            event={validationResult.event}
            onReset={() => {
              setValidationResult(null);
              setIsScanning(true);
            }}
            onScanNext={() => {
              setValidationResult(null);
              setIsScanning(true);
            }}
          />`;

file = file.replace(search2, replace2);

fs.writeFileSync('src/components/Verifier.tsx', file);
