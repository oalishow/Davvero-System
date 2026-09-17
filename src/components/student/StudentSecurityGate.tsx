import React from "react";
import { Lock, Fingerprint, ExternalLink, KeyRound } from "lucide-react";
import Modal from "../Modal";
import { isWebAuthnSupported } from "../../lib/webauthn";

export const STUDENT_FALLBACK_PIN = "student_fallback_pin";

interface StudentSecurityGateProps {
  member: any;
  pinMode: "create" | "verify" | "none";
  setPinMode: (mode: "create" | "verify" | "none") => void;
  pinInput: string;
  setPinInput: (val: string) => void;
  pinConfirm: string;
  error: string | null;
  setError: (err: string | null) => void;
  handlePinSubmit: () => void;
  isBiometricAuthenticating: boolean;
  handleBiometricAuth: () => void;
  cancelBiometric: () => void;
  setIsBiometricAuthenticating: (val: boolean) => void;
  modalPinReset: boolean;
  setModalPinReset: (val: boolean) => void;
  resetCodeStr: string;
  setResetCodeStr: (val: string) => void;
  handlePinResetAttempt: () => void;
  modalUnlinkOpen: boolean;
  setModalUnlinkOpen: (val: boolean) => void;
  confirmUnlink: () => void;
  modalIframeBiometric: boolean;
  setModalIframeBiometric: (val: boolean) => void;
  handleUnlockScreen: () => void;
}

