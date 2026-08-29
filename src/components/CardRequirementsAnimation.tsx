import React from "react";
import { motion } from "motion/react";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  User,
  Camera,
  GraduationCap,
  Church,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  Info
} from "lucide-react";
import type { Member } from "../types";

interface CardRequirementsAnimationProps {
  member?: Member | null;
  compact?: boolean;
  onActionClick?: () => void;
  actionButtonText?: string;
}

export default function CardRequirementsAnimation({
  member,
  compact = false,
  onActionClick,
  actionButtonText,
}: CardRequirementsAnimationProps) {
  // Check completion states
  const hasName = Boolean(member?.name && member.name.trim().length > 3);
  const hasCpfOrRa = Boolean(member?.cpf || member?.ra);
  const hasPhoto = Boolean(member?.photoUrl && member.photoUrl.length > 50);
  const hasCourse = Boolean(member?.course && member.course.trim().length > 0);
  const hasVinculoOrDiocese = Boolean(
    (member?.roles && member.roles.length > 0) || member?.diocese || member?.seminary
  );
  const isApprovedByAdmin = Boolean(member?.isApproved === true);

  const requirements = [
    {
      id: "name_doc",
      title: "Nome Completo & Documento (CPF / RA)",
      desc: "Identificação civil obrigatória pela Lei da Meia-Entrada 12.933/2013",
      isComplete: hasName && hasCpfOrRa,
      icon: User,
    },
    {
      id: "photo",
      title: "Foto Oficial de Perfil (Padrão 3x4)",
      desc: "Fotografia frontal, nítida e sem acessórios que obstruam o rosto",
      isComplete: hasPhoto,
      icon: Camera,
    },
    {
      id: "vinculo",
      title: "Vínculo & Diocese / Seminário",
      desc: "Definição do vínculo institucional (Aluno, Seminarista, Professor, etc.)",
      isComplete: hasVinculoOrDiocese,
      icon: Church,
    },
    {
      id: "course",
      title: "Curso Acadêmico / Turma",
      desc: "Matrícula no curso correspondente (Filosofia, Teologia ou Extensão)",
      isComplete: hasCourse,
      icon: GraduationCap,
    },
    {
      id: "approval",
      title: "Homologação da Secretaria Geral",
      desc: "Validação documental e emissão do selo digital de segurança",
      isComplete: isApprovedByAdmin,
      icon: FileCheck2,
    },
  ];

  const completedCount = requirements.filter((r) => r.isComplete).length;
  const totalCount = requirements.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="w-full max-w-lg mx-auto bg-gradient-to-b from-amber-500/10 via-slate-900/40 to-slate-900/60 dark:from-amber-950/30 dark:via-slate-900/80 dark:to-slate-950 border-2 border-amber-500/30 dark:border-amber-500/20 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden text-left">
      {/* Background Animated Glows */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with animated Lock */}
      <div className="flex items-start gap-3.5 mb-5 relative z-10">
        <div className="relative">
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-lg shadow-amber-500/30 flex items-center justify-center text-slate-950"
          >
            <div className="w-full h-full bg-slate-950 dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Lock className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
          </motion.div>
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-slate-900"></span>
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30">
              Emissão Pendente
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {completedCount} de {totalCount} Concluídos
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mt-1 leading-snug">
            Carteirinha Digital Bloqueada
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            A carteirinha precisa de todos os dados completos e homologados para ser emitida.
          </p>
        </div>
      </div>

      {/* Progress Bar with Scanner Ray */}
      <div className="mb-6 relative z-10">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
          <span>Progresso do Cadastro</span>
          <span className="text-amber-500 dark:text-amber-400 font-mono">{progressPercent}%</span>
        </div>
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700/60 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${
              progressPercent === 100
                ? "bg-emerald-500 shadow-emerald-500/50"
                : "bg-gradient-to-r from-amber-500 to-amber-400 shadow-amber-500/50"
            } shadow-sm relative overflow-hidden`}
          >
            {/* Shimmer Effect */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2"
            />
          </motion.div>
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-2.5 relative z-10">
        {requirements.map((req, idx) => {
          const Icon = req.icon;
          return (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                req.isComplete
                  ? "bg-emerald-500/10 border-emerald-500/30 text-slate-800 dark:text-slate-200"
                  : "bg-white/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    req.isComplete
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate leading-tight">
                    {req.title}
                  </p>
                  {!compact && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {req.desc}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {req.isComplete ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" /> Preenchido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" /> Pendente
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Informative Note Box */}
      <div className="mt-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 relative z-10">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
          <strong>Regra Institucional:</strong> Sem todos os campos cadastrais preenchidos e a respectiva validação da secretaria, o sistema não gera o QR Code e não libera a carteirinha digital.
        </p>
      </div>

      {/* Action Button if provided */}
      {onActionClick && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onActionClick}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            {actionButtonText || "Completar Dados Cadastrais"}
          </button>
        </div>
      )}
    </div>
  );
}
