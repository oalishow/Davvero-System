const fs = require('fs');
let file = fs.readFileSync('src/components/VerificationResult.tsx', 'utf8');

const search = `  status:
    | "VALID"
    | "INACTIVE"
    | "EXPIRED"
    | "NOT_FOUND"
    | "NOT_ENROLLED"
    | "ALREADY_PRESENT"
    | "JUST_CHECKED_IN"
    | "PENDING";`;
    
const replace = `  status:
    | "VALID"
    | "INACTIVE"
    | "EXPIRED"
    | "NOT_FOUND"
    | "NOT_ENROLLED"
    | "ALREADY_PRESENT"
    | "JUST_CHECKED_IN"
    | "PENDING"
    | "VALID_CERTIFICATE";
  event?: any;`;

file = file.replace(search, replace);

const search2 = `  if (status === "VALID") {
    bgColor = "bg-emerald-500/10 dark:bg-emerald-500/20";
    borderColor = "border-emerald-500";
    textColor = "text-emerald-700 dark:text-emerald-400";
    titleText = "Verificado com Sucesso";
    Icon = CheckCircle;
  } else if (status === "JUST_CHECKED_IN") {`;
  
const replace2 = `  if (status === "VALID") {
    bgColor = "bg-emerald-500/10 dark:bg-emerald-500/20";
    borderColor = "border-emerald-500";
    textColor = "text-emerald-700 dark:text-emerald-400";
    titleText = "Identidade Verificada";
    Icon = CheckCircle;
  } else if (status === "VALID_CERTIFICATE") {
    bgColor = "bg-sky-500/10 dark:bg-sky-500/20";
    borderColor = "border-sky-500";
    textColor = "text-sky-700 dark:text-sky-400";
    titleText = "Certificado Válido";
    Icon = CheckCircle;
  } else if (status === "JUST_CHECKED_IN") {`;

file = file.replace(search2, replace2);

// Check if I can show something specific for certificate.
const search3 = `    <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Dynamic Header */}
      <div className={\`\${bgColor} \${borderColor} border-b p-6 text-center relative overflow-hidden\`}>`;

const replace3 = `    <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Dynamic Header */}
      <div className={\`\${bgColor} \${borderColor} border-b p-6 text-center relative overflow-hidden\`}>`;

file = file.replace(search3, replace3);

fs.writeFileSync('src/components/VerificationResult.tsx', file);