export const StudentSecurityGate: React.FC<StudentSecurityGateProps> = ({
  member,
  pinMode,
  setPinMode,
  pinInput,
  setPinInput,
  pinConfirm,
  error,
  setError,
  handlePinSubmit,
  isBiometricAuthenticating,
  handleBiometricAuth,
  cancelBiometric,
  setIsBiometricAuthenticating,
  modalPinReset,
  setModalPinReset,
  resetCodeStr,
  setResetCodeStr,
  handlePinResetAttempt,
  modalUnlinkOpen,
  setModalUnlinkOpen,
  confirmUnlink,
  modalIframeBiometric,
  setModalIframeBiometric,
  handleUnlockScreen,
}) => {
  if (pinMode !== "none") {
    const title =
      pinMode === "create"
        ? !pinConfirm
          ? "Criar Senha/PIN (4 dígitos)"
          : "Confirme a Senha"
        : "Digite sua Senha/PIN";
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center space-y-6 animate-fade-in max-w-[320px] sm:max-w-sm mx-auto h-full">
        <Modal
          isOpen={modalPinReset}
          onClose={() => setModalPinReset(false)}
          title="Redefinir PIN de Acesso"
          confirmLabel="Redefinir PIN"
          onConfirm={handlePinResetAttempt}
        >
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Para redefinir sua senha de 4 dígitos, informe seu <strong>CPF</strong> ou o seu <strong>Código de Uso</strong> (alfanumérico) cadastrado para confirmar sua identidade:
            </p>
            <input
              type="text"
              placeholder="Digite seu CPF ou Código"
              autoCapitalize="characters"
              value={resetCodeStr}
              onChange={(e) => setResetCodeStr(e.target.value.toUpperCase())}
              className="input-modern w-full rounded-xl py-3 px-4 text-center font-bold tracking-widest text-lg"
            />
          </div>
        </Modal>

        <Lock className="w-12 h-12 text-sky-500" />
        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
          {title}
        </h2>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePinSubmit();
          }}
          className="text-center text-4xl tracking-[1em] font-black w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-900 dark:text-white placeholder-slate-300 ml-[0.5em]"
          placeholder="••••"
        />
        {error && (
          <p className="text-xs text-rose-500 font-bold uppercase">{error}</p>
        )}
        <button
          onClick={handlePinSubmit}
          className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-600/20 transition-all active:scale-95"
        >
          Confirmar
        </button>
        {isWebAuthnSupported() &&
          (isBiometricAuthenticating ? (
            <div className="w-full p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-col items-center gap-2 animate-fade-in">
              <Fingerprint className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-pulse" />
              <p className="text-xs font-bold text-sky-900 dark:text-sky-200">
                Aguardando leitor biométrico...
              </p>
              <p className="text-[11px] text-sky-700 dark:text-sky-300 text-center">
                Toque no sensor do aparelho ou use o Face ID
              </p>
              <button
                type="button"
                onClick={() => {
                  cancelBiometric();
                  setIsBiometricAuthenticating(false);
                }}
                className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-1.5 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 shadow-sm"
              >
                Cancelar Leitura
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleBiometricAuth}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Fingerprint className="w-5 h-5 text-indigo-500" />
              {localStorage.getItem("student_biometric_credential_id")
                ? "Usar Biometria"
                : "Cadastrar Biometria"}
            </button>
          ))}
        <div className="flex flex-col gap-2 mt-4 w-full">
          {pinMode === "verify" && (
            <button
              onClick={() => {
                setModalPinReset(true);
                setError(null);
              }}
              className="text-xs text-slate-500 hover:text-sky-600 font-bold w-full p-2"
            >
              Esqueci minha senha (Redefinir PIN)
            </button>
          )}
          <button
            onClick={() => {
              setPinMode("none");
              setModalUnlinkOpen(true);
            }}
            className="text-xs text-rose-400 hover:text-rose-600 font-bold w-full p-2"
          >
            Desvincular Carteirinha deste dispositivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Modal
        isOpen={modalUnlinkOpen}
        onClose={() => setModalUnlinkOpen(false)}
        title="Remover Vínculo"
        confirmLabel="Sim, Remover"
        confirmVariant="danger"
        onConfirm={confirmUnlink}
      >
        Deseja remover sua identidade institucional deste dispositivo? Você
        precisará do código de segurança para vincular novamente.
      </Modal>

      <Modal
        isOpen={modalIframeBiometric}
        onClose={() => setModalIframeBiometric(false)}
        title="Biometria no Modo Prévia"
        confirmLabel="Entendido"
        onConfirm={() => setModalIframeBiometric(false)}
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
            <Fingerprint className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Acesso biométrico protegido</p>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">
                O leitor biométrico físico (Face ID / digital) é restrito pelo
                navegador quando o app é executado em janelas embutidas (iframe).
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Para autenticar com sua digital ou Face ID, abra o portal em uma nova
            aba do navegador, ou utilize seu <strong>PIN de 4 dígitos</strong>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href={typeof window !== "undefined" ? window.location.href : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 text-center bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir em Nova Aba
            </a>
            <button
              type="button"
              onClick={() => {
                setModalIframeBiometric(false);
                handleUnlockScreen();
              }}
              className="w-full py-3 text-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all"
            >
              Digitar Senha / PIN
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-8 animate-fade-in relative max-w-[320px] sm:max-w-sm mx-auto h-full min-h-[60vh]">
        <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] rounded-3xl -z-10" />
        <div className="w-24 h-24 bg-sky-100 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner">
          <Lock className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Autenticação Necessária
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Confirme sua identidade para acessar sua carteirinha MINHA ID.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleUnlockScreen}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <KeyRound className="w-5 h-5" />
            {typeof localStorage !== "undefined" &&
            localStorage.getItem(STUDENT_FALLBACK_PIN)
              ? "Digitar Senha / PIN"
              : "Criar Senha de 4 Dígitos"}
          </button>

          {isWebAuthnSupported() &&
            (isBiometricAuthenticating ? (
              <div className="w-full p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-col items-center gap-2.5 animate-fade-in shadow-sm">
                <div className="relative flex items-center justify-center py-1">
                  <Fingerprint className="w-10 h-10 text-sky-600 dark:text-sky-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-sky-900 dark:text-sky-200">
                    Aguardando Leitor Biométrico...
                  </p>
                  <p className="text-xs text-sky-700 dark:text-sky-300 mt-0.5">
                    Toque no leitor do aparelho ou use o Face ID
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    cancelBiometric();
                    setIsBiometricAuthenticating(false);
                  }}
                  className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-1.5 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 shadow-sm"
                >
                  Cancelar / Usar Senha PIN
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="w-full py-4 bg-sky-100 hover:bg-sky-200 text-sky-700 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 dark:text-sky-300 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
              >
                <Fingerprint className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                {typeof localStorage !== "undefined" &&
                localStorage.getItem("student_biometric_credential_id")
                  ? "Acessar com Biometria"
                  : "Habilitar Biometria"}
              </button>
            ))}
        </div>
        {error && (
          <p className="text-[10px] text-rose-500 font-bold uppercase">
            {error}
          </p>
        )}
        <button
          onClick={() => setModalUnlinkOpen(true)}
          className="text-xs text-rose-400 hover:text-rose-600 font-bold transition-colors"
        >
          Desvincular Carteirinha
        </button>
      </div>
    </>
  );
};

export default StudentSecurityGate;
