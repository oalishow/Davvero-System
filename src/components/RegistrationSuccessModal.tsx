import React from "react";
import { motion } from "motion/react";
import { CheckCircle } from "lucide-react";
import Modal from "./Modal";

interface RegistrationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RegistrationSuccessModal({ isOpen, onClose }: RegistrationSuccessModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastro Recebido"
      hideFooter
    >
      <div className="flex flex-col items-center text-center justify-center py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle className="w-10 h-10" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Sucesso! Seu cadastro foi recebido.
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
            Os seus dados foram enviados e estão agora no <b>Painel de Solicitações</b>.
            <br /><br />
            A secretaria responsável fará a análise das suas informações e em breve a sua carteirinha será liberada, não se preocupe pois o seu código poderá ser usado para acompanhamento no aplicativo em "Minha ID"
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200 dark:shadow-none"
          >
            Entendido
          </button>
        </motion.div>
      </div>
    </Modal>
  );
}
