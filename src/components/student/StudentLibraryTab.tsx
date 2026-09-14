import React from "react";
import { motion } from "motion/react";
import { Library, ExternalLink } from "lucide-react";

export const StudentLibraryTab: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg text-center flex flex-col items-center justify-center min-h-[500px]">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 mb-6">
          <Library className="w-12 h-12" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-widest leading-tight mb-4 px-2 break-words max-w-full text-center">
          Biblioteca Pessoal
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 px-4">
          Por medidas de segurança, o Acervo Digital Institucional não permite
          visualização integrada. Por favor, acesse o sistema através do botão
          abaixo usando seu navegador comum.
        </p>
        <a
          href="https://biblioteca.sophia.com.br/1291/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex sm:inline-flex flex-wrap items-center justify-center gap-2 px-4 sm:px-8 py-4 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95 text-xs sm:text-sm uppercase tracking-wider text-center"
        >
          Abrir no Navegador
          <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        </a>
      </div>
    </motion.div>
  );
};

export default StudentLibraryTab;
