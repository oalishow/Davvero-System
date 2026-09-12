export const isWebAuthnSupported = () => {
    return typeof window !== "undefined" && window.PublicKeyCredential !== undefined;
};

const isIframe = () => {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
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
    if (!isWebAuthnSupported()) throw new Error("Biometria não suportada neste dispositivo");
    if (isIframe()) throw new Error("Recurso de biometria indisponível dentro de iframes (abra o portal em uma nova guia para validar)");
    
    // Abort any existing operation before registering
    cancelBiometric();
    const abortController = new AbortController();
    activeBiometricAbortController = abortController;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "FAJOPA ID", id: window.location.hostname },
        user: {
            id: userId,
            name: userEmail,
            displayName: userName
        },
        pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 } // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "preferred",
            residentKey: "preferred"
        },
        timeout: 60000,
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
    } finally {
        if (activeBiometricAbortController === abortController) {
            activeBiometricAbortController = null;
        }
    }
};

export const verifyBiometric = async (credentialIdBase64?: string | null) => {
    if (!isWebAuthnSupported()) throw new Error("Biometria não suportada neste dispositivo");
    if (isIframe()) throw new Error("Recurso de biometria indisponível dentro de iframes (abra o portal em uma nova guia para validar)");

    // Abort any existing operation before verifying to prevent deadlock
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
                    id: rawIdBuffer
                    // Note: Do not constrain transports: ["internal", "hybrid"] 
                    // Omitting transports lets the browser directly invoke the platform biometric sensor (fingerprint/FaceID)
                });
            }
        } catch (e) {
            console.warn("Falha ao decodificar credentialId, prosseguindo com credencial residente:", e);
        }
    }

    const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        timeout: 45000,
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

        // Se falhou com allowCredentials específico (ex: ID salvo incompatível ou passkey residente), tenta busca ampla
        if (allowCredentials.length > 0 && err.name !== "NotAllowedError") {
            try {
                const fallbackChallenge = new Uint8Array(32);
                crypto.getRandomValues(fallbackChallenge);
                const fallbackKey: PublicKeyCredentialRequestOptions = {
                    challenge: fallbackChallenge,
                    rpId: window.location.hostname,
                    timeout: 25000,
                    userVerification: "preferred"
                };
                const assertion = await navigator.credentials.get({ 
                    publicKey: fallbackKey,
                    signal: abortController.signal 
                });
                if (assertion) {
                    return true;
                }
            } catch (fallbackErr: any) {
                if (fallbackErr.name === "AbortError") {
                    throw new Error("Leitura biométrica cancelada.");
                }
            }
        }

        if (err.name === "NotAllowedError") {
            throw new Error("Leitura biométrica cancelada ou não reconhecida.");
        }
        if (err.name === "TimeoutError") {
            throw new Error("Tempo limite excedido na validação biométrica.");
        }
        throw err;
    } finally {
        if (activeBiometricAbortController === abortController) {
            activeBiometricAbortController = null;
        }
    }

    throw new Error("Falha ao verificar biometria");
};
