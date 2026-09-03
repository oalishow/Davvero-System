import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { 
  Check, ShieldCheck, Award, Calendar, Clock, Copy, CheckCheck, 
  Printer, Share2, Sparkles, Feather, FileText, UserCheck, Shield
} from "lucide-react";
import { playSound } from "../lib/sounds";
import { Member, Event } from "../types";

interface CheckInCelebrationProps {
  member: Member;
  event: Event;
  protocol: string;
  signatureTimestamp: string;
  onClose: () => void;
  onNavigateToLogin?: () => void;
  isVisitor?: boolean;
}

export default function CheckInCelebrationAnimation({
  member,
  event,
  protocol,
  signatureTimestamp,
  onClose,
  onNavigateToLogin,
  isVisitor = false,
}: CheckInCelebrationProps) {
  const [copied, setCopied] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);

  useEffect(() => {
    // Play celebratory sound & haptics
    playSound("enroll");

    // Launch celebratory confetti with rich academic / liturgical palette
    const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#6366f1"];
    
    // First burst
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.65 },
      colors,
    });

    // Staggered second burst
    const timer = setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 0.85, y: 0.6 },
        colors,
      });
    }, 280);

    const sigTimer = setTimeout(() => {
      setSignatureComplete(true);
    }, 1100);

    return () => {
      clearTimeout(timer);
      clearTimeout(sigTimer);
    };
  }, []);

  const handleCopyProtocol = async () => {
    try {
      await navigator.clipboard.writeText(
        `COMPROVANTE DE PRESENÇA DAVVERO\nEvento: ${event.title}\nParticipante: ${member.name}\nProtocolo: ${protocol}\nData/Hora: ${signatureTimestamp}`
      );
      setCopied(true);
      playSound("click");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative overflow-hidden p-1">
      {/* Background Animated Glow Radiance */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.8, 1.4, 1.1], opacity: [0, 0.4, 0.15] }}
          transition={{ duration: 2.2, ease: "easeOut" }}
          className="w-96 h-96 rounded-full bg-gradient-to-tr from-emerald-400/30 via-sky-400/20 to-amber-300/25 blur-3xl"
        />
      </div>

      {/* Main Animated Card */}
      <div className="relative rounded-3xl bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-xl overflow-hidden backdrop-blur-sm">
        
        {/* Holographic Header Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 via-sky-500 to-amber-400 animate-gradient" />

        <div className="p-6 sm:p-7 text-center space-y-5">
          
          {/* Animated Stamp Seal with Radiating Rings */}
          <div className="relative flex items-center justify-center py-2">
            
            {/* Ripple Pulse Rings */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: [1, 1.9], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeOut" }}
              className="absolute w-20 h-20 rounded-full border-2 border-emerald-500/40 dark:border-emerald-400/30"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: [1, 2.3], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeOut", delay: 0.6 }}
              className="absolute w-20 h-20 rounded-full border border-amber-400/40 dark:border-amber-300/30"
            />

            {/* Central Seal Container */}
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 18, 
                mass: 0.8, 
                delay: 0.1 
              }}
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 ring-4 ring-emerald-100 dark:ring-emerald-950/80 z-10"
            >
              {/* Rotating subtle sunburst ring */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-2xl border border-dashed border-emerald-200/40"
              />

              {/* Animated Checkmark Drawing */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 350, damping: 20 }}
              >
                <Check className="w-10 h-10 stroke-[3.5] text-white drop-shadow-md" />
              </motion.div>

              {/* Verified Mini Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 400 }}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900"
                title="Autenticado"
              >
                <Sparkles className="w-4 h-4 fill-slate-900" />
              </motion.div>
            </motion.div>
          </div>

          {/* Heading & Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-1.5"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-300/60 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Presença Autenticada com Sucesso
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Assinatura Digital Confirmada!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
              O seu check-in na lista oficial foi registrado e autenticado com validade institucional e acadêmica.
            </p>
          </motion.div>

          {/* Digital Signature Simulated Stroke Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-left space-y-2 relative"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
              <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                <Feather className="w-3.5 h-3.5" />
                Assinatura Digital no Livro de Presenças
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">
                {signatureComplete ? "✓ REGISTRADA" : "ASSINANDO..."}
              </span>
            </div>

            {/* Simulated Animated Cursive Stroke */}
            <div className="py-2 px-1 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {member.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {member.ra ? `R.A.: ${member.ra}` : member.diocese ? `Diocese: ${member.diocese}` : isVisitor ? "Visitante Externo" : "Participante"}
                </p>
              </div>

              {/* Animated SVG Signature Path */}
              <div className="w-36 h-10 flex items-center justify-center opacity-90">
                <svg viewBox="0 0 160 45" className="w-full h-full stroke-emerald-600 dark:stroke-emerald-400 fill-none stroke-2">
                  <motion.path
                    d="M 10 32 Q 25 10, 45 28 T 80 20 T 115 25 T 145 16 M 20 28 Q 70 38, 140 30"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, ease: "easeInOut", delay: 0.5 }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Official Digital Protocol */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block">
                  Protocolo Criptográfico
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px] select-all break-all">
                  {protocol}
                </span>
              </div>

              <div className="sm:text-right shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block">
                  Data & Hora Oficial
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                  {signatureTimestamp}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Event Context Card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 text-xs text-left"
          >
            <div className="truncate pr-2">
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {event.title}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {new Date(event.startDate).toLocaleDateString("pt-BR")} • {event.format === "online" ? "Online" : event.format === "hibrido" ? "Híbrido" : "Presencial"}
              </p>
            </div>
            {event.hours && (
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm">
                <Award className="w-3.5 h-3.5" />
                {event.hours}h
              </span>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2.5 pt-1"
          >
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleCopyProtocol}
                className="flex-1 py-3 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-98 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copiar Protocolo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Concluir</span>
              </button>
            </div>

            {onNavigateToLogin && isVisitor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToLogin();
                }}
                className="w-full py-2.5 px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium hover:underline transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Já possui cadastro? Fazer login no sistema</span>
              </button>
            )}
          </motion.div>

        </div>
      </div>
    </div>
  );
}
