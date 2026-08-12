const fs = require('fs');
let file = fs.readFileSync('src/components/VerificationResult.tsx', 'utf8');

const search = `        {/* Member Details */}
        {member && (`;

const replace = `        {/* Member Details */}
        {status === "VALID_CERTIFICATE" && props.event ? (
          <div className="p-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-1">Certificado Autêntico</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">Emitido pelo Davvero System</p>
            
            <div className="space-y-4">
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Titular do Certificado</p>
                 <p className="font-bold text-slate-800 dark:text-slate-200">{member?.name}</p>
                 {member?.role === 'VISITOR' && <span className="inline-block mt-1 text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Participante Externo</span>}
               </div>
               
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Evento / Curso</p>
                 <p className="font-bold text-slate-800 dark:text-slate-200">{props.event.title}</p>
                 <p className="text-xs text-slate-500 mt-1">{new Date(props.event.date).toLocaleDateString('pt-BR')} - {props.event.workloadHours || 2} horas</p>
               </div>
            </div>
          </div>
        ) : member && (`;

file = file.replace(search, replace);

const search2 = `export default function VerificationResult({
  member,
  status,
  onReset,
  onScanNext,
  isMyID,
  isAdminLogged,
  onEnrollAndCheckIn
}: VerificationResultProps) {`;

const replace2 = `export default function VerificationResult(props: VerificationResultProps) {
  const {
    member,
    status,
    onReset,
    onScanNext,
    isMyID,
    isAdminLogged,
    onEnrollAndCheckIn
  } = props;`;

file = file.replace(search2, replace2);

fs.writeFileSync('src/components/VerificationResult.tsx', file);
