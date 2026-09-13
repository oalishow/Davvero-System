export const isWebAuthnSupported = () => {
    return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
};

export const isIframe = () => {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
};

export interface BiometricStatus {
    supported: boolean;
    hasPlatformSensor: boolean;
    isIframe: boolean;
    reason?: string;
}

export const checkBiometricAvailability = async (): Promise<BiometricStatus> => {
    if (!isWebAuthnSupported()) {
        return {
            supported: false,
            hasPlatformSensor: false,
            isIframe: false,
            reason: "Navegador ou dispositivo sem suporte à tecnologia WebAuthn."
        };
    }

    if (isIframe()) {
        return {
            supported: true,
            hasPlatformSensor: false,
            isIframe: true,
            reason: "Acesso biométrico restrito pelo navegador dentro da pré-visualização (janela embutida/iframe). Abra em uma nova aba para testar o leitor do aparelho."
        };
    }

    let hasPlatform = false;
    try {
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
            hasPlatform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
    } catch (e) {
        console.warn("Erro ao verificar sensor de plataforma:", e);
    }

    if (!hasPlatform) {
        return {
            supported: true,
            hasPlatformSensor: false,
            isIframe: false,
            reason: "Nenhum leitor biométrico (digital/facial) ativo detectado neste dispositivo. Acesse com sua senha PIN."
        };
    }

    return {
        supported: true,
        hasPlatformSensor: true,
        isIframe: false
    };
};

export function bufferToBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = "";
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

let activeBiometricAbortController: AbortController | null = null;

export const cancelBiometric = () => {
    if (activeBiometricAbortController) {
        try {
            activeBiometricAbortController.abort();
        } catch {}
        activeBiometricAbortController = null;
    }
};

export const registerBiometric = async (userEmail: string, userName: string) => {
    const availability = await checkBiometricAvailability();
    if (!availability.supported) {
        throw new Error(availability.reason || "Biometria não suportada neste dispositivo.");
    }
    if (availability.isIframe) {
        throw new Error(availability.reason || "Abra o aplicativo em uma nova aba do navegador para usar a biometria.");
    }
    if (!availability.hasPlatformSensor) {
        throw new Error(availability.reason || "Nenhum leitor biométrico detectado neste aparelho. Utilize seu PIN de 4 dígitos.");
    }

    cancelBiometric();
    const abortController = new AbortController();
    activeBiometricAbortController = abortController;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: "FAJOPA - Carteirinha Digital"
        },
        user: {
            id: userId,
            name: userEmail || "aluno@fajopa",
            displayName: userName || "Aluno FAJOPA"
        },
        pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ES256
            { type: "public-key", alg: -257 }, // RS256
            { type: "public-key", alg: -8 },   // Ed25519
            { type: "public-key", alg: -37 }   // PS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "preferred",
            residentKey: "preferred"
        },
        timeout: 20000,
        attestation: "none"
    };

    try {
        const credential = await navigator.credentials.create({ 
            publicKey,
            signal: abortController.signal
        }) as PublicKeyCredential;
        if (credential) {
            return bufferToBase64URL(credential.rawId);
        }
        throw new Error("Falha ao registrar biometria");
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error("Leitura biométrica cancelada.");
        }
        if (err.name === "NotAllowedError") {
            throw new Error("Ação cancelada pelo usuário ou leitor indisponível.");
        }
        if (err.name === "TimeoutError") {
            throw new Error("Tempo limite do leitor esgotado. Tente novamente ou use seu PIN.");
        }
        throw err;
    } finally {
        if (activeBiometricAbortController === abortController) {
            activeBiometricAbortController = null;
        }
    }
};

export const verifyBiometric = async (credentialIdBase64?: string | null) => {
    const availability = await checkBiometricAvailability();
    if (!availability.supported) {
        throw new Error(availability.reason || "Biometria não suportada neste dispositivo.");
    }
    if (availability.isIframe) {
        throw new Error(availability.reason || "Abra o aplicativo em uma nova aba do navegador para usar a biometria.");
    }
    if (!availability.hasPlatformSensor) {
        throw new Error(availability.reason || "Nenhum leitor biométrico detectado neste aparelho. Utilize seu PIN de 4 dígitos.");
    }

    cancelBiometric();
    const abortController = new AbortController();
    activeBiometricAbortController = abortController;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialIdBase64) {
        try {
            const rawIdBuffer = base64URLToBuffer(credentialIdBase64);
            if (rawIdBuffer && rawIdBuffer.byteLength > 0) {
                allowCredentials.push({
                    type: "public-key",
                    id: rawIdBuffer,
                    transports: ["internal"]
                });
            }
        } catch (e) {
            console.warn("Falha ao decodificar credentialId:", e);
        }
    }

    const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 20000,
        userVerification: "preferred"
    };

    if (allowCredentials.length > 0) {
        publicKey.allowCredentials = allowCredentials;
    }

    try {
        const assertion = await navigator.credentials.get({ 
            publicKey,
            signal: abortController.signal 
        });
        if (assertion) {
            return true;
        }
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error("Leitura biométrica cancelada.");
        }
        if (err.name === "NotAllowedError") {
            throw new Error("Leitura biométrica cancelada ou não reconhecida.");
        }
        if (err.name === "TimeoutError") {
            throw new Error("Tempo limite do sensor esgotado. Tente novamente ou use seu PIN.");
        }
        throw err;
    } finally {
        if (activeBiometricAbortController === abortController) {
            activeBiometricAbortController = null;
        }
    }

    throw new Error("Falha ao verificar biometria");
};
