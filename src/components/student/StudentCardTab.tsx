import React from "react";
import { motion } from "motion/react";
import VerificationResult from "../VerificationResult";
import HomePollsWidget from "../HomePollsWidget";

interface StudentCardTabProps {
  member: any;
  cardRef: React.RefObject<HTMLDivElement>;
  onResetSession: () => void;
  onOpenDNE: () => void;
}

export const StudentCardTab: React.FC<StudentCardTabProps> = ({
  member,
  cardRef,
  onResetSession,
  onOpenDNE,
}) => {
  const status =
    (!member.isApproved && member.isApproved !== undefined) ||
    member.isApproved === false
      ? "PENDING"
      : member.isActive
      ? "VALID"
      : "INACTIVE";

  return (
    <motion.div
      ref={cardRef}
      id="student-carteirinha-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <VerificationResult
        member={member}
        status={status}
        onReset={onResetSession}
        isMyID={true}
      />

      <HomePollsWidget
        currentMemberName={member?.name}
        currentMemberId={member?.id}
      />

      <div className="px-4 py-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
          Esta é a sua Identidade Estudantil oficial. Use o QR Code acima para
          validar sua presença em eventos e garantir seu acesso aos benefícios
          estudantis.
        </p>
      </div>

      <div className="px-4 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-center no-print print:hidden">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-3 leading-tight">
          Validade Nacional
        </h3>
        <p className="text-[10px] text-slate-500 mb-4 px-4 leading-relaxed font-medium">
          O DAVVERO System é seu documento institucional. Para eventos
          nacionais que exijam o padrão ITI com certificação ICP-Brasil, você
          pode solicitar o DNE oficial.
        </p>
        <button
          onClick={onOpenDNE}
          className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
        >
          Solicitar Documento Nacional (DNE)
        </button>
      </div>
    </motion.div>
  );
};

export default StudentCardTab;
