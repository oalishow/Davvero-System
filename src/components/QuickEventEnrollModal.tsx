import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UserCheck,
  Calendar,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  User,
  Mail,
  Phone,
  Hash,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db, appId, enrollStudent } from "../lib/firebase";
import { useDialog } from "../context/DialogContext";
import type { Event, Member } from "../types";

interface QuickEventEnrollModalProps {
  event: Event;
  onClose: () => void;
  onSuccess: (member: Member) => void;
}

export default function QuickEventEnrollModal({
  event,
  onClose,
  onSuccess,
}: QuickEventEnrollModalProps) {
  const { showAlert } = useDialog();
  const [name, setName] = useState(() => {
    return localStorage.getItem("davveroId_guest_name") || "";
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem("davveroId_guest_email") || "";
  });
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem("davveroId_guest_phone") || "";
  });
  const [raCode, setRaCode] = useState("");
  const [showRaField, setShowRaField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showAlert("Por favor, informe seu nome completo.", { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      let resolvedMember: Member | null = null;

      // 1. If RA or Code was typed, check if student already exists
      if (raCode.trim()) {
        const cleanCode = raCode.trim();
        const studentsRef = collection(
          db,
          `artifacts/${appId}/public/data/students`
        );
        const qRa = query(studentsRef, where("ra", "==", cleanCode));
        const snapRa = await getDocs(qRa);

        if (!snapRa.empty) {
          const docData = snapRa.docs[0];
          resolvedMember = { id: docData.id, ...docData.data() } as Member;
        } else {
          // Check by alphaCode
          const qAlpha = query(
            studentsRef,
            where("alphaCode", "==", cleanCode.toUpperCase())
          );
          const snapAlpha = await getDocs(qAlpha);
          if (!snapAlpha.empty) {
            const docData = snapAlpha.docs[0];
            resolvedMember = { id: docData.id, ...docData.data() } as Member;
          }
        }
      }

      // 2. If no student found, create a lightweight participant record
      if (!resolvedMember) {
        const newVisitorData: Omit<Member, "id"> = {
          name: name.trim(),
          email: email.trim() || undefined,
          whatsappNumber: phone.trim() || undefined,
          roles: ["PARTICIPANTE"],
          isActive: true,
          status: "VALID",
          alphaCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(
          collection(db, `artifacts/${appId}/public/data/students`),
          newVisitorData
        );
        resolvedMember = { ...newVisitorData, id: docRef.id } as Member;
      }

      // 3. Save quick contact locally for future frictionless 1-click enrollments
      localStorage.setItem("davveroId_guest_name", name.trim());
      if (email.trim()) localStorage.setItem("davveroId_guest_email", email.trim());
      if (phone.trim()) localStorage.setItem("davveroId_guest_phone", phone.trim());
      if (resolvedMember.alphaCode) {
        localStorage.setItem(
          "davveroId_student_identity",
          resolvedMember.alphaCode
        );
      }

      // 4. Enroll in the event
      await enrollStudent({
        eventId: event.id,
        studentId: resolvedMember.id,
        status: "inscrito",
        timestamp: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess(resolvedMember!);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      if (err.message === "LIMITE_EXCEDIDO") {
        showAlert("Desculpe, a lotação para este evento está esgotada.", {
          type: "warning",
        });
      } else if (err.message === "INSCRICOES_PAUSADAS") {
        showAlert("As inscrições para este evento estão pausadas no momento.", {
          type: "warning",
        });
      } else if (err.message === "INSCRICOES_ENCERRADAS") {
        showAlert("O prazo de inscrições para este evento já foi encerrado.", {
          type: "warning",
        });
      } else {
        showAlert("Erro ao realizar inscrição. Tente novamente.", {
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Inscrição no Evento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {event.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-white">
                Inscrição Confirmada!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Sua presença foi registrada com sucesso no evento{" "}
                <strong>{event.title}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 p-3 rounded-2xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800 dark:text-sky-300">
                  Preencha seu nome para confirmar sua inscrição diretamente.
                  Rápido e sem burocracia!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Digite seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-sky-500 dark:focus:border-sky-400 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    WhatsApp (Opcional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-sky-500 dark:focus:border-sky-400 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    E-mail (Opcional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-sky-500 dark:focus:border-sky-400 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {!showRaField ? (
                <button
                  type="button"
                  onClick={() => setShowRaField(true)}
                  className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <Hash className="w-3.5 h-3.5" />
                  Já é aluno? Informar RA / Código
                </button>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    RA ou Código do Aluno (Opcional)
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Ex: 202401 ou ABC123"
                      value={raCode}
                      onChange={(e) => setRaCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-sky-500 dark:text-white uppercase"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirmando inscrição...
                  </>
                ) : (
                  <>
                    Confirmar Inscrição
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
