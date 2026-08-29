import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Zap,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  MapPin,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  Search,
  Check,
  UserCheck,
  AlertCircle,
  Hash,
  BadgeInfo,
  IdCard,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, appId, enrollStudent, createNotification } from "../lib/firebase";
import { checkAutoApproval } from "../lib/approval";
import { useDialog } from "../context/DialogContext";
import { useSettings } from "../context/SettingsContext";
import type { Event, Member } from "../types";
import PublicRequestModal from "./PublicRequestModal";
import TermsOfUseModal from "./TermsOfUseModal";
import CardRequirementsAnimation from "./CardRequirementsAnimation";

interface QuickEventEnrollModalProps {
  event: Event;
  onClose: () => void;
  onSuccess: (member: Member) => void;
}

const DEFAULT_ROLES = [
  "ALUNO(A)",
  "SEMINARISTA",
  "PROFESSOR(A)",
  "PARTICIPANTE",
  "VISITANTE",
  "COLABORADOR(A)",
  "PADRE",
  "DIÁCONO",
  "RELIGIOSO(A)",
];

// CPF Formatter
function formatCPF(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// CPF Validator
function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

// Phone Formatter
function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function QuickEventEnrollModal({
  event,
  onClose,
  onSuccess,
}: QuickEventEnrollModalProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();

  // Mode: "verify" (default: checks CPF/RA first) | "choice" | "quick" | "full" | "success"
  const [mode, setMode] = useState<"verify" | "choice" | "quick" | "full" | "success">("verify");

  // Verify fields
  const [verifyInput, setVerifyInput] = useState("");
  const [searchingMember, setSearchingMember] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Quick Form fields
  const [name, setName] = useState(() => localStorage.getItem("davveroId_guest_name") || "");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState(() => localStorage.getItem("davveroId_guest_email") || "");
  const [ra, setRa] = useState(""); // RA é opcional
  const [phone, setPhone] = useState(() => localStorage.getItem("davveroId_guest_phone") || "");
  const [selectedRole, setSelectedRole] = useState<string>("ALUNO(A)");
  const [customRole, setCustomRole] = useState("");
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [consent, setConsent] = useState(true);
  const [showTerms, setShowTerms] = useState(false);

  // Status & Resolved member
  const [loading, setLoading] = useState(false);
  const [resolvedMember, setResolvedMember] = useState<Member | null>(null);

  const availableRoles = Array.from(
    new Set([...DEFAULT_ROLES, ...(settings?.customRoles || [])])
  );

  // Step 1: Search existing member by CPF, RA, AlphaCode or Email
  const handleVerifyExisting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = verifyInput.trim();
    if (!cleanCode) {
      setVerifyError("Por favor, digite seu CPF ou RA para verificar.");
      return;
    }

    setSearchingMember(true);
    setVerifyError(null);

    try {
      const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
      let foundMember: Member | null = null;

      // 1. Try by CPF (digits only)
      const numericCpf = cleanCode.replace(/\D/g, "");
      if (numericCpf.length >= 7) {
        const qCpf = query(studentsRef, where("cpf", "==", numericCpf));
        const snapCpf = await getDocs(qCpf);
        if (!snapCpf.empty) {
          const d = snapCpf.docs.find((doc) => !doc.data().deletedAt);
          if (d) foundMember = { id: d.id, ...d.data() } as Member;
        }
      }

      // 2. Try by RA
      if (!foundMember) {
        const qRa = query(studentsRef, where("ra", "==", cleanCode));
        const snapRa = await getDocs(qRa);
        if (!snapRa.empty) {
          const d = snapRa.docs.find((doc) => !doc.data().deletedAt);
          if (d) foundMember = { id: d.id, ...d.data() } as Member;
        }
      }

      // 3. Try by AlphaCode (case-insensitive uppercase)
      if (!foundMember && cleanCode.length === 6) {
        const qAlpha = query(
          studentsRef,
          where("alphaCode", "==", cleanCode.toUpperCase())
        );
        const snapAlpha = await getDocs(qAlpha);
        if (!snapAlpha.empty) {
          const d = snapAlpha.docs.find((doc) => !doc.data().deletedAt);
          if (d) foundMember = { id: d.id, ...d.data() } as Member;
        }
      }

      // 4. Try by Email
      if (!foundMember && cleanCode.includes("@")) {
        const qEmail = query(
          studentsRef,
          where("email", "==", cleanCode.toLowerCase())
        );
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const d = snapEmail.docs.find((doc) => !doc.data().deletedAt);
          if (d) foundMember = { id: d.id, ...d.data() } as Member;
        }
      }

      if (foundMember) {
        // Log in the member locally
        if (foundMember.alphaCode) {
          localStorage.setItem("davveroId_student_identity", foundMember.alphaCode);
        }
        localStorage.setItem("davveroId_cached_member", JSON.stringify(foundMember));
        if (foundMember.name) localStorage.setItem("davveroId_guest_name", foundMember.name);
        if (foundMember.email) localStorage.setItem("davveroId_guest_email", foundMember.email);

        // Enroll member directly in this event
        await enrollStudent({
          eventId: event.id,
          studentId: foundMember.id,
          status: "inscrito",
          timestamp: new Date().toISOString(),
        });

        setResolvedMember(foundMember);
        setMode("success");

        if (event.googleFormsLink) {
          const link = event.googleFormsLink.startsWith("http")
            ? event.googleFormsLink
            : `https://${event.googleFormsLink}`;
          setTimeout(() => window.open(link, "_blank"), 1500);
        }
      } else {
        // Not found: prefill CPF if numeric and show choices
        if (numericCpf.length === 11) {
          setCpf(formatCPF(numericCpf));
        }
        setVerifyError("Nenhum cadastro localizado com estes dados. Escolha abaixo como deseja se cadastrar.");
        setMode("choice");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      showAlert("Erro ao verificar cadastro. Tente novamente.", { type: "error" });
    } finally {
      setSearchingMember(false);
    }
  };

  // Submit Quick Registration
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Mandatory Validations: Nome Completo, CPF, Vínculo, E-mail
    if (!name.trim() || name.trim().length < 3) {
      showAlert("Por favor, preencha seu Nome Completo (mínimo 3 caracteres).", {
        type: "warning",
      });
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (!cleanCpf) {
      showAlert("O CPF é obrigatório para o cadastro.", { type: "warning" });
      return;
    }

    if (!isValidCPF(cleanCpf)) {
      showAlert("CPF inválido. Por favor, verifique os 11 dígitos digitados.", {
        type: "warning",
      });
      return;
    }

    const roleToUse = isCustomRole ? customRole.trim().toUpperCase() : selectedRole;
    if (!roleToUse) {
      showAlert("Por favor, selecione seu Vínculo Institucional.", {
        type: "warning",
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      showAlert("O E-mail é obrigatório para confirmação.", {
        type: "warning",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showAlert("Por favor, digite um endereço de e-mail válido.", {
        type: "warning",
      });
      return;
    }

    if (!consent) {
      showAlert("É necessário aceitar os termos da LGPD para prosseguir.", {
        type: "warning",
      });
      return;
    }

    setLoading(true);

    try {
      const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);

      // Check if student already exists by CPF
      const qCpf = query(studentsRef, where("cpf", "==", cleanCpf));
      const snapCpf = await getDocs(qCpf);

      let targetMember: Member | null = null;
      if (!snapCpf.empty) {
        const activeDoc = snapCpf.docs.find((d) => !d.data().deletedAt);
        if (activeDoc) {
          targetMember = { id: activeDoc.id, ...activeDoc.data() } as Member;
        }
      }

      // Check if student exists by email
      if (!targetMember) {
        const qEmail = query(studentsRef, where("email", "==", cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const activeDoc = snapEmail.docs.find((d) => !d.data().deletedAt);
          if (activeDoc) {
            targetMember = { id: activeDoc.id, ...activeDoc.data() } as Member;
          }
        }
      }

      const generatedAlphaCode =
        targetMember?.alphaCode ||
        Array(6)
          .fill(0)
          .map(() =>
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
              Math.floor(Math.random() * 36)
            ]
          )
          .join("");

      if (!targetMember) {
        // Check auto-approval rules from settings
        const isAutoApproved = checkAutoApproval(
          {
            name: name.trim(),
            cpf: cleanCpf,
            email: cleanEmail,
            alphaCode: generatedAlphaCode,
          },
          settings
        );

        // Create new member record (RA é opcional)
        const newStudentPayload: Omit<Member, "id"> = {
          name: name.trim(),
          cpf: cleanCpf,
          email: cleanEmail,
          ra: ra.trim() ? ra.trim() : undefined,
          whatsappNumber: phone.trim() ? phone.trim() : undefined,
          roles: [roleToUse],
          isApproved: isAutoApproved,
          isActive: isAutoApproved,
          status: isAutoApproved ? "VALID" : "PENDING",
          hasPendingAction: !isAutoApproved,
          alphaCode: generatedAlphaCode,
          createdAt: new Date().toISOString(),
          acceptedTermsVersion: settings?.termsVersion || 1,
        };

        const docRef = await addDoc(studentsRef, newStudentPayload);
        targetMember = { ...newStudentPayload, id: docRef.id } as Member;

        // Notify Admins about new pending registration if not auto-approved
        if (!isAutoApproved) {
          try {
            await createNotification({
              recipientId: "admin",
              title: "Novo Cadastro Pendente",
              message: `O participante ${name.trim()} (${roleToUse}) realizou cadastro rápido e aguarda aprovação da carteirinha.`,
              type: "carteirinha",
            });
          } catch (e) {
            console.warn("Notification error:", e);
          }
        }
      } else {
        // Update existing member's RA if not set and provided now
        if (ra.trim() && !targetMember.ra) {
          try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, targetMember.id), {
              ra: ra.trim()
            });
            targetMember.ra = ra.trim();
          } catch (e) {
            console.warn("Could not update RA:", e);
          }
        }
      }

      // Enroll in event
      await enrollStudent({
        eventId: event.id,
        studentId: targetMember.id,
        status: "inscrito",
        timestamp: new Date().toISOString(),
      });

      // Save local preferences
      localStorage.setItem("davveroId_guest_name", name.trim());
      localStorage.setItem("davveroId_guest_email", cleanEmail);
      if (phone.trim()) localStorage.setItem("davveroId_guest_phone", phone.trim());
      localStorage.setItem("davveroId_student_identity", generatedAlphaCode);
      localStorage.setItem("davveroId_cached_member", JSON.stringify(targetMember));

      setResolvedMember(targetMember);
      setMode("success");

      // Handle external Forms link if present
      if (event.googleFormsLink) {
        const link = event.googleFormsLink.startsWith("http")
          ? event.googleFormsLink
          : `https://${event.googleFormsLink}`;
        setTimeout(() => window.open(link, "_blank"), 1800);
      }
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
        showAlert("Erro ao processar inscrição. Tente novamente.", {
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // If user selected Full Complete Registration modal
  if (mode === "full") {
    return (
      <PublicRequestModal
        eventId={event.id}
        onClose={onClose}
        onSubmitSuccess={(createdMember) => {
          showAlert("Solicitação de cadastro completo enviada com sucesso e inscrição vinculada ao evento! Aguarde a homologação da secretaria.", {
            type: "success",
          });
          if (createdMember) {
            onSuccess(createdMember);
          }
          onClose();
        }}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
      {showTerms && (
        <TermsOfUseModal
          onClose={() => setShowTerms(false)}
          onAccept={() => {
            setConsent(true);
            setShowTerms(false);
          }}
        />
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {mode !== "choice" && mode !== "success" ? (
              <button
                type="button"
                onClick={() => setMode("choice")}
                className="mt-0.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Voltar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                Inscrição no Evento
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white line-clamp-1 leading-snug">
                {event.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(event.startDate).toLocaleDateString("pt-BR")}
                </span>
                <span className="flex items-center gap-1 font-medium capitalize">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {event.format || "Presencial"}
                </span>
                {event.isPaid && (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {(event.price || 0).toFixed(2).replace(".", ",")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {/* STEP 1: CHOICE SCREEN (Cadastro Rápido vs Cadastro Completo) */}
          {mode === "choice" && (
            <div className="space-y-4">
              <div className="text-center sm:text-left mb-1">
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  Escolha o tipo de cadastro
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Selecione como deseja criar sua inscrição para participar do evento.
                </p>
              </div>

              {/* Notice Banner - Importante sobre a carteirinha */}
              <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-2xl flex items-start gap-3 shadow-xs">
                <BadgeInfo className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <strong>Aviso:</strong> Para adquirir e emitir a sua <strong>Carteirinha Estudantil Digital Oficial</strong> com foto, é necessário optar pelo <strong>Cadastro Completo</strong>. O Cadastro Rápido é voltado exclusivamente para a inscrição rápida no evento.
                </p>
              </div>

              {/* Choice 1: Cadastro Rápido */}
              <div
                onClick={() => setMode("quick")}
                className="group relative p-4 sm:p-5 rounded-2xl border-2 border-sky-300 dark:border-sky-800/80 hover:border-sky-500 dark:hover:border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-all cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-800 dark:text-white text-base">
                          Cadastro Rápido
                        </h5>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-sky-200 dark:bg-sky-800 text-sky-800 dark:text-sky-200 rounded-full">
                          Mais Rápido
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Inscrição simplificada e direta com dados essenciais para o evento.
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          ✓ Nome Completo *
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          ✓ CPF *
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          ✓ Vínculo *
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          ✓ E-mail *
                        </span>
                        <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          • RA (Opcional)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 border border-sky-200 dark:border-sky-700 shadow-xs group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Choice 2: Cadastro Completo */}
              <div
                onClick={() => setMode("full")}
                className="group relative p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-all cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-800 dark:text-white text-base">
                          Cadastro Completo
                        </h5>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full">
                          Identidade Estudantil
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Solicitação completa de Carteirinha Estudantil com foto de perfil, diocese, seminário, curso e dados acadêmicos.
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          + Foto de Perfil
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          + Diocese & Seminário
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          + Curso Acadêmico
                        </span>
                        <span className="text-[10px] font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          + Carteirinha Oficial
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-200 dark:border-indigo-700 shadow-xs group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Option to check existing registration */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setMode("verify")}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>Já possui cadastro? Entrar com CPF, RA ou Código</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FORMULÁRIO CADASTRO RÁPIDO */}
          {mode === "quick" && (
            <form onSubmit={handleQuickSubmit} className="space-y-4">
              {/* Top Warning Alert - Carteirinha requer cadastro completo */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Aviso Importante sobre a Carteirinha:
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium mt-0.5">
                    O cadastro rápido garante a sua <strong>inscrição e presença no evento</strong>. No entanto, para <strong>adquirir e emitir a Carteirinha Estudantil Digital oficial</strong>, será necessário realizar o <strong>Cadastro Completo</strong>.
                  </p>
                </div>
              </div>

              {/* 1. Nome Completo (Obrigatório) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Nome Completo *</span>
                  <span className="text-[10px] text-rose-500 font-bold lowercase">obrigatório</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva Santos"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* 2. CPF (Obrigatório) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>CPF *</span>
                  <span className="text-[10px] text-rose-500 font-bold lowercase">obrigatório</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={14}
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all font-mono"
                  />
                </div>
                {cpf.length > 0 && cpf.replace(/\D/g, "").length === 11 && !isValidCPF(cpf) && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    Número de CPF inválido. Verifique os dígitos digitados.
                  </p>
                )}
              </div>

              {/* 3. Vínculo Institucional (Obrigatório) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Vínculo Institucional *</span>
                  <span className="text-[10px] text-rose-500 font-bold lowercase">obrigatório</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {availableRoles.map((role) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() => {
                        setSelectedRole(role);
                        setIsCustomRole(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                        !isCustomRole && selectedRole === role
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs scale-[1.02]"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomRole(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      isCustomRole
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs scale-[1.02]"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    + Outro
                  </button>
                </div>
                {isCustomRole && (
                  <input
                    type="text"
                    required
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="Digite seu vínculo (Ex: Pesquisador, Palestrante...)"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white uppercase font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                )}
              </div>

              {/* 4. E-mail (Obrigatório) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>E-mail *</span>
                  <span className="text-[10px] text-rose-500 font-bold lowercase">obrigatório</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* 5. RA - Registro Acadêmico (Opcional) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    RA (Registro Acadêmico)
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase">opcional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ra}
                    onChange={(e) => setRa(e.target.value)}
                    placeholder="Ex: 20260199 (opcional)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 pl-1">
                  Se você já estuda na instituição e possui RA, pode informá-lo aqui.
                </p>
              </div>

              {/* 6. WhatsApp / Telefone (Opcional) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>WhatsApp / Telefone</span>
                  <span className="text-[10px] text-slate-400 lowercase">opcional</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    maxLength={15}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* LGPD Consent */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-700 mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                    Concordo com os{" "}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-sky-600 dark:text-sky-400 font-bold underline hover:text-sky-500"
                    >
                      Termos de Uso e Política de Privacidade (LGPD)
                    </button>{" "}
                    para inscrição e processamento dos dados.
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setMode("choice")}
                  className="px-4 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando Inscrição...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Cadastro & Inscrição</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: PRE-ENROLLMENT VERIFICATION (Check if user has account) */}
          {mode === "verify" && (
            <div className="space-y-5">
              <div className="text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-black uppercase tracking-wider mb-2">
                  <UserCheck className="w-3.5 h-3.5" /> Consulta de Cadastro
                </div>
                <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                  Já possui cadastro no sistema?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Informe seu <strong>CPF</strong> ou <strong>RA</strong> abaixo para efetuar a sua inscrição com sua conta existente.
                </p>
              </div>

              {verifyError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                    {verifyError}
                  </p>
                </div>
              )}

              <form onSubmit={handleVerifyExisting} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    CPF, RA ou Código de 6 Dígitos
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      required
                      value={verifyInput}
                      onChange={(e) => setVerifyInput(e.target.value)}
                      placeholder="Digite seu CPF ou RA cadastrado"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-1">
                    Ex: 123.456.789-00, 2026001 ou seu e-mail cadastrado
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={searchingMember}
                  className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {searchingMember ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando Cadastro...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Verificar Cadastro e Inscrever-se</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700/80" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-bold text-[10px] tracking-widest">
                    Ou crie um novo cadastro
                  </span>
                </div>
              </div>

              {/* Still don't have account button */}
              <button
                type="button"
                onClick={() => setMode("choice")}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
              >
                <Sparkles className="w-4 h-4 text-sky-500" />
                <span>Escolher Cadastro Rápido ou Completo</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              </button>
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {mode === "success" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 dark:ring-emerald-950/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-800 dark:text-white">
                  Inscrição Confirmada!
                </h4>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  {resolvedMember?.name ? (
                    <>Olá, <strong>{resolvedMember.name}</strong>! Você está devidamente inscrito(a) no evento <strong>{event.title}</strong>.</>
                  ) : (
                    <>Você está devidamente inscrito(a) no evento <strong>{event.title}</strong>.</>
                  )}
                </p>
              </div>

              {/* Status Notice */}
              {resolvedMember?.isApproved === true ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 text-left space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Carteirinha Digital Válida & Aprovada
                    </p>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed font-medium">
                    Seu cadastro está ativo e validado! Você já pode acessar sua carteirinha digital no Portal do Aluno/Participante.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <CardRequirementsAnimation member={resolvedMember} compact={true} />
                  
                  {resolvedMember?.alphaCode && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between text-left">
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        Código de Acompanhamento:
                      </span>
                      <span className="text-xs font-black tracking-widest text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-md font-mono border border-amber-300 dark:border-amber-700">
                        {resolvedMember.alphaCode}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* External link button */}
              {event.googleFormsLink && (
                <div className="pt-1">
                  <a
                    href={
                      event.googleFormsLink.startsWith("http")
                        ? event.googleFormsLink
                        : `https://${event.googleFormsLink}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Acessar Formulário do Evento</span>
                  </a>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (resolvedMember) onSuccess(resolvedMember);
                    onClose();
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
