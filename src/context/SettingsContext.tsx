import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { SETTINGS_DOC_PATH, ASSETS_DOC_PATH, APP_VERSION } from '../lib/constants';
import type { DioceseInfo } from '../data/diocesesData';
import { AVAILABLE_DIOCESES, AVAILABLE_SEMINARIES } from '../types';

export const sanitizeDocKey = (key: string): string => {
  if (!key) return "DEFAULT";
  return encodeURIComponent(key.trim().toUpperCase())
    .replace(/%/g, '_')
    .replace(/[^A-Z0-9_\-]/gi, '_');
};

export interface AppSettings {
  url: string;
  directorName: string;
  rectorName: string;
  instName: string;
  instColor: string;
  instLogo: string | null;
  cardLogo: string | null;
  cardBackLogo: string | null;
  cardSecondaryBackLogo: string | null;
  cardBackImage: string | null;
  cardFrontText: string;
  cardBackText: string;
  frontLogoConfig: { x: number; y: number; scale: number };
  backLogoConfig: { x: number; y: number; scale: number };
  instSignature: string | null;
  rectorSignature: string | null;
  signatureScale: number;
  rectorSignatureScale: number;
  secondaryBackLogoScale: number;
  instDescription: string;
  cardDescription: string;
  visibleFields: Record<string, boolean>;
  version: string;
  customRoles: string[];
  customCourses: string[];
  customDioceses: string[];
  diocesesConfig?: Record<string, Partial<DioceseInfo>>;
  databaseName: string;
  cardZoom?: number;
  termsVersion?: number;
  seminariesConfig: Record<string, { 
    logo: string | null; 
    signature: string | null; 
    rectorName: string;
    professionals?: { id: string, name: string, role: string, photoUrl: string | null, appointmentLink?: string, appointmentType?: "whatsapp" | "google_calendar" | "other", whatsappNumber?: string }[];
  }>;
  useGoogleScriptCertificate: boolean;
  googleScriptCertificateUrl: string;
  certificateValidationUrl: string;
  headerLogoUrl: string | null;
  headerLogoLink: string;
  headerLogoEnabled: boolean;
  liveBadgeEnabled: boolean;
  liveBadgeUrl: string;
  socialFacebookEnabled: boolean;
  socialFacebookUrl: string;
  socialInstagramEnabled: boolean;
  socialInstagramUrl: string;
  socialYoutubeEnabled: boolean;
  socialYoutubeUrl: string;
  socialWhatsappEnabled: boolean;
  socialWhatsappUrl: string;
  socialEmailEnabled: boolean;
  socialEmailUrl: string;
  sophiaLink: string;

