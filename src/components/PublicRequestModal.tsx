import { useState, useEffect, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Save, 
  ShieldCheck, 
  Image as ImageIcon, 
  Zap, 
  FileCheck2, 
  ArrowLeft, 
  GraduationCap, 
  Landmark, 
  BookOpen, 
  Briefcase, 
  Cross, 
  Church, 
  UserCheck, 
  Plus, 
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  User,
  CreditCard,
  Calendar,
  Building2
} from 'lucide-react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, appId, enrollStudent, createNotification } from '../lib/firebase';
import { checkAutoApproval } from '../lib/approval';
import { sendEmailNotification, getCompiledEmail, parseEmailList } from '../lib/emailService';
import { useSettings } from '../context/SettingsContext';
import type { Member } from '../types';
import ImageCropperModal from './ImageCropperModal';
import { AVAILABLE_SEMINARIES } from '../types';
import TermsOfUseModal from './TermsOfUseModal';
import { playSound } from '../lib/sounds';

interface PublicRequestModalProps {
  onClose: () => void;
  onSubmitSuccess: (createdMember?: Member) => void;
  eventId?: string;
  initialRole?: string;
}

type RegistrationStep = 'role' | 'mode' | 'form';
type RegistrationMode = 'quick' | 'full';

export default function PublicRequestModal({ onClose, onSubmitSuccess, eventId, initialRole }: PublicRequestModalProps) {
  const { settings } = useSettings();
  
  // Step state
  const [step, setStep] = useState<RegistrationStep>(initialRole ? 'mode' : 'role');
  const [regMode, setRegMode] = useState<RegistrationMode>('quick');

  // Form states
  const [name, setName] = useState('');
  const [ra, setRa] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [roles, setRoles] = useState<string[]>(initialRole ? [initialRole] : []);
  const [newRole, setNewRole] = useState('');
  
  const [course, setCourse] = useState('');
  const [diocese, setDiocese] = useState('');
  const [newDiocese, setNewDiocese] = useState('');
  const [seminary, setSeminary] = useState(AVAILABLE_SEMINARIES[0] || '');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const baseCourses = ["FILOSOFIA", "FILOSOFIA EAD", "TEOLOGIA", "TEOLOGIA EAD"];
  const availableCourses = [...baseCourses, ...(settings.customCourses || [])];

  const baseRoles = [
    { id: "ALUNO(A)", label: "Aluno(a)", desc: "Graduação, Pós ou Extensão", icon: GraduationCap, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800" },
    { id: "SEMINARISTA", label: "Seminarista", desc: "Formação Presbiteral", icon: Landmark, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
    { id: "PROFESSOR(A)", label: "Professor(a)", desc: "Corpo Docente e Acadêmico", icon: BookOpen, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
    { id: "COLABORADOR(A)", label: "Colaborador(a)", desc: "Secretaria e Equipe", icon: Briefcase, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
    { id: "PADRE", label: "Padre / Presbítero", desc: "Clero Diocesano ou Religioso", icon: Cross, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
    { id: "DIÁCONO", label: "Diácono / Religioso(a)", desc: "Diaconato ou Vida Consagrada", icon: Church, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800" },
    { id: "VISITANTE", label: "Visitante / Externo", desc: "Eventos, Palestras e Cursos", icon: UserCheck, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  ];

  const baseDioceses = ["MARÍLIA", "ASSIS", "LINS", "BAURU", "OURINHOS", "PRESIDENTE PRUDENTE", "ARAÇATUBA", "BOTUCATU"];
  const availableDioceses = [...baseDioceses, ...(settings.customDioceses || [])];

  const toggleRole = (role: string) => {
    playSound('pop');
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const selectSingleRoleAndAdvance = (role: string) => {
    playSound('click');
    setRoles([role]);
    setStep('mode');
  };

  const handleAddRole = async () => {
    if (newRole.trim()) {
      const formatted = newRole.trim().toUpperCase();
      if (!roles.includes(formatted)) {
        setRoles(prev => [...prev, formatted]);
      }
      setNewRole('');
    }
  };

  const handleAddDiocese = async () => {
    if (newDiocese.trim() && !availableDioceses.includes(newDiocese.trim().toUpperCase())) {
      const formatted = newDiocese.trim().toUpperCase();
      setDiocese(formatted);
      setNewDiocese('');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropImageSrc(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const formatCpfInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async () => {
    setError('');

    // Validations based on chosen mode
    if (!name.trim() || !email.trim()) {
      setError('Por favor, informe seu Nome Completo e E-mail.');
      return;
    }

    if (roles.length === 0) {
      setError('Por favor, selecione ao menos um perfil ou vínculo.');
      return;
    }

    const cleanCpf = cpf.trim().replace(/\D/g, "");
    if (!cleanCpf) {
      setError('O CPF é obrigatório no cadastro para que você consiga localizar seu cadastro depois na aba "MINHA ID".');
      return;
    }

    if (cleanCpf.length !== 11) {
      setError('Por favor, digite um CPF válido com 11 dígitos numéricos.');
      return;
    }

    if (regMode === 'full') {
      if (!birthdate) {
        setError('Data de Nascimento é obrigatória no cadastro completo.');
        return;
      }
      if (!diocese) {
        setError('Por favor, selecione sua Diocese de Origem.');
        return;
      }
    }

    if (!consent) {
      setError('É necessário aceitar os Termos de Uso e a Política de Privacidade (LGPD) para prosseguir.');
      return;
    }

    setLoading(true);

    try {
      const formattedRa = ra.trim();
      const cleanCpf = cpf.trim().replace(/\D/g, "");
      const membersRef = collection(db, `artifacts/${appId}/public/data/students`);

      if (formattedRa) {
        const qRa = query(membersRef, where('ra', '==', formattedRa));
        const raSnapshot = await getDocs(qRa);
        const existingActive = raSnapshot.docs.find(doc => !doc.data().deletedAt);
        if (existingActive) {
          setError(`Este RA (${formattedRa}) já está cadastrado no sistema.`);
          setLoading(false);
          return;
        }
      }

      if (cleanCpf) {
        const qCpf = query(membersRef, where('cpf', '==', cleanCpf));
        const cpfSnapshot = await getDocs(qCpf);
        const existingCpf = cpfSnapshot.docs.find(doc => !doc.data().deletedAt);
        if (existingCpf) {
          setError(`Este CPF (${cpf.trim()}) já possui cadastro no sistema. Acesse a aba "MINHA ID" para consultar sua carteirinha ou solicite ajuda à secretaria.`);
          setLoading(false);
          return;
        }
      }

      const alphaCode = Array(6).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

      const isAutoApproved = checkAutoApproval(
        {
          name: name.trim(),
          cpf: cleanCpf,
          ra: formattedRa,
          email: email.trim().toLowerCase(),
          alphaCode,
        },
        settings
      );

      const isVisitor = roles.includes("VISITANTE") || roles.length === 0;

      const payload: Partial<Member> = {
        name: name.trim(),
        ra: formattedRa,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        cpf: cleanCpf,
        birthdate: birthdate || (regMode === 'quick' ? '' : undefined),
        roles: roles.length > 0 ? roles : ["ALUNO(A)"],
        course: course || (regMode === 'quick' ? '' : undefined),
        diocese: diocese || (regMode === 'quick' ? 'GERAL' : ''),
        seminary: seminary || (roles.includes("SEMINARISTA") || roles.includes("PADRE") ? AVAILABLE_SEMINARIES[0] : ''),
        photoUrl: photoBase64,
        isApproved: isAutoApproved,
        isActive: isAutoApproved,
        status: isAutoApproved ? "VALID" : "PENDING",
        hasPendingAction: !isAutoApproved,
        alphaCode,
        acceptedTermsVersion: settings.termsVersion || 1,
        registrationType: regMode,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/students`), payload);
      const createdMember = { ...payload, id: docRef.id } as Member;

      // Notify Admins about new registration if not auto-approved
      if (!isAutoApproved) {
        try {
          await createNotification({
            recipientId: "admin",
            title: `Novo Cadastro (${regMode === 'quick' ? 'Rápido' : 'Completo'})`,
            message: `Nova solicitação de ${name.trim()} (${roles.join(", ") || "Aluno"}) aguardando homologação.`,
            type: "carteirinha",
          });
        } catch (notifErr) {
          console.warn("Notification trigger failed:", notifErr);
        }

        // Enviar e-mail de alerta para a Secretaria
        if (settings.emailNotificationsEnabled !== false && settings.notifySecretariatOnNewRequest !== false) {
          const rawSecretariat = settings.secretariatNotificationEmail || "secretaria@fajopa.edu.br";
          const secretariatEmails = parseEmailList(rawSecretariat);

          if (secretariatEmails.length > 0) {
            const compiledSecretariat = getCompiledEmail({
              templateKey: 'newRequestSecretariat',
              customTemplates: settings.emailTemplates,
              vars: {
                name: name.trim(),
                roles: roles.join(', ') || 'Não especificado',
                course: course || (regMode === 'quick' ? 'Cadastro Rápido' : 'Não especificado'),
                diocese: diocese || '',
                seminary: seminary || '',
                email: email.trim(),
                ra: formattedRa || 'Não informado',
                alphaCode: alphaCode
              },
              settings,
              buttonUrl: `${window.location.origin}/?admin=true`
            });

            sendEmailNotification({
              to: secretariatEmails,
              subject: compiledSecretariat.subject,
              html: compiledSecretariat.fullHtml
            }, settings.smtpConfig).catch(e => console.warn("Erro ao notificar secretaria:", e));
          }
        }
      }

      // If tied to an event enrollment, enroll student right away
      if (eventId) {
        try {
          await enrollStudent({
            eventId,
            studentId: docRef.id,
            status: "inscrito",
            timestamp: new Date().toISOString(),
          });
        } catch (enrollErr) {
          console.error("Error enrolling into event from registration:", enrollErr);
        }
      }

      // Enviar e-mail de confirmação para o Usuário
      if (email.trim() && settings.emailNotificationsEnabled !== false && settings.notifyStudentOnPending !== false) {
        try {
          const compiledStudent = getCompiledEmail({
            templateKey: isAutoApproved ? 'approvedStudent' : 'pendingStudent',
            customTemplates: settings.emailTemplates,
            vars: {
              name: name.trim(),
              roles: roles.join(', ') || 'Participante',
              course: course || (regMode === 'quick' ? 'Cadastro Expresso' : 'Não especificado'),
              diocese: diocese || '',
              seminary: seminary || '',
              email: email.trim(),
              ra: formattedRa || '',
              alphaCode: alphaCode
            },
            settings,
            buttonUrl: `${window.location.origin}/?id=${alphaCode}`
          });

          await sendEmailNotification({
            to: email.trim(),
            subject: compiledStudent.subject,
            html: compiledStudent.fullHtml
          }, settings.smtpConfig);
        } catch(mailErr) {
          console.warn("Mail trigger failed, continuing...", mailErr);
        }
      }

      playSound('success');
      onSubmitSuccess(createdMember);
    } catch (e) {
      console.error(e);
      playSound('error');
      setError('Falha de comunicação. Não foi possível processar sua solicitação neste momento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[100] overflow-y-auto">
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={(croppedBase64) => {
            setPhotoBase64(croppedBase64);
            setCropImageSrc(null);
          }}
        />
      )}
      
      <div className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 w-full max-w-xl animated-scale-in my-auto max-h-[92vh] flex flex-col relative overflow-y-auto custom-scrollbar">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            {step !== 'role' && (
              <button 
                onClick={() => {
                  playSound('pop');
                  if (step === 'form') setStep('mode');
                  else if (step === 'mode') setStep('role');
                }}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                title="Voltar ao passo anterior"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                  {step === 'role' ? 'Passo 1 de 3' : step === 'mode' ? 'Passo 2 de 3' : 'Passo 3 de 3'}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">• Primeiro Acesso</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mt-0.5">
                {step === 'role' && 'Quem é você?'}
                {step === 'mode' && 'Escolha o Tipo de Cadastro'}
                {step === 'form' && (regMode === 'quick' ? '⚡ Cadastro Rápido' : '📑 Cadastro Completo Oficial')}
              </h2>
            </div>
          </div>

          <button 
            onClick={() => {
              playSound('pop');
              onClose();
            }} 
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* STEP 1: SELECT PERSON TYPE / ROLE */}
        {step === 'role' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Selecione o seu perfil principal para continuarmos. Você poderá adicionar outros vínculos posteriormente:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">
              {baseRoles.map((r) => {
                const Icon = r.icon;
                const isSelected = roles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => selectSingleRoleAndAdvance(r.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 group relative hover:scale-[1.01] ${
                      isSelected 
                        ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 shadow-sm ring-2 ring-sky-400/30' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl border shrink-0 ${r.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                          {r.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-500" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-1">
                        {r.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Role Input */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input 
                type="text" 
                value={newRole} 
                onChange={e => setNewRole(e.target.value)} 
                placeholder="Outro perfil não listado..." 
                className="input-modern flex-1 rounded-xl py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newRole.trim()) {
                      handleAddRole();
                      setStep('mode');
                    }
                  }
                }}
              />
              <button 
                onClick={() => {
                  if (newRole.trim()) {
                    handleAddRole();
                    setStep('mode');
                  }
                }}
                disabled={!newRole.trim()}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Avançar
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE REGISTRATION TYPE (RAPIDO VS COMPLETO) */}
        {step === 'mode' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2.5 rounded-2xl">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Perfil Selecionado: <strong>{roles.join(', ') || 'Participante'}</strong>
              </span>
              <button 
                onClick={() => {
                  playSound('pop');
                  setStep('role');
                }}
                className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Alterar perfil
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Escolha a modalidade de cadastro mais conveniente para a sua necessidade:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Option A: Cadastro Rápido */}
              <button
                onClick={() => {
                  playSound('click');
                  setRegMode('quick');
                  setStep('form');
                }}
                className="group p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-800/60 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all duration-200 hover:shadow-lg relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> 1 minuto
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                      Avançar →
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                    ⚡ Cadastro Rápido
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Ideal para acesso imediato a <strong>eventos, palestras, cursos e certificados</strong> sem burocracia.
                  </p>
                </div>

                <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/40 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Nome, E-mail, Celular e CPF (obrigatório para Minha ID)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sem necessidade de foto agora
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Acesso instantâneo com código
                  </div>
                </div>
              </button>

              {/* Option B: Cadastro Completo */}
              <button
                onClick={() => {
                  playSound('click');
                  setRegMode('full');
                  setStep('form');
                }}
                className="group p-5 rounded-2xl border-2 border-sky-200 dark:border-sky-900/60 bg-gradient-to-b from-sky-50/50 to-white dark:from-sky-950/20 dark:to-slate-800/60 hover:border-sky-500 dark:hover:border-sky-500 text-left transition-all duration-200 hover:shadow-lg relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" /> Oficial / DNE
                    </span>
                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                      Avançar →
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-800 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 mb-1.5 flex items-center gap-1.5">
                    📑 Cadastro Completo
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Ideal para emissão da <strong>Carteirinha Digital oficial</strong>, acesso acadêmico pleno e biblioteca.
                  </p>
                </div>

                <div className="pt-3 border-t border-sky-100 dark:border-sky-900/40 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" /> Foto oficial com recorte facial
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" /> RA, Curso, Diocese e Seminário
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" /> Homologação com selo oficial
                  </div>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* STEP 3: FORM ACCORDING TO CHOSEN MODE */}
        {step === 'form' && (
          <div className="space-y-4">
            
            {/* Quick Switch Banner */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                  regMode === 'quick' 
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                }`}>
                  {regMode === 'quick' ? '⚡ Rápido' : '📑 Completo'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {roles.join(', ') || 'Participante'}
                </span>
              </div>

              <button
                onClick={() => {
                  playSound('pop');
                  setRegMode(prev => prev === 'quick' ? 'full' : 'quick');
                }}
                className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                Mudar para {regMode === 'quick' ? 'Cadastro Completo' : 'Cadastro Rápido'}
              </button>
            </div>

            {/* FORM FIELDS */}
            <div className="space-y-3.5">
              
              {/* Nome */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Nome Completo *
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Seu nome completo" 
                  className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail para Contato & Certificados *
                </label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="seuemail@exemplo.com" 
                  className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                />
              </div>

              {/* Grid: Celular/Phone & CPF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp / Celular
                  </label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(formatPhoneInput(e.target.value))} 
                    placeholder="(00) 00000-0000" 
                    className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-rose-500 shrink-0" /> CPF *
                    </span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold lowercase tracking-normal">
                      obrigatório para Minha ID
                    </span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={cpf} 
                    onChange={e => setCpf(formatCpfInput(e.target.value))} 
                    placeholder="000.000.000-00 (obrigatório)" 
                    className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-sky-500" 
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Obrigatório para que você encontre e acerte seu cadastro depois na aba <strong>MINHA ID</strong>.
                  </p>
                </div>
              </div>

              {/* Full Registration Extra Fields */}
              {regMode === 'full' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> RA (Registro Acadêmico)
                      </label>
                      <input 
                        type="text" 
                        value={ra} 
                        onChange={e => setRa(e.target.value)} 
                        placeholder="Ex: 20240123" 
                        className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Data de Nascimento *
                      </label>
                      <input 
                        type="date" 
                        value={birthdate} 
                        onChange={e => setBirthdate(e.target.value)} 
                        className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm uppercase bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Curso Acadêmico
                    </label>
                    <select 
                      value={course} 
                      onChange={e => setCourse(e.target.value)} 
                      className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    >
                      <option value="">Nenhum / Não aplicável / Geral</option>
                      {availableCourses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Diocese */}
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> Diocese ou Região {regMode === 'full' ? '*' : ''}
                </label>
                <div className="flex gap-2">
                  <select 
                    value={diocese} 
                    onChange={e => setDiocese(e.target.value)} 
                    className="input-modern flex-1 rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  >
                    <option value="">Selecionar Diocese / Cidade</option>
                    {availableDioceses.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <input 
                      type="text" 
                      value={newDiocese} 
                      onChange={e => setNewDiocese(e.target.value)} 
                      placeholder="Outra" 
                      className="input-modern w-20 rounded-xl py-2.5 px-2.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDiocese())}
                    />
                    <button 
                      onClick={handleAddDiocese}
                      className="px-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors"
                      title="Adicionar Diocese"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Seminário (se seminarista/padre ou cadastro completo) */}
              {(roles.includes("SEMINARISTA") || roles.includes("PADRE") || regMode === 'full') && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-slate-400" /> Seminário Vinculado
                  </label>
                  <select 
                    value={seminary} 
                    onChange={e => setSeminary(e.target.value)} 
                    className="input-modern w-full rounded-xl py-2.5 px-3.5 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  >
                    <option value="">Selecione um Seminário (ou Geral)</option>
                    {AVAILABLE_SEMINARIES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Photo Upload (Required/Recommended for Full, Optional for Quick) */}
              {regMode === 'full' && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" /> Fotografia Pessoal (Rosto)
                  </label>
                  <div className="flex items-center gap-3">
                    {photoBase64 ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-sky-400 shadow-sm shrink-0">
                        <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-sky-300 dark:border-sky-700/60 bg-sky-50/50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors text-xs font-bold">
                      <ImageIcon className="w-4 h-4 text-sky-500" />
                      {photoBase64 ? 'Substituir Foto' : 'Escolher e Recortar Foto'}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>
              )}

            </div>

            {/* Terms and Consent Box */}
            <div className="mt-4 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <input 
                type="checkbox" 
                id="lgpd-consent" 
                checked={consent} 
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-sky-600 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 shrink-0"
              />
              <div className="flex-1">
                <label htmlFor="lgpd-consent" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer hover:text-sky-600 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Termos de Uso e Política de Privacidade (LGPD)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Declaro que li e concordo com os{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-sky-600 dark:text-sky-400 font-bold hover:underline">
                    Termos de Uso, Pagamentos e Privacidade
                  </button>
                  , autorizando o tratamento de meus dados cadastrais.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              onClick={handleSubmit} 
              disabled={loading} 
              className={`mt-4 btn-modern w-full py-3.5 px-4 rounded-2xl shadow-lg text-sm font-bold text-white flex justify-center gap-2 items-center transition-all ${
                regMode === 'quick'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                  : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-sky-600/20'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processando Cadastro...
                </>
              ) : regMode === 'quick' ? (
                <>
                  <Zap className="w-4 h-4" /> Concluir Cadastro Rápido
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Enviar Solicitação Completa
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {showTerms && <TermsOfUseModal onClose={() => setShowTerms(false)} />}
    </div>,
    document.body
  );
}
