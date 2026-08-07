import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

interface ApprovalSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string;
}

export default function ApprovalSuccessModal({ isOpen, onClose, memberName }: ApprovalSuccessModalProps) {
  const [actuallyShow, setActuallyShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if other modals are in the DOM (very simple heuristic to avoid overlaps)
      const checkOtherModals = setInterval(() => {
        const hasOtherModals = document.querySelectorAll('.fixed.inset-0.z-50').length > 0;
        // The ones with classes might have z-50 for modal overlays. But our own modal hasn't rendered yet (we are tracking actuallyShow).
        // Let's just wait 1 second and then show.
      }, 500);
      
      const timeout = setTimeout(() => {
         clearInterval(checkOtherModals);
         setActuallyShow(true);
         
         // Trigger confetti
         const duration = 3 * 1000;
         const animationEnd = Date.now() + duration;
         const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

         const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

         const interval: any = setInterval(function() {
           const timeLeft = animationEnd - Date.now();

           if (timeLeft <= 0) {
             return clearInterval(interval);
           }

           const particleCount = 50 * (timeLeft / duration);
           confetti({
             ...defaults, particleCount,
             origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
           });
           confetti({
             ...defaults, particleCount,
             origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
           });
         }, 250);
      }, 1500);

      return () => {
         clearTimeout(timeout);
         setActuallyShow(false);
      };
    } else {
      setActuallyShow(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {actuallyShow && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center border-2 border-emerald-100 dark:border-emerald-500/20 overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <motion.div 
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30"
              >
                <CheckCircle className="w-12 h-12 text-white" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Cadastro Liberado!</h2>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                
                <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-[280px] mx-auto leading-relaxed">
                  Olá <strong className="text-emerald-600 dark:text-emerald-400">{memberName.split(' ')[0]}</strong>, o seu acesso ao sistema DAVVERO foi aprovado pela administração. Bem-vindo(a) ao portal!
                </p>
                
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95 uppercase tracking-wider text-sm"
                >
                  Entrar no Aplicativo
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
