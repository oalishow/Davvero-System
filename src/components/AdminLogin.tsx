import { useState, useEffect } from "react";
import { Mail, KeyRound, UserPlus, LogIn, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PASSWORD_STORAGE_KEY, DEFAULT_ADMIN_PASSWORD } from "../lib/constants";
import { auth } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";

import { useDialog } from "../context/DialogContext";
import { playSound } from '../lib/sounds';

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [masterConfirm, setMasterConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showAlert } = useDialog();

  useEffect(() => {
    // Clear fields and error when switching tabs
    setError(null);
    setSuccessMsg(null);
    setMasterConfirm("");
  }, [activeTab]);

  const handleAction = async () => {
    if (!email || !emailPassword) {
      setError("Preencha e-mail e senha.");
      return;
    }

    const isRegister = activeTab === "register";
    let resolvedRole = "ADMIN";
    let inviteDocRef: any = null;

    if (isRegister) {
      let skipMaster = false;
      try {
        const { doc: getDocRef, getDoc } = await import("firebase/firestore");
        const { db, appId } = await import("../lib/firebase");
        inviteDocRef = getDocRef(db, `artifacts/${appId}/public/data/admin_invites`, email.toLowerCase());
        const inviteSnap = await getDoc(inviteDocRef);
        if (inviteSnap.exists()) {
          skipMaster = true;
          resolvedRole = (inviteSnap.data() as any)?.role || "ADMIN";
        }
      } catch (e) {
        console.error(e);
      }

      if (!skipMaster) {
        if (!masterConfirm) {
           setError("A Senha Mestra é necessária para registrar.");
           return;
        }

        const storedMaster =
          localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
        if (masterConfirm !== storedMaster) {
          setError("Senha Mestra incorreta. Um convite prévio é necessário se não usar a senha mestra.");
          return;
        }
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email, emailPassword);
        
        // Remove administrator save since we no longer manage access there
        if (inviteDocRef) {
          try {
            const { deleteDoc } = await import("firebase/firestore");
            await deleteDoc(inviteDocRef);
          } catch(e) {}
        }
        
        await showAlert("Administrador registrado com sucesso!", { type: 'success' });
      } else {
        await signInWithEmailAndPassword(auth, email, emailPassword);
        await showAlert("Logado com sucesso!", { type: 'success', title: 'Bem-vindo(a)' });
      }
      playSound('login');
      onLogin();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.");
      } else if (err.code === "auth/wrong-password") {
        setError("Senha incorreta.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else if (err.code === "auth/weak-password") {
         setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Erro ao autenticar: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const isRegister = activeTab === "register";
    let inviteDocRef: any = null;

    if (isRegister) {
      if (!masterConfirm) {
         setError("A Senha Mestra é necessária para registrar.");
         return;
      }
      const storedMaster = localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
      if (masterConfirm !== storedMaster) {
        setError("Senha Mestra incorreta.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
         prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      
      if (isRegister) {
        await showAlert("Administrador registrado com sucesso via Google!", { type: 'success' });
      } else {
        await showAlert("Logado com sucesso!", { type: 'success', title: 'Bem-vindo(a)' });
      }
      playSound('login');
      onLogin();
    } catch (err: any) {
      console.error("Autenticação Google erro:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Login com o Google cancelado pela janela.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domínio não autorizado no Firebase. Adicione a URL atual em Authentication > Settings > Authorized domains.");
      } else if (err.message && err.message.includes("Cross-Origin")) {
        setError("Erro de permissão no navegador. Se estiver no preview, abra o app em uma nova guia.");
      } else {
        // Fallback genérico melhorado
        setError("Erro de autenticação com o Google. Se estiver vendo isso dentro de uma pré-visualização ou iframe, tente abrir o aplicativo em uma NOVA GUIA no navegador. Detalhe: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Preencha o campo de e-mail para recuperar a senha.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("E-mail de redefinição de senha enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("Usuário não encontrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("E-mail inválido.");
      } else {
        setError("Erro ao enviar e-mail de recuperação: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-2xl w-full max-w-sm mx-auto overflow-hidden flex flex-col animated-scale-in">
      {/* Header and Tabs */}
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 pt-6 px-6 relative">
        <div className="w-12 h-12 bg-indigo-500 rounded-full flex flex-col items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-center text-slate-800 dark:text-white tracking-tight mb-6">
          Acesso Reservado
        </h1>

        <div className="flex bg-slate-200/50 dark:bg-slate-800 rounded-xl p-1 mb-6 relative">
            <motion.div 
               className="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm"
               animate={{ x: activeTab === 'login' ? 0 : '100%' }}
               transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
            <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 relative z-10 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'login' ? 'text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <LogIn className="w-4 h-4" />
                Entrar
            </button>
            <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 relative z-10 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'register' ? 'text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <UserPlus className="w-4 h-4" />
                Registrar
            </button>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
            >
              {error && (
                <div className="text-center p-2.5 mb-5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-medium">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="text-center p-2.5 mb-5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-xs font-medium">
                  {successMsg}
                </div>
              )}

              <div className="space-y-4">
                {activeTab === 'register' && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-3 mb-4">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed text-center">
                      A criação de conta é exclusiva para administradores e gerentes do sistema. <br/>Para solicitar acesso, entre em contato com o suporte técnico ou o desenvolvedor.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="input-modern w-full text-sm rounded-xl py-3 px-4 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 dark:bg-slate-900/50 dark:border-slate-700 dark:focus:border-indigo-400"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">Senha</label>
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="input-modern w-full text-sm rounded-xl py-3 px-4 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 dark:bg-slate-900/50 dark:border-slate-700 dark:focus:border-indigo-400"
                  />
                  {activeTab === 'login' && (
                    <div className="flex justify-end mt-2 px-1">
                      <button
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>
                  )}
                </div>

                {activeTab === 'register' && (
                  <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     className="pt-2 border-t border-slate-100 dark:border-slate-700 mt-2"
                  >
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-1.5 ml-1 flex items-center gap-1.5">
                       <KeyRound className="w-3.5 h-3.5" />
                       Senha Mestra de Autorização
                    </label>
                    <input
                      type="password"
                      value={masterConfirm}
                      onChange={(e) => setMasterConfirm(e.target.value)}
                      placeholder="Senha Mestra"
                      className="input-modern w-full text-sm rounded-xl py-3 px-4 bg-amber-50/50 border-amber-200 focus:bg-white focus:border-amber-400 text-amber-900 placeholder-amber-700/30 dark:bg-amber-900/10 dark:border-amber-900/30 dark:focus:border-amber-500/50 dark:text-amber-100"
                    />
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAction}
                  disabled={loading}
                  className="w-full mt-2 relative overflow-hidden btn-modern py-3.5 px-4 rounded-2xl text-sm sm:text-base font-bold text-white bg-gradient-to-r from-sky-500 via-teal-400 to-sky-500 shadow-lg shadow-sky-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-[-10%] transition-transform duration-500 ease-out rounded-2xl blur-lg pointer-events-none" />
                  {loading ? (
                    <span className="relative z-10">Aguarde...</span>
                  ) : (
                    <>
                       <span className="relative z-10">{activeTab === 'login' ? "Entrar no Sistema" : "Criar Nova Conta"}</span>
                       <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </motion.button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-slate-800 px-2 text-slate-500">ou</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continuar com o Google
                </button>
              </div>
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
