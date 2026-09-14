import React from "react";
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  GraduationCap,
  CalendarHeart,
  Library,
  User,
  Bell,
  BellRing,
  Lock,
  LogOut,
} from "lucide-react";
import { playSound } from "../../lib/sounds";
import type { Member } from "../../types";

export type StudentTabType =
  | "id"
  | "events"
  | "certificates"
  | "academic"
  | "appointments"
  | "seminary_events"
  | "liturgy"
  | "account"
  | "biblioteca";

interface StudentPortalHeaderProps {
  member: Member | null;
  activeTab: StudentTabType;
  setActiveTab: (tab: StudentTabType) => void;
  isOverrideMode: boolean;
  isPushSupported: boolean;
  pushSubscription: any;
  onSubscribePush: () => void;
  onLockSecurity: () => void;
  onOpenUnlinkModal: () => void;
  onScrollToCard: () => void;
}

export const StudentPortalHeader: React.FC<StudentPortalHeaderProps> = ({
  member,
  activeTab,
  setActiveTab,
  isOverrideMode,
  isPushSupported,
  pushSubscription,
  onSubscribePush,
  onLockSecurity,
  onOpenUnlinkModal,
  onScrollToCard,
}) => {
  const isSeminaryRole = member?.roles?.some((r) =>
    [
      "SEMINARISTA",
      "PADRE",
      "REITOR",
      "VICE-REITOR",
      "PSICÓLOGA",
      "DIRETOR ESPIRITUAL",
      "DIRETORA ESPIRITUAL",
    ].includes(r.toUpperCase())
  );

  return (
    <>
      {/* Push Notification Banner */}
      {isPushSupported && !pushSubscription && !isOverrideMode && (
        <div className="w-full mb-6 no-print">
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-sky-500 p-2.5 rounded-xl text-white shadow-md">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Não perca nada!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Ative as notificações em segundo plano para receber avisos
                  importantes, mesmo com o app fechado. Não gasta bateria.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playSound("click");
                onSubscribePush();
              }}
              className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 whitespace-nowrap"
            >
              Ativar Notificações
            </button>
          </div>
        </div>
      )}

      {/* Top Bar with Security Status and Actions */}
      <div className="w-full flex justify-between items-center mb-6 px-2 no-print print:hidden">
        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Acesso Seguro Ativo
        </span>
        <div className="flex gap-1">
          {!isOverrideMode && (
            <>
              {isPushSupported && !pushSubscription && (
                <button
                  onClick={() => {
                    playSound("click");
                    onSubscribePush();
                  }}
                  className="p-2 text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 transition-colors animate-pulse relative"
                  title="Ativar Notificações"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                </button>
              )}
              {isPushSupported && pushSubscription && (
                <button
                  className="p-2 text-emerald-500 hover:text-emerald-600 transition-colors cursor-default"
                  title="Notificações Ativas"
                >
                  <BellRing className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => {
                  playSound("logout");
                  onLockSecurity();
                }}
                className="p-2 text-slate-400 hover:text-sky-500 transition-colors"
                title="Bloquear Proteção"
              >
                <Lock className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  playSound("click");
                  onOpenUnlinkModal();
                }}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Sair / Desvincular"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
          {isOverrideMode && (
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center bg-amber-500/10 px-2 py-1 rounded-full">
              MODO VISUALIZAÇÃO
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation Pills */}
      <div className="w-full mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2 no-print print:hidden mb-4">
        <button
          onClick={() => {
            playSound("click");
            setActiveTab("id");
            onScrollToCard();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "id"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Minha ID</span>
        </button>
        <button
          onClick={() => {
            playSound("click");
            setActiveTab("events");
          }}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "events"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Eventos</span>
        </button>
        <button
          onClick={() => {
            playSound("click");
            setActiveTab("certificates");
          }}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "certificates"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          } ${
            member?.isApproved === false
              ? "opacity-30 cursor-not-allowed pointer-events-none"
              : ""
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Certificados</span>
        </button>
        <button
          onClick={() => {
            playSound("click");
            setActiveTab("academic");
          }}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "academic"
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          } ${
            member?.isApproved === false
              ? "opacity-30 cursor-not-allowed pointer-events-none"
              : ""
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Acadêmico</span>
          <span className="sm:hidden">Acad.</span>
        </button>

        {isSeminaryRole && (
          <button
            onClick={() => setActiveTab("seminary_events")}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
              activeTab === "seminary_events"
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            } ${
              member?.isApproved === false
                ? "opacity-30 cursor-not-allowed pointer-events-none"
                : ""
            }`}
          >
            <CalendarHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Eventos Seminário</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("biblioteca")}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "biblioteca"
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          } ${
            member?.isApproved === false
              ? "opacity-30 cursor-not-allowed pointer-events-none"
              : ""
          }`}
        >
          <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Biblioteca</span>
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
            activeTab === "account"
              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          } ${
            member?.isApproved === false
              ? "opacity-30 cursor-not-allowed pointer-events-none"
              : ""
          }`}
        >
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Conta</span>
        </button>
      </div>
    </>
  );
};

export default StudentPortalHeader;