  sophiaEnabled: boolean;
  libraryLink: string;
  libraryEnabled: boolean;
  avaLink: string;
  avaEnabled: boolean;
  fajopaPlusUrl: string;
  fajopaPlusEnabled: boolean;
  contemplacaoLink: string;
  contemplacaoEnabled: boolean;
  useWhatsappMural: boolean;
  whatsappGroups: { id: string; name: string; url: string; description?: string; visibleToRoles?: string[]; category?: string; type?: 'academico' | 'seminario'; requiredPassword?: string; imageUrl?: string; }[];
  whatsappCategories: string[];
  muralEnabled?: boolean;
  eventsEnabled?: boolean;
  appointmentsEnabled?: boolean;
  appointmentsExternalLink?: string;
  professionals?: { id: string, name: string, role: string, photoUrl: string | null, appointmentLink?: string, appointmentType?: "whatsapp" | "google_calendar" | "other", whatsappNumber?: string }[];
  autoApproveEnabled?: boolean;
  autoApproveWhitelist?: string[];
  autoApproveWhitelistText?: string;
  openBetaBadgeEnabled?: boolean;
  openBetaEndDate?: string;
  emailNotificationsEnabled?: boolean;
  emailHeaderName?: string;
  emailLogoMode?: 'davvero' | 'institution' | 'custom' | 'none';
  emailCustomLogoUrl?: string;
  notifyStudentOnPending?: boolean;
  notifyStudentOnApproved?: boolean;
  notifyStudentOnRejected?: boolean;
  notifyStudentOnDeactivated?: boolean;
  notifyOrganizerOnCertificate?: boolean;
  notifySecretariatOnNewRequest?: boolean;
  secretariatNotificationEmail?: string;
  notifySecretariatOnEditSuggestion?: boolean;
  editSuggestionNotificationEmail?: string;
  emailTemplates?: {
    pendingStudent?: { subject: string; title: string; body: string; buttonText: string };
    approvedStudent?: { subject: string; title: string; body: string; buttonText: string };
    rejectedStudent?: { subject: string; title: string; body: string; buttonText: string };
    deactivatedStudent?: { subject: string; title: string; body: string; buttonText: string };
    newRequestSecretariat?: { subject: string; title: string; body: string; buttonText: string };
    editSuggestionSecretariat?: { subject: string; title: string; body: string; buttonText: string };
    certificateAvailableOrganizer?: { subject: string; title: string; body: string; buttonText: string };
    certificateAvailableAttendee?: { subject: string; title: string; body: string; buttonText: string };
  };
  smtpConfig?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    fromName?: string;
    fromEmail?: string;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  url: 'https://davvero.netlify.app',
  directorName: '',
  rectorName: '',
  instName: 'FAJOPA e SPSCJ',
  instColor: '#0ea5e9',
  instLogo: null,
  cardLogo: null,
  cardBackLogo: null,
  cardSecondaryBackLogo: null,
  cardBackImage: null,
  cardFrontText: '',
  cardBackText: '',
  frontLogoConfig: { x: 0, y: 0, scale: 100 },
  backLogoConfig: { x: 0, y: 0, scale: 100 },
  instSignature: null,
  rectorSignature: null,
  signatureScale: 100,
  rectorSignatureScale: 100,
  secondaryBackLogoScale: 100,
  instDescription: 'SEU SISTEMA DE GESTÃO PARA FACULDADES, SEMINÁRIOS E DIOCESES',
  cardDescription: 'Documento de identificação estudantil é padronizado e apresenta os dados requeridos pela Lei 12.933/2013 para comprovação de matrícula, sendo sua aceitação sujeita aos critérios dos organizadores de eventos.',
  visibleFields: {
    name: true,
    ra: true,
    course: true,
    birth: true,
    validity: true,
    photo: true,
    qrcode: true,
    logo: true,
    signature: true,
    rectorSignature: true,
    director: true,
    rector: true,
    footer: true,
    diocese: true
  },
  version: '5.3.0',
  customRoles: [],
  customCourses: [],
  customDioceses: [],
  diocesesConfig: {},
  databaseName: 'FAJOPA e SPSCJ',
  cardZoom: 1,
  termsVersion: 1,
  seminariesConfig: {},
  useGoogleScriptCertificate: false,
  googleScriptCertificateUrl: 'https://script.google.com/macros/s/AKfycbxNT2BgfK1y0c5N7JILcWaDhexhQqJ6UQv-dmOBFye7mbQNz8kfZ_9JolRzQ4BiTUsr/exec',
  certificateValidationUrl: 'https://plus.fajopa.org/validar',
  headerLogoUrl: null,
  headerLogoLink: 'https://fajopa.org',
  headerLogoEnabled: true,
  liveBadgeEnabled: false,
  liveBadgeUrl: 'https://www.youtube.com/@fajopademarilia/streams',
  socialFacebookEnabled: true,
  socialFacebookUrl: 'https://www.facebook.com/fajopa.joaopauloii',
  socialInstagramEnabled: true,
  socialInstagramUrl: 'https://www.instagram.com/fajopamarilia/',
  socialYoutubeEnabled: true,
  socialYoutubeUrl: 'https://www.youtube.com/@fajopademarilia',
  socialWhatsappEnabled: true,
  socialWhatsappUrl: 'https://wa.me/5514991329926',
  socialEmailEnabled: true,
  socialEmailUrl: 'mailto:secretaria@fajopa.edu.br',
  sophiaLink: 'https://portal.sophia.com.br/SophiA_107/Acesso.aspx?escola=9087',
  sophiaEnabled: true,
  libraryLink: 'https://biblioteca.sophia.com.br/1291/',
  libraryEnabled: true,
  avaLink: 'https://fajopa.net/ava/',
  avaEnabled: true,
  fajopaPlusUrl: 'https://plus.fajopa.org',
  fajopaPlusEnabled: true,
  contemplacaoLink: 'https://revista.fajopa.com/index.php/contemplacao',
  contemplacaoEnabled: true,
  useWhatsappMural: true,
  whatsappGroups: [],
  whatsappCategories: ["Turmas", "Comissões", "Eventos", "Geral"],
  muralEnabled: true,
  eventsEnabled: true,
  appointmentsEnabled: true,
  appointmentsExternalLink: '',
  professionals: [
    { id: "prof_altair", name: "Padre Altair", role: "REITOR", photoUrl: null, appointmentLink: "https://chat.whatsapp.com/GzB9sD90aW09kPndbI38uP", appointmentType: "whatsapp", whatsappNumber: "" },
    { id: "prof_anderson", name: "Padre Anderson", role: "VICE-REITOR", photoUrl: null, appointmentLink: "https://calendar.app.google/shVAPdZTNeDs2PaGA", appointmentType: "google_calendar", whatsappNumber: "" },
    { id: "prof_braz", name: "Padre Bráz", role: "DIRETOR ESPIRITUAL", photoUrl: null, appointmentLink: "", appointmentType: "whatsapp", whatsappNumber: "" },
    { id: "prof_alessandra", name: "Dra. Alessandra", role: "PSICÓLOGA", photoUrl: null, appointmentLink: "", appointmentType: "whatsapp", whatsappNumber: "" }
  ],
  autoApproveEnabled: false,
  autoApproveWhitelist: [],
  autoApproveWhitelistText: '',
  openBetaBadgeEnabled: true,
  openBetaEndDate: '2026-10-05',
  emailNotificationsEnabled: true,
  emailHeaderName: 'DAVVERO System',
  emailLogoMode: 'davvero',
  emailCustomLogoUrl: '',
  notifyStudentOnPending: true,
  notifyStudentOnApproved: true,
  notifyStudentOnRejected: true,
  notifyStudentOnDeactivated: true,
  notifyOrganizerOnCertificate: true,
  notifySecretariatOnNewRequest: true,
  secretariatNotificationEmail: 'secretaria@fajopa.edu.br',
  notifySecretariatOnEditSuggestion: true,
  editSuggestionNotificationEmail: '',
  smtpConfig: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'DAVVERO System',
    fromEmail: ''
  }
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem('fajopa_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            visibleFields: {
              ...DEFAULT_SETTINGS.visibleFields,
              ...(parsed.visibleFields || {})
            }
          };
        }
      } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  
  // Track active individual listeners to avoid duplicate subscriptions
  const activeDioceseListeners = useRef<Map<string, () => void>>(new Map());
  const activeSeminaryListeners = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const docRef = doc(db, SETTINGS_DOC_PATH(appId));
    const unsubscribes: (() => void)[] = [];
    
    // 1. Listener principal de configurações
    const unsubMain = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        
        const mergedVisibleFields = {
          ...DEFAULT_SETTINGS.visibleFields,
          ...(data.visibleFields || {})
        };

        const heavyFieldsList = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature', 'diocesesConfig', 'seminariesConfig'];
        heavyFieldsList.forEach(field => {
          if (data[field] === null || data[field] === undefined) {
            delete data[field];
          }
        });

        setSettings(prev => ({ 
          ...prev, 
          ...data,
          visibleFields: mergedVisibleFields
        }));
      } else {
        setSettings(prev => ({ ...DEFAULT_SETTINGS, ...prev }));
      }
      setLoading(false);
    }, (err) => {
      console.warn("Aviso ao carregar configurações remotas:", err?.message || err);
      setLoading(false);
    });
    unsubscribes.push(unsubMain);

    // 2. Listeners para Ativos Pesados Individuais (Logos e Assinaturas Principais)
    const singleHeavyFields = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature'];
    singleHeavyFields.forEach(field => {
      const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
      const unsubAsset = onSnapshot(assetRef, (snapshot) => {
        if (snapshot.exists()) {
          const snapData = snapshot.data();
          const val = snapData?.data !== undefined ? snapData.data : snapData;
          setSettings(prev => ({ ...prev, [field]: val }));
        }
      }, (err) => {
        console.warn(`Aviso ao carregar asset ${field}:`, err?.message || err);
      });
      unsubscribes.push(unsubAsset);
    });

    // Helper para se inscrever em uma diocese individual
    const subscribeToDiocese = (dioceseKey: string) => {
      const cleanKey = dioceseKey.trim().toUpperCase();
      if (!cleanKey || activeDioceseListeners.current.has(cleanKey)) return;

      const docKey = sanitizeDocKey(cleanKey);
      const dioceseRef = doc(db, ASSETS_DOC_PATH(appId, `diocese_${docKey}`));
      
      const unsub = onSnapshot(dioceseRef, (snapshot) => {
        if (snapshot.exists()) {
          const snapData = snapshot.data();
          const val = snapData?.data !== undefined ? snapData.data : snapData;
          if (val) {
            setSettings(prev => ({
              ...prev,
              diocesesConfig: {
                ...(prev.diocesesConfig || {}),
                [cleanKey]: val
              }
            }));
          } else {
            setSettings(prev => {
              const current = { ...(prev.diocesesConfig || {}) };
              delete current[cleanKey];
              return { ...prev, diocesesConfig: current };
            });
          }
        }
      }, (err) => {
        console.warn(`Aviso ao carregar diocese ${cleanKey}:`, err?.message || err);
      });

      activeDioceseListeners.current.set(cleanKey, unsub);
    };

    // Helper para se inscrever em um seminário individual
    const subscribeToSeminary = (seminaryKey: string) => {
      const cleanKey = seminaryKey.trim();
      if (!cleanKey || activeSeminaryListeners.current.has(cleanKey)) return;

      const docKey = sanitizeDocKey(cleanKey);
      const semRef = doc(db, ASSETS_DOC_PATH(appId, `seminary_${docKey}`));
      
      const unsub = onSnapshot(semRef, (snapshot) => {
        if (snapshot.exists()) {
          const snapData = snapshot.data();
          const val = snapData?.data !== undefined ? snapData.data : snapData;
          if (val) {
            setSettings(prev => ({
              ...prev,
              seminariesConfig: {
                ...(prev.seminariesConfig || {}),
                [cleanKey]: val
              }
            }));
          } else {
            setSettings(prev => {
              const current = { ...(prev.seminariesConfig || {}) };
              delete current[cleanKey];
              return { ...prev, seminariesConfig: current };
            });
          }
        }
      }, (err) => {
        console.warn(`Aviso ao carregar seminário ${cleanKey}:`, err?.message || err);
      });

      activeSeminaryListeners.current.set(cleanKey, unsub);
    };

    // 3. Listener do Manifesto de Dioceses
    const diocesesManifestRef = doc(db, ASSETS_DOC_PATH(appId, 'dioceses_manifest'));
    const unsubDiocesesManifest = onSnapshot(diocesesManifestRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const keys: string[] = data?.keys || [];
        keys.forEach(k => subscribeToDiocese(k));
      }
    }, (err) => {
      console.warn("Aviso ao carregar manifesto de dioceses:", err?.message || err);
    });
    unsubscribes.push(unsubDiocesesManifest);

    // 4. Listener do Manifesto de Seminários
    const seminariesManifestRef = doc(db, ASSETS_DOC_PATH(appId, 'seminaries_manifest'));
    const unsubSeminariesManifest = onSnapshot(seminariesManifestRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const keys: string[] = data?.keys || [];
        keys.forEach(k => subscribeToSeminary(k));
      }
    }, (err) => {
      console.warn("Aviso ao carregar manifesto de seminários:", err?.message || err);
    });
    unsubscribes.push(unsubSeminariesManifest);

    // Inicializar listeners para todas as dioceses e seminários padrão do sistema
    AVAILABLE_DIOCESES.forEach(d => subscribeToDiocese(d));
    AVAILABLE_SEMINARIES.forEach(s => subscribeToSeminary(s));

    // 5. Suporte a Migração & Compatibilidade Legada:
    // Listener do documento legado `_asset_diocesesConfig` (se contiver dados de antes da migração em lote)
    const legacyDiocesesRef = doc(db, ASSETS_DOC_PATH(appId, 'diocesesConfig'));
    const unsubLegacyDioceses = onSnapshot(legacyDiocesesRef, (snapshot) => {
      if (snapshot.exists()) {
        const snapData = snapshot.data();
        if (snapData && !snapData.isSplit && snapData.data && typeof snapData.data === 'object') {
          // Dados legados encontrados antes da partição
          Object.keys(snapData.data).forEach(k => subscribeToDiocese(k));
          setSettings(prev => ({
            ...prev,
            diocesesConfig: {
              ...snapData.data,
              ...(prev.diocesesConfig || {})
            }
          }));
        }
      }
    }, (err) => {
      console.warn("Aviso doc legado diocesesConfig:", err?.message || err);
    });
    unsubscribes.push(unsubLegacyDioceses);

    // Listener do documento legado `_asset_seminariesConfig`
    const legacySeminariesRef = doc(db, ASSETS_DOC_PATH(appId, 'seminariesConfig'));
    const unsubLegacySeminaries = onSnapshot(legacySeminariesRef, (snapshot) => {
      if (snapshot.exists()) {
        const snapData = snapshot.data();
        if (snapData && !snapData.isSplit && snapData.data && typeof snapData.data === 'object') {
          Object.keys(snapData.data).forEach(k => subscribeToSeminary(k));
          setSettings(prev => ({
            ...prev,
            seminariesConfig: {
              ...snapData.data,
              ...(prev.seminariesConfig || {})
            }
          }));
        }
      }
    }, (err) => {
      console.warn("Aviso doc legado seminariesConfig:", err?.message || err);
    });
    unsubscribes.push(unsubLegacySeminaries);

    return () => {
      unsubscribes.forEach(u => u());
      activeDioceseListeners.current.forEach(u => u());
      activeDioceseListeners.current.clear();
      activeSeminaryListeners.current.forEach(u => u());
      activeSeminaryListeners.current.clear();
    };
  }, []);

  // Monitorar customDioceses para inscrever listeners sob demanda
  useEffect(() => {
    if (settings.customDioceses && settings.customDioceses.length > 0) {
      settings.customDioceses.forEach(d => {
        const cleanKey = d.trim().toUpperCase();
        if (cleanKey && !activeDioceseListeners.current.has(cleanKey)) {
          const docKey = sanitizeDocKey(cleanKey);
          const dioceseRef = doc(db, ASSETS_DOC_PATH(appId, `diocese_${docKey}`));
          const unsub = onSnapshot(dioceseRef, (snapshot) => {
            if (snapshot.exists()) {
              const snapData = snapshot.data();
              const val = snapData?.data !== undefined ? snapData.data : snapData;
              if (val) {
                setSettings(prev => ({
                  ...prev,
                  diocesesConfig: {
                    ...(prev.diocesesConfig || {}),
                    [cleanKey]: val
                  }
                }));
              }
            }
          });
          activeDioceseListeners.current.set(cleanKey, unsub);
        }
      });
    }
  }, [settings.customDioceses]);

  useEffect(() => {
    if (settings) {
      try {
        const safeSettings = { ...settings };
        // Exclude heavy base64 assets from localStorage cache to prevent quota exceeded errors
        delete (safeSettings as any).instLogo;
        delete (safeSettings as any).cardLogo;
        delete (safeSettings as any).cardBackLogo;
        delete (safeSettings as any).cardSecondaryBackLogo;
        delete (safeSettings as any).cardBackImage;
        delete (safeSettings as any).instSignature;
        delete (safeSettings as any).rectorSignature;
        delete (safeSettings as any).diocesesConfig;
        delete (safeSettings as any).seminariesConfig;
        localStorage.setItem('fajopa_settings', JSON.stringify(safeSettings));
      } catch (err) {
        console.warn("[SettingsContext] Não foi possível salvar em cache local:", err);
      }
      try {
        // Aplica o zoom visualmente no elemento raiz para persistência imediata
        document.documentElement.style.setProperty('--card-zoom', settings.cardZoom?.toString() || '1');
      } catch {}
    }
  }, [settings]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    // Optimistic UI update
    setSettings(prev => ({ ...prev, ...newSettings }));

    const docRef = doc(db, SETTINGS_DOC_PATH(appId));
    const settingsToSave = { ...newSettings };
    const assetOperations: Promise<any>[] = [];

    // 1. Tratamento seguro e particionado de diocesesConfig (Evita estourar o limite de 1MB por documento)
    if ('diocesesConfig' in newSettings) {
      const diocesesMap = newSettings.diocesesConfig || {};
      const dioceseKeys = Object.keys(diocesesMap);

      // Salva cada diocese individualmente em seu próprio documento (~30KB-50KB por doc)
      dioceseKeys.forEach(k => {
        const cleanKey = k.trim().toUpperCase();
        const dioceseData = diocesesMap[k];
        const dioceseDocRef = doc(db, ASSETS_DOC_PATH(appId, `diocese_${sanitizeDocKey(cleanKey)}`));
        if (dioceseData) {
          assetOperations.push(setDoc(dioceseDocRef, { data: dioceseData, key: cleanKey, updatedAt: new Date().toISOString() }));
        } else {
          assetOperations.push(setDoc(dioceseDocRef, { data: null, key: cleanKey, updatedAt: new Date().toISOString() }));
        }
      });

      // Se alguma diocese existia antes e foi removida no novo estado, marca como nula
      if (settings.diocesesConfig) {
        Object.keys(settings.diocesesConfig).forEach(oldKey => {
          const cleanOldKey = oldKey.trim().toUpperCase();
          if (!(cleanOldKey in diocesesMap) && !(oldKey in diocesesMap)) {
            const dioceseDocRef = doc(db, ASSETS_DOC_PATH(appId, `diocese_${sanitizeDocKey(cleanOldKey)}`));
            assetOperations.push(setDoc(dioceseDocRef, { data: null, key: cleanOldKey, updatedAt: new Date().toISOString() }));
          }
        });
      }

      // Salva o manifesto com a lista de chaves ativas
      const diocesesManifestRef = doc(db, ASSETS_DOC_PATH(appId, 'dioceses_manifest'));
      assetOperations.push(setDoc(diocesesManifestRef, { keys: dioceseKeys, updatedAt: new Date().toISOString() }));

      // Sobrescreve o antigo `_asset_diocesesConfig` com um documento leve (apenas chaves),
      // eliminando instantaneamente o documento anterior de > 1MB do Firestore!
      const legacyDiocesesDocRef = doc(db, ASSETS_DOC_PATH(appId, 'diocesesConfig'));
      assetOperations.push(setDoc(legacyDiocesesDocRef, { isSplit: true, keys: dioceseKeys, updatedAt: new Date().toISOString() }));

      delete (settingsToSave as any).diocesesConfig;
    }

    // 2. Tratamento seguro e particionado de seminariesConfig
    if ('seminariesConfig' in newSettings) {
      const seminariesMap = newSettings.seminariesConfig || {};
      const seminaryKeys = Object.keys(seminariesMap);

      seminaryKeys.forEach(k => {
        const cleanKey = k.trim();
        const semData = seminariesMap[k];
        const semDocRef = doc(db, ASSETS_DOC_PATH(appId, `seminary_${sanitizeDocKey(cleanKey)}`));
        if (semData) {
          assetOperations.push(setDoc(semDocRef, { data: semData, key: cleanKey, updatedAt: new Date().toISOString() }));
        } else {
          assetOperations.push(setDoc(semDocRef, { data: null, key: cleanKey, updatedAt: new Date().toISOString() }));
        }
      });

      if (settings.seminariesConfig) {
        Object.keys(settings.seminariesConfig).forEach(oldKey => {
          const cleanOldKey = oldKey.trim();
          if (!(cleanOldKey in seminariesMap) && !(oldKey in seminariesMap)) {
            const semDocRef = doc(db, ASSETS_DOC_PATH(appId, `seminary_${sanitizeDocKey(cleanOldKey)}`));
            assetOperations.push(setDoc(semDocRef, { data: null, key: cleanOldKey, updatedAt: new Date().toISOString() }));
          }
        });
      }

      const seminariesManifestRef = doc(db, ASSETS_DOC_PATH(appId, 'seminaries_manifest'));
      assetOperations.push(setDoc(seminariesManifestRef, { keys: seminaryKeys, updatedAt: new Date().toISOString() }));

      const legacySeminariesDocRef = doc(db, ASSETS_DOC_PATH(appId, 'seminariesConfig'));
      assetOperations.push(setDoc(legacySeminariesDocRef, { isSplit: true, keys: seminaryKeys, updatedAt: new Date().toISOString() }));

      delete (settingsToSave as any).seminariesConfig;
    }

    // 3. Ativos individuais pesados (Logos e Assinaturas)
    const singleHeavyFields = ['instLogo', 'cardLogo', 'cardBackLogo', 'cardSecondaryBackLogo', 'cardBackImage', 'instSignature', 'rectorSignature'];
    singleHeavyFields.forEach(field => {
      if (field in newSettings) {
        const val = (newSettings as any)[field];
        const assetRef = doc(db, ASSETS_DOC_PATH(appId, field));
        
        if (val !== undefined && val !== null) {
          const isLargeString = typeof val === 'string' && val.length > 500;
          if (isLargeString) {
            assetOperations.push(setDoc(assetRef, { data: val }));
            delete (settingsToSave as any)[field];
          }
        } else if (val === null) {
          assetOperations.push(setDoc(assetRef, { data: null }));
        }
      }
    });

    await Promise.all([
      setDoc(docRef, settingsToSave, { merge: true }),
      ...assetOperations
    ]);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
