import React from "react";
import { motion } from "motion/react";
import { GraduationCap, ExternalLink } from "lucide-react";

export const StudentAcademicTab: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[500px]">
        <div className="p-4 bg-sky-50 dark:bg-sky-900/30 rounded-full text-sky-600 dark:text-sky-400 mb-6">
          <GraduationCap className="w-12 h-12" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-widest leading-tight mb-4 px-2 break-words max-w-full text-center">
          Portal Acadêmico
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 px-4">
          Por medidas de segurança do Sistema Integrado FAJOPA (Sophia), o portal
          não permite visualização integrada. Por favor, acesse o sistema através
          do botão abaixo usando seu navegador comum.
        </p>
        <a
          href="https://portal.sophia.com.br/SophiA_107/Acesso.aspx?escola=9087"
          target="_blank"
          rel="noopener noreferrer"
          className="flex sm:inline-flex flex-wrap items-center justify-center gap-2 px-4 sm:px-8 py-4 w-full sm:w-auto bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95 text-xs sm:text-sm uppercase tracking-wider text-center"
        >
          Acessar o portal do aluno
          <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        </a>
      </div>
    </motion.div>
  );
};

export default StudentAcademicTab;
