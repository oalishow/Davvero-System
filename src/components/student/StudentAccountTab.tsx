import React, { useState } from "react";
import { motion } from "motion/react";
import {
  User,
  Mail,
  MailCheck,
  MailX,
  BellRing,
  ShieldCheck,
  Loader2,
  Trash2,
} from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, appId } from "../../lib/firebase";
import { playSound } from "../../lib/sounds";
import { useDialog } from "../../context/DialogContext";
import Modal from "../Modal";
import type { Member } from "../../types";

interface StudentAccountTabProps {
  member: Member;
  setMember: React.Dispatch<React.SetStateAction<Member | null>>;
  onOpenEditModal: () => void;
  // Push notifications
  isPushSupported: boolean;
  pushSubscription: any;
  pushPermission: NotificationPermission | "default";
  isSubscribingPush: boolean;
  onTogglePush: () => void;
}

export const StudentAccountTab: React.FC<StudentAccountTabProps> = ({
  member,
  setMember,
  onOpenEditModal,
  isPushSupported,
  pushSubscription,
  pushPermission,
  isSubscribingPush,
  onTogglePush,
}) => {
  const { showAlert } = useDialog();
  const [isUpdatingEmailPref, setIsUpdatingEmailPref] = useState(false);
  const [showDeletionConfirmModal, setShowDeletionConfirmModal] = useState(false);

  const handleToggleEmailNotifications = async () => {
    if (!member) return;
    setIsUpdatingEmailPref(true);
    try {
      const currentVal = member.emailNotificationsEnabled !== false; // default true
      const newVal = !currentVal;
      const docRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
      await updateDoc(docRef, {
        emailNotificationsEnabled: newVal,
        ...(newVal ? {} : { emailUnsubscribedAt: new Date().toISOString() }),
      });
      const updatedMember: Member = {
        ...member,
        emailNotificationsEnabled: newVal,
        ...(newVal ? {} : { emailUnsubscribedAt: new Date().toISOString() }),
      };
      setMember(updatedMember);
      try {
        localStorage.setItem("davvero_cached_member", JSON.stringify(updatedMember));
        localStorage.setItem("davveroId_cached_member", JSON.stringify(updatedMember));
      } catch {}
      playSound("success");
      showAlert(
        newVal
          ? "Notificações por e-mail ativadas com sucesso! Você receberá avisos sobre certificados liberados e avisos acadêmicos."
          : "Notificações por e-mail desativadas. Você não receberá mais comunicados automáticos por e-mail.",
        { type: "success" }
      );
    } catch (err) {
      console.error(err);
      playSound("error");
      showAlert("Erro ao atualizar preferência de e-mail.", { type: "error" });
    } finally {
      setIsUpdatingEmailPref(false);
    }
  };

  const handleConfirmDeletion = async () => {
    try {
      if (!member) return;
      await updateDoc(
        doc(db, `artifacts/${appId}/public/data/students`, member.id),
        {
          deletionRequested: true,
          deletionRequestedAt: new Date().toISOString(),
        }
      );
      setMember((prev) =>
        prev
          ? {
              ...prev,
              deletionRequested: true,
              deletionRequestedAt: new Date().toISOString(),
            }
          : null
      );
      setShowDeletionConfirmModal(false);
      await showAlert(
        "Solicitação Enviada",
        "Sua solicitação de exclusão foi enviada com sucesso ao administrador."
      );
    } catch (e) {
      console.error(e);
      await showAlert("Erro", "Erro ao solicitar a exclusão de dados.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-700 shadow-xl bg-white">
              <img
                src={
                  member.photoUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    member.name || "User"
                  )}&background=e2e8f0&color=475569&size=200`
                }
                alt={member.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-1">
              {member.name}
            </h3>
            <p className="text-sm font-semibold text-slate-500 mb-1">
              {member.email || "Nenhum e-mail cadastrado"}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mt-3">
              {member.roles?.map((r, i) => (
                <span
                  key={i}
                  className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-2 py-1 rounded-md uppercase"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenEditModal}
              className="btn-modern px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 rounded-xl font-bold flex items-center justify-center gap-2 transition"
            >
              <User className="w-4 h-4 inline-block -mt-0.5 mr-1" />
              Editar Informações
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              RA / Matrícula
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.ra}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              CPF
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.cpf}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Data de Nascimento
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.birthdate}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Curso
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.course || "-"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Diocese
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.diocese || "-"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Seminário
            </p>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {member.seminary || "-"}
            </p>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-500" /> Notificações por E-mail
          </h4>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  E-mail Cadastrado:{" "}
                  <span className="font-mono text-sky-600 dark:text-sky-400">
                    {member.email || "Nenhum e-mail vinculado"}
                  </span>
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1.5">
                  {member.emailNotificationsEnabled === false ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                      <MailX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />{" "}
                      E-mails Desativados (Opt-out)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                      <MailCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
                      Ativo para Receber Notificações
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {member.emailNotificationsEnabled === false
                    ? "Você optou por não receber e-mails automáticos. Novos certificados liberados e avisos do sistema não serão enviados para sua caixa de entrada."
                    : "Você receberá avisos quando novos certificados forem liberados, atualizações de carteirinha e comunicados acadêmicos."}
                </p>
              </div>

              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isUpdatingEmailPref || !member.email}
                  onClick={() => {
                    playSound("pop");
                    handleToggleEmailNotifications();
                  }}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 ${
                    member.emailNotificationsEnabled === false
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      : "bg-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isUpdatingEmailPref ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Atualizando...</span>
                    </>
                  ) : member.emailNotificationsEnabled === false ? (
                    <>
                      <MailCheck className="w-4 h-4" />
                      <span>Ativar E-mails</span>
                    </>
                  ) : (
                    <>
                      <MailX className="w-4 h-4" />
                      <span>Desativar E-mails</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-sky-500" /> Serviço de Notificações Push
          </h4>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status Atual
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                  {!isPushSupported ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Não Suportado
                    </span>
                  ) : pushPermission === "denied" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Erro (Bloqueado)
                    </span>
                  ) : pushSubscription ||
                    (pushPermission === "granted" &&
                      typeof window !== "undefined" &&
                      localStorage.getItem("davvero_push_subscribed") === "true") ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Conectado e Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Pendente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {pushSubscription ||
                  (pushPermission === "granted" &&
                    typeof window !== "undefined" &&
                    localStorage.getItem("davvero_push_subscribed") === "true")
                    ? "Seu dispositivo está ativo e apto a receber comunicados urgentes e avisos em tempo real."
                    : pushPermission === "denied"
                    ? "Você bloqueou as notificações. Libere a permissão nas configurações do seu navegador para receber comunicados."
                    : "Ative as notificações para receber avisos importantes da secretaria."}
                </p>
              </div>
              {isPushSupported && (
                <div className="flex-shrink-0 w-full sm:w-auto">
                  {!(
                    pushSubscription ||
                    (pushPermission === "granted" &&
                      typeof window !== "undefined" &&
                      localStorage.getItem("davvero_push_subscribed") === "true")
                  ) && pushPermission !== "denied" ? (
                    <button
                      type="button"
                      disabled={isSubscribingPush}
                      onClick={() => {
                        playSound("click");
                        onTogglePush();
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      {isSubscribingPush ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Conectando...</span>
                        </>
                      ) : (
                        <span>Ativar Notificações</span>
                      )}
                    </button>
                  ) : pushSubscription ||
                    (pushPermission === "granted" &&
                      typeof window !== "undefined" &&
                      localStorage.getItem("davvero_push_subscribed") === "true") ? (
                    <button
                      type="button"
                      disabled={isSubscribingPush}
                      onClick={() => {
                        playSound("click");
                        onTogglePush();
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 disabled:opacity-60 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      {isSubscribingPush ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <span>Desativar</span>
                      )}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700/50">
          <h4 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Zona de Perigo (LGPD)
          </h4>
          {member.deletionRequested ? (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4 rounded-xl">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                Sua solicitação de exclusão de dados foi recebida e está aguardando a aprovação do administrador.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowDeletionConfirmModal(true)}
              className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm"
            >
              <Trash2 className="w-4 h-4" /> Solicitar Exclusão de Conta (LGPD)
            </button>
          )}
        </div>
      </div>

      <Modal
        isOpen={showDeletionConfirmModal}
        onClose={() => setShowDeletionConfirmModal(false)}
        title="Exclusão de Conta"
        confirmLabel="Confirmar"
        confirmVariant="danger"
        onConfirm={handleConfirmDeletion}
      >
        <div className="flex flex-col items-center justify-center mb-6 text-red-500">
          <Trash2 className="w-12 h-12 p-3 bg-red-100 dark:bg-red-900/50 rounded-full border border-red-200 dark:border-red-800" />
        </div>
        Você tem certeza que deseja solicitar a exclusão da sua conta? Isto enviará um pedido ao administrador e seus dados serão movidos para a lixeira após aprovação, em conformidade com a LGPD.
      </Modal>
    </motion.div>
  );
};

export default StudentAccountTab;
