import { useState } from "react";
import {
  checkBiometricAvailability,
  verifyBiometric,
  registerBiometric,
  cancelBiometric,
} from "../../lib/webauthn";
import { playSound } from "../../lib/sounds";

interface UseStudentBiometricsOptions {
  member: any;
  onSuccess: () => void;
  onError: (msg: string | null) => void;
  onOpenIframeModal: () => void;
}

export function useStudentBiometrics({
  member,
  onSuccess,
  onError,
  onOpenIframeModal,
}: UseStudentBiometricsOptions) {
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] =
    useState(false);

  const handleBiometricAuth = async () => {
    try {
      onError(null);

      const availability = await checkBiometricAvailability();
      if (availability.isIframe) {
        onOpenIframeModal();
        return;
      }
      if (!availability.supported) {
        onError(
          "Seu navegador ou dispositivo não suporta autenticação biométrica WebAuthn."
        );
        playSound("error");
        return;
      }
      if (!availability.hasPlatformSensor) {
        onError(
          "Nenhum leitor biométrico (digital/facial) detectado ou ativado neste aparelho. Acesse com sua senha PIN de 4 dígitos."
        );
        playSound("error");
        return;
      }

      setIsBiometricAuthenticating(true);
      const credId =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("student_biometric_credential_id")
          : null;

      if (credId) {
        try {
          await verifyBiometric(credId);
        } catch (verifyErr: any) {
          const errName = verifyErr?.name || "";
          const msg = verifyErr?.message || "";
          if (
            errName === "AbortError" ||
            msg.includes("cancelad") ||
            errName === "NotAllowedError"
          ) {
            throw verifyErr;
          }
          console.warn(
            "Credencial biométrica anterior não reconhecida, tentando novo cadastro...",
            verifyErr
          );
          localStorage.removeItem("student_biometric_credential_id");
          if (member) {
            const newCredId = await registerBiometric(
              member.email || "aluno@fajopa",
              member.name
            );
            localStorage.setItem("student_biometric_credential_id", newCredId);
          } else {
            throw verifyErr;
          }
        }
      } else {
        if (!member) {
          setIsBiometricAuthenticating(false);
          onError(
            "Dados institucionais não encontrados para habilitar biometria. Use sua senha PIN."
          );
          return;
        }
        const newCredId = await registerBiometric(
          member.email || "aluno@fajopa",
          member.name
        );
        localStorage.setItem("student_biometric_credential_id", newCredId);
      }

      setIsBiometricAuthenticating(false);
      onSuccess();
    } catch (e: any) {
      console.error("Erro na biometria:", e);
      setIsBiometricAuthenticating(false);
      const errorMsg = e?.message || "";

      if (e?.name === "AbortError" || errorMsg.includes("cancelad")) {
        onError(null);
      } else if (e?.name === "NotAllowedError") {
        onError(
          "Validação biométrica cancelada ou não reconhecida. Tente novamente ou use seu PIN."
        );
        playSound("error");
      } else if (e?.name === "TimeoutError" || errorMsg.includes("Tempo limite")) {
        onError("Tempo limite esgotado. Tente novamente ou use seu PIN.");
        playSound("error");
      } else {
        onError(
          errorMsg || "Falha na leitura biométrica. Você pode usar sua senha PIN."
        );
        playSound("error");
      }
    } finally {
      setIsBiometricAuthenticating(false);
    }
  };

  const handleCancelBiometric = () => {
    cancelBiometric();
    setIsBiometricAuthenticating(false);
  };

  return {
    isBiometricAuthenticating,
    setIsBiometricAuthenticating,
    handleBiometricAuth,
    handleCancelBiometric,
  };
}

export default useStudentBiometrics;
