export const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined;
};

const isIframe = () => {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
};

export const registerBiometric = async (userEmail: string, userName: string) => {
    if (!isWebAuthnSupported()) throw new Error("Biometria não suportada neste dispositivo");
    if (isIframe()) throw new Error("Recurso de biometria indisponível dentro de iframes (abra o portal em uma nova guia para validar)");
    
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
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "required"
        },
        timeout: 60000,
        attestation: "none"
    };

    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (credential) {
        return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    }
    throw new Error("Falha ao registrar biometria");
};

export const verifyBiometric = async (credentialIdBase64: string) => {
    if (!isWebAuthnSupported()) throw new Error("Biometria não suportada neste dispositivo");
    if (isIframe()) throw new Error("Recurso de biometria indisponível dentro de iframes (abra o portal em uma nova guia para validar)");

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const rawId = Uint8Array.from(atob(credentialIdBase64), c => c.charCodeAt(0));

    const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
            type: "public-key",
            id: rawId,
            // You can optionally add transports: ["internal"] here, but it might restrict some environments.
        }],
        userVerification: "required",
        timeout: 60000
    };

    const assertion = await navigator.credentials.get({ publicKey });
    if (assertion) {
        return true;
    }
    throw new Error("Falha ao verificar biometria");
};
