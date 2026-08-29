import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { db, appId } from "../lib/firebase";
import { logAdminAction } from "../lib/audit";
import {
  X,
  Settings,
  Save,
  ShieldAlert,
  ShieldCheck,
  Link,
  Palette,
  Upload,
  Trash2,
  Wand2,
  FileText,
  ImageIcon,
  RotateCw,
  BellRing,
  Sun,
  Moon,
  Lock,
  Type,
  Plus,
  Database,
  Sparkles,
  MessageCircle,
  HeartHandshake,
} from "lucide-react";
import FajopaIDCard from "./FajopaIDCard";
import BackupModal from "./BackupModal";
import WhatsappMuralView from "./WhatsappMuralView";
import { useSettings } from "../context/SettingsContext";
import { AVAILABLE_SEMINARIES } from "../types";
import { DEFAULT_PROFESSIONALS } from "../lib/defaultProfessionals";
import {
  PASSWORD_STORAGE_KEY,
  URL_STORAGE_KEY,
  DIRECTOR_NAME_KEY,
  DEFAULT_ADMIN_PASSWORD,
  INSTITUTION_LOGO_KEY,
  INSTITUTION_NAME_KEY,
  INSTITUTION_COLOR_KEY,
  DIRECTOR_SIGNATURE_KEY,
  CARD_LOGO_KEY,
  CARD_BACK_LOGO_KEY,
  CARD_FRONT_LOGO_CONFIG_KEY,
  CARD_BACK_LOGO_CONFIG_KEY,
  CARD_FRONT_TEXT_KEY,
  CARD_BACK_TEXT_KEY,
  CARD_VISIBLE_FIELDS_KEY,
  CARD_BACK_IMAGE_KEY,
  INSTITUTION_DESCRIPTION_KEY,
  CARD_DESCRIPTION_KEY,
  CARD_SIGNATURE_CONFIG_KEY,
  SECONDARY_BACK_LOGO_SCALE_KEY,
} from "../lib/constants";

interface LogoConfig {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_CONFIG: LogoConfig = { x: 0, y: 0, scale: 100 };

const MOCK_MEMBER = {
  id: "preview",
  name: "JOÃO DA SILVA SAMPLE",
  ra: "2024.0001",
  course: "TEOLOGIA",
  diocese: "ASSIS",
  roles: ["SEMINARISTA"],
  birthdate: "01/01/2000",
  validityDate: "2025-12-31",
  photoUrl:
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop",
  alphaCode: "PREVIEW",
  isActive: true,
  isApproved: true,
  createdAt: new Date().toISOString(),
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings: cloudSettings, updateSettings } = useSettings();
  const [url, setUrl] = useState(cloudSettings.url);
  const [directorName, setDirectorName] = useState(cloudSettings.directorName);
  const [rectorName, setRectorName] = useState(cloudSettings.rectorName || "");
  const [instName, setInstName] = useState(cloudSettings.instName);
  const [instColor, setInstColor] = useState(cloudSettings.instColor);
  const [instLogo, setInstLogo] = useState<string | null>(
    cloudSettings.instLogo,
  );
  const [cardLogo, setCardLogo] = useState<string | null>(
    cloudSettings.cardLogo,
  );
  const [cardBackLogo, setCardBackLogo] = useState<string | null>(
    cloudSettings.cardBackLogo,
  );
  const [cardSecondaryBackLogo, setCardSecondaryBackLogo] = useState<
    string | null
  >(cloudSettings.cardSecondaryBackLogo);
  const [cardBackImage, setCardBackImage] = useState<string | null>(
    cloudSettings.cardBackImage,
  );

  const [cardFrontText, setCardFrontText] = useState(
    cloudSettings.cardFrontText,
  );
  const [cardBackText, setCardBackText] = useState(cloudSettings.cardBackText);

  const [frontLogoConfig, setFrontLogoConfig] = useState<LogoConfig>(
    cloudSettings.frontLogoConfig,
  );
  const [backLogoConfig, setBackLogoConfig] = useState<LogoConfig>(
    cloudSettings.backLogoConfig,
  );

  const [instSignature, setInstSignature] = useState<string | null>(
    cloudSettings.instSignature,
  );
  const [rectorSignature, setRectorSignature] = useState<string | null>(
    cloudSettings.rectorSignature || null,
  );
  const [signatureScale, setSignatureScale] = useState(
    cloudSettings.signatureScale,
  );
  const [rectorSignatureScale, setRectorSignatureScale] = useState(
    cloudSettings.rectorSignatureScale || 100,
  );
  const [secondaryBackLogoScale, setSecondaryBackLogoScale] = useState(
    cloudSettings.secondaryBackLogoScale || 100,
  );
  const [instDescription, setInstDescription] = useState(
    cloudSettings.instDescription,
  );
  const [cardDescription, setCardDescription] = useState(
    cloudSettings.cardDescription,
  );
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    cloudSettings.visibleFields,
  );
  const [customDioceses, setCustomDioceses] = useState<string[]>(
    cloudSettings.customDioceses || [],
  );
  const [customCourses, setCustomCourses] = useState<string[]>(
    cloudSettings.customCourses || [],
  );
  const [customRoles, setCustomRoles] = useState<string[]>(
    cloudSettings.customRoles || [],
  );
  const [databaseName, setDatabaseName] = useState(
    cloudSettings.databaseName || "",
  );
  const [cardZoom, setCardZoom] = useState(cloudSettings.cardZoom || 1);
  const [seminariesConfig, setSeminariesConfig] = useState<Record<string, { logo: string | null; signature: string | null; rectorName: string }>>(
    cloudSettings.seminariesConfig || {}
  );
  
  const [useGoogleScriptCertificate, setUseGoogleScriptCertificate] = useState(cloudSettings.useGoogleScriptCertificate || false);
  const [googleScriptCertificateUrl, setGoogleScriptCertificateUrl] = useState(cloudSettings.googleScriptCertificateUrl || 'https://script.google.com/macros/s/AKfycbxNT2BgfK1y0c5N7JILcWaDhexhQqJ6UQv-dmOBFye7mbQNz8kfZ_9JolRzQ4BiTUsr/exec');
  const [certificateValidationUrl, setCertificateValidationUrl] = useState(cloudSettings.certificateValidationUrl || 'https://plus.fajopa.org/validar');

  const [headerLogoUrl, setHeaderLogoUrl] = useState(cloudSettings.headerLogoUrl);
  const [headerLogoLink, setHeaderLogoLink] = useState(cloudSettings.headerLogoLink || 'https://fajopa.org');
  const [headerLogoEnabled, setHeaderLogoEnabled] = useState(cloudSettings.headerLogoEnabled ?? true);
  const [liveBadgeEnabled, setLiveBadgeEnabled] = useState(cloudSettings.liveBadgeEnabled ?? false);
  const [liveBadgeUrl, setLiveBadgeUrl] = useState(cloudSettings.liveBadgeUrl || 'https://www.youtube.com/@fajopademarilia/streams');
  const [socialFacebookEnabled, setSocialFacebookEnabled] = useState(cloudSettings.socialFacebookEnabled ?? true);
  const [socialFacebookUrl, setSocialFacebookUrl] = useState(cloudSettings.socialFacebookUrl || 'https://www.facebook.com/fajopa.joaopauloii');
  const [socialInstagramEnabled, setSocialInstagramEnabled] = useState(cloudSettings.socialInstagramEnabled ?? true);
  const [socialInstagramUrl, setSocialInstagramUrl] = useState(cloudSettings.socialInstagramUrl || 'https://www.instagram.com/fajopamarilia/');
  const [socialYoutubeEnabled, setSocialYoutubeEnabled] = useState(cloudSettings.socialYoutubeEnabled ?? true);
  const [socialYoutubeUrl, setSocialYoutubeUrl] = useState(cloudSettings.socialYoutubeUrl || 'https://www.youtube.com/@fajopademarilia');
  const [socialWhatsappEnabled, setSocialWhatsappEnabled] = useState(cloudSettings.socialWhatsappEnabled ?? true);
  const [socialWhatsappUrl, setSocialWhatsappUrl] = useState(cloudSettings.socialWhatsappUrl || 'https://wa.me/5514991329926');
  const [socialEmailEnabled, setSocialEmailEnabled] = useState(cloudSettings.socialEmailEnabled ?? true);
  const [socialEmailUrl, setSocialEmailUrl] = useState(cloudSettings.socialEmailUrl || 'mailto:secretaria@fajopa.edu.br');
  const [sophiaLink, setSophiaLink] = useState(cloudSettings.sophiaLink || 'https://portal.sophia.com.br/SophiA_107/Acesso.aspx?escola=9087');
  const [sophiaEnabled, setSophiaEnabled] = useState(cloudSettings.sophiaEnabled ?? true);
  const [libraryLink, setLibraryLink] = useState(cloudSettings.libraryLink || 'https://biblioteca.sophia.com.br/1291/');
  const [libraryEnabled, setLibraryEnabled] = useState(cloudSettings.libraryEnabled ?? true);
  const [fajopaPlusUrl, setFajopaPlusUrl] = useState(cloudSettings.fajopaPlusUrl || 'https://plus.fajopa.org');
  const [fajopaPlusEnabled, setFajopaPlusEnabled] = useState(cloudSettings.fajopaPlusEnabled ?? true);
  const [avaLink, setAvaLink] = useState(cloudSettings.avaLink || 'https://fajopa.net/ava/');
  const [avaEnabled, setAvaEnabled] = useState(cloudSettings.avaEnabled ?? true);
  const [contemplacaoLink, setContemplacaoLink] = useState(cloudSettings.contemplacaoLink || 'https://revista.fajopa.com/index.php/contemplacao');
  const [contemplacaoEnabled, setContemplacaoEnabled] = useState(cloudSettings.contemplacaoEnabled ?? true);
  const [muralEnabled, setMuralEnabled] = useState(cloudSettings.muralEnabled ?? true);
  const [eventsEnabled, setEventsEnabled] = useState(cloudSettings.eventsEnabled ?? true);
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(cloudSettings.appointmentsEnabled ?? true);
  const [appointmentsExternalLink, setAppointmentsExternalLink] = useState(cloudSettings.appointmentsExternalLink || '');
  const [professionals, setProfessionals] = useState<{ id: string, name: string, role: string, photoUrl: string | null }[]>(
    cloudSettings.professionals || DEFAULT_PROFESSIONALS.map(p => ({
      id: p.id,
      name: p.name,
      role: p.roles?.[0] || 'Profissional',
      photoUrl: p.photoUrl || null,
      appointmentLink: p.appointmentLink || ''
    }))
  );
  const [useWhatsappMural, setUseWhatsappMural] = useState(cloudSettings.useWhatsappMural ?? true);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(cloudSettings.autoApproveEnabled ?? false);
  const [autoApproveWhitelistText, setAutoApproveWhitelistText] = useState(
    cloudSettings.autoApproveWhitelistText || (cloudSettings.autoApproveWhitelist ? cloudSettings.autoApproveWhitelist.join("\n") : "")
  );

  const [activeTab, setActiveTab] = useState<"visual" | "content" | "database" | "system" | "mural" | "appointments">(
    "visual",
  );

  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPalettes, setAiPalettes] = useState<any[]>([]);

  const [status, setStatus] = useState<{
    msg: string;
    type: "success" | "error" | "loading";
  } | null>(null);
  const [isPreviewFront, setIsPreviewFront] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cardLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackLogoInputRef = useRef<HTMLInputElement>(null);
  const cardSecondaryBackLogoInputRef = useRef<HTMLInputElement>(null);
  const cardBackInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const rectorSignatureInputRef = useRef<HTMLInputElement>(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showBackup, setShowBackup] = useState(false);

  const handleUnlock = () => {
    const current =
      localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (unlockPassword === current) {
      setIsUnlocked(true);
      setStatus(null);
    } else {
      showStatus("Senha incorreta.", "error");
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleSaveGeneral = async () => {
    setStatus({ msg: "Sincronizando com a nuvem...", type: "loading" });

    try {
      await updateSettings({
        url,
        directorName,
        rectorName,
        instName,
        instColor,
        instLogo,
        cardLogo,
        cardBackLogo,
        cardSecondaryBackLogo,
        cardBackImage,
        cardFrontText,
        cardBackText,
        frontLogoConfig,
        backLogoConfig,
        instSignature,
        rectorSignature,
        signatureScale,
        rectorSignatureScale,
        secondaryBackLogoScale,
        instDescription,
        cardDescription,
        visibleFields,
        customDioceses,
        customCourses,
        customRoles,
        databaseName,
        cardZoom,
        seminariesConfig,
        useGoogleScriptCertificate,
        googleScriptCertificateUrl,
        certificateValidationUrl,
        headerLogoUrl,
        headerLogoLink,
        headerLogoEnabled,
        liveBadgeEnabled,
        liveBadgeUrl,
        socialFacebookEnabled,
        socialFacebookUrl,
        socialInstagramEnabled,
        socialInstagramUrl,
        socialYoutubeEnabled,
        socialYoutubeUrl,
        socialWhatsappEnabled,
        socialWhatsappUrl,
        socialEmailEnabled,
        socialEmailUrl,
        sophiaLink,
        sophiaEnabled,
        libraryLink,
        libraryEnabled,
        fajopaPlusUrl,
        fajopaPlusEnabled,
        avaLink,
        avaEnabled,
        contemplacaoLink,
        contemplacaoEnabled,
        useWhatsappMural,
        muralEnabled,
        eventsEnabled,
        appointmentsEnabled,
        appointmentsExternalLink,
        professionals,
        autoApproveEnabled,
        autoApproveWhitelist: autoApproveWhitelistText
          .split(/[\n,;]+/)
          .map(s => s.trim())
          .filter(Boolean),
        autoApproveWhitelistText,
      });

      // Legacy fallback
      localStorage.setItem(URL_STORAGE_KEY, url);
      localStorage.setItem(DIRECTOR_NAME_KEY, directorName);
      localStorage.setItem("davveroId_rector_name", rectorName);
      localStorage.setItem(INSTITUTION_NAME_KEY, instName);
      localStorage.setItem(INSTITUTION_COLOR_KEY, instColor);
      localStorage.setItem(INSTITUTION_DESCRIPTION_KEY, instDescription);
      localStorage.setItem(CARD_DESCRIPTION_KEY, cardDescription);
      localStorage.setItem(
        CARD_VISIBLE_FIELDS_KEY,
        JSON.stringify(visibleFields),
      );
      localStorage.setItem(CARD_FRONT_TEXT_KEY, cardFrontText);
      localStorage.setItem(CARD_BACK_TEXT_KEY, cardBackText);
      localStorage.setItem(
        CARD_FRONT_LOGO_CONFIG_KEY,
        JSON.stringify(frontLogoConfig),
      );
      localStorage.setItem(
        CARD_BACK_LOGO_CONFIG_KEY,
        JSON.stringify(backLogoConfig),
      );
      localStorage.setItem(
        CARD_SIGNATURE_CONFIG_KEY,
        signatureScale.toString(),
      );
      localStorage.setItem(
        SECONDARY_BACK_LOGO_SCALE_KEY,
        secondaryBackLogoScale.toString(),
      );
      if (instLogo) localStorage.setItem(INSTITUTION_LOGO_KEY, instLogo);
      if (cardLogo) localStorage.setItem(CARD_LOGO_KEY, cardLogo);
      if (cardBackLogo) localStorage.setItem(CARD_BACK_LOGO_KEY, cardBackLogo);
      if (cardBackImage)
        localStorage.setItem(CARD_BACK_IMAGE_KEY, cardBackImage);
      if (instSignature)
        localStorage.setItem(DIRECTOR_SIGNATURE_KEY, instSignature);

      showStatus("Configurações aplicadas globalmente!", "success");
    } catch (e: any) {
      console.error(e);
      if (e?.code === 'invalid-argument' || e?.message?.includes('too large')) {
         showStatus("Erro: Imagens muito grandes anexadas. Tente removê-las e recarregar.", "error");
      } else {
         showStatus("Erro ao salvar no banco de dados.", "error");
      }
    }
  };

  const handleMagicPalette = async () => {
    if (!instLogo) {
      showStatus("Faça upload de um logo primeiro.", "error");
      return;
    }

    try {
      setIsAnalyzing(true);

      const base64Data = instLogo.split(",")[1];
      const mimeType = instLogo.split(";")[0].split(":")[1];

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: `Analyze this corporate logo and generate 3 distinct, professional color palettes (Modern, Classic, Vibrant) that would work well for a physical ID card and a web application theme. 
                Each palette must include:
                - A name
                - A primary color (derived from the logo)
                - A complementary secondary color
                - An accent color
                - A short description of the vibe.`,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  primary: {
                    type: "string",
                    description: "Hex code including #",
                  },
                  secondary: {
                    type: "string",
                    description: "Hex code including #",
                  },
                  accent: {
                    type: "string",
                    description: "Hex code including #",
                  },
                  description: { type: "string" },
                },
                required: [
                  "name",
                  "primary",
                  "secondary",
                  "accent",
                  "description",
                ],
              },
            },
          },
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const response = await res.json();
      const palettes = JSON.parse(response.text || "[]");
      if (palettes.length > 0) {
        setAiPalettes(palettes);
        showStatus("Sugestões de paletas geradas!", "success");
      } else {
        showStatus("Não foi possível gerar sugestões.", "error");
      }
    } catch (error) {
      console.error("AI Palette Generation Error:", error);
      showStatus("Erro ao conectar com a IA.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
    maxSizeKB = 5120, // Initial check, but we will compress it down
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeKB * 1024) {
      showStatus(`Arquivo muito grande. Máximo ${maxSizeKB}KB.`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Máximo 800px para redimensionamento
        const MAX_DIM = 800;
        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to low quality JPEG if not transparent png, otherwise use PNG
          const dataUrl = file.type === "image/png" ? canvas.toDataURL("image/png", 0.8) : canvas.toDataURL("image/jpeg", 0.7);
          setter(dataUrl);
        } else {
          setter(ev.target?.result as string);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };


  const handleSeminaryFileWrapper = (
    e: React.ChangeEvent<HTMLInputElement>,
    seminary: string,
    field: "logo" | "signature"
  ) => {
    handleFileUpload(e, (val) => {
      setSeminariesConfig(prev => ({
        ...prev,
        [seminary]: {
          ...prev[seminary],
          [field]: val
        }
      }));
    }, 5120); // allow up to 5MB
  };

  const updateSeminaryConfig = (seminary: string, field: "rectorName", val: string) => {
    setSeminariesConfig(prev => ({
      ...prev,
      [seminary]: {
        ...prev[seminary],
        [field]: val
      }
    }));
  };

  const addSeminaryProfessional = (seminary: string) => {
    setSeminariesConfig(prev => {
      const current = prev[seminary] || { logo: null, signature: null, rectorName: '' };
      const professionals = current.professionals || [];
      return {
        ...prev,
        [seminary]: {
          ...current,
          professionals: [...professionals, { id: 'prof_' + Math.random().toString(36).substr(2, 9), name: '', role: 'PSICÓLOGO(A)', photoUrl: null, appointmentLink: '' }]
        }
      };
    });
  };

  const updateSeminaryProfessional = (seminary: string, id: string, field: string, val: string | null) => {
    setSeminariesConfig(prev => {
      const current = prev[seminary];
      if (!current || !current.professionals) return prev;
      return {
        ...prev,
        [seminary]: {
          ...current,
          professionals: current.professionals.map(p => p.id === id ? { ...p, [field]: val } : p)
        }
      };
    });
  };

  const removeSeminaryProfessional = (seminary: string, id: string) => {
    setSeminariesConfig(prev => {
      const current = prev[seminary];
      if (!current || !current.professionals) return prev;
      return {
        ...prev,
        [seminary]: {
          ...current,
          professionals: current.professionals.filter(p => p.id !== id)
        }
      };
    });
  };

  const addGlobalProfessional = () => {
    setProfessionals(prev => [...prev, { id: 'prof_' + Math.random().toString(36).substr(2, 9), name: '', role: 'PSICÓLOGO(A)', photoUrl: null, appointmentLink: '' }]);
  };

  const updateGlobalProfessional = (id: string, field: string, val: string | null) => {
    setProfessionals(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const removeGlobalProfessional = (id: string) => {
    setProfessionals(prev => prev.filter(p => p.id !== id));
  };

  const handleSavePassword = () => {
    const current =
      localStorage.getItem(PASSWORD_STORAGE_KEY) || DEFAULT_ADMIN_PASSWORD;
    if (password !== current) {
      showStatus("A senha atual está incorreta.", "error");
      return;
    }
    if (newPassword.length < 4) {
      showStatus("A nova senha precisa ter mais caracteres.", "error");
      return;
    }
    localStorage.setItem(PASSWORD_STORAGE_KEY, newPassword);
    setPassword("");
    setNewPassword("");
    showStatus("Palavra-passe alterada!", "success");
  };

  const showStatus = (msg: string, type: "success" | "error" | "loading") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 z-[100] overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-2xl rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-[90vh] border border-white/10">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white leading-none">
                Configurações
              </h2>
              <p className="hidden sm:block text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">
                Personalização e Administração
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={handleSaveGeneral}
                disabled={status?.type === "loading"}
                className="btn-modern bg-sky-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {status?.type === "loading" ? (
                  <RotateCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">{status?.type === "loading" ? "Salvando..." : "Salvar"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ height: 0, opacity: 0, margin: 0 }}
              animate={{ height: "auto", opacity: 1, margin: "16px" }}
              exit={{ height: 0, opacity: 0, margin: 0 }}
              className={`overflow-hidden p-3 text-center rounded-xl text-sm font-medium ${
                status.type === "success" 
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" 
                  : status.type === "loading"
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 shadow-inner flex items-center justify-center gap-2"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
              }`}
            >
              {status.type === "loading" && <RotateCw className="w-4 h-4 animate-spin" />}
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {!isUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 animated-scale-in">
            <div className="w-full max-w-xs space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Área Restrita. Insira a senha mestra para continuar.
                </p>
              </div>
              <input
                type="password"
                placeholder="Senha Mestra"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                className="w-full rounded-xl py-3 px-4 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-center shadow-sm"
              />
              <button
                onClick={handleUnlock}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                Desbloquear
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Preview Area */}
            <div className="bg-slate-200 dark:bg-slate-950 p-4 sm:p-6 flex flex-col items-center shrink-0 border-b border-slate-200 dark:border-slate-800 relative animated-fade-in">
              <div className="absolute top-2 left-4 z-20 flex gap-2">
                <button
                  onClick={() => setIsPreviewFront(!isPreviewFront)}
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors flex items-center gap-1.5"
                >
                  <RotateCw
                    className="w-3 h-3"
                    rotate={isPreviewFront ? 0 : 180}
                  />
                  {isPreviewFront ? "Ver Verso" : "Ver Frente"}
                </button>
              </div>

              <div
                className="w-full max-w-[320px] transition-all duration-500"
                style={{
                  transform: isPreviewFront
                    ? "rotateY(0deg)"
                    : "rotateY(180deg)",
                  transformStyle: "preserve-3d",
                }}
              >
                <FajopaIDCard
                  member={MOCK_MEMBER as any}
                  exportMode={true}
                  settings={{
                    directorName,
                    rectorName,
                    instLogo,
                    cardLogo,
                    cardBackLogo,
                    cardSecondaryBackLogo,
                    cardFrontText,
                    cardBackText,
                    frontLogoConfig,
                    backLogoConfig,
                    cardBackImage,
                    cardDescription,
                    signatureScale,
                    rectorSignatureScale,
                    secondaryBackLogoScale,
                    instSignature,
                    rectorSignature,
                    instName,
                    instColor,
                    url,
                    visibleFields,
                    cardZoom,
                  }}
                />
              </div>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-3 uppercase tracking-widest opacity-60">
                Pré-visualização em Tempo Real
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 justify-center sm:justify-start">
              {[
                { id: "visual", label: "Identidade", icon: Palette },
                { id: "content", label: "Campos/Textos", icon: FileText },
                { id: "database", label: "Banco de Dados", icon: Link },
                { id: "system", label: "Sistema", icon: Settings },
                { id: "mural", label: "Mural", icon: MessageCircle },
                { id: "appointments", label: "Seminário", icon: HeartHandshake },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border ${
                    activeTab === tab.id
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide">
              {status && (
                <div
                  className={`p-3 text-center rounded-xl text-sm font-medium ${status.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                >
                  {status.msg}
                </div>
              )}

              {activeTab === "visual" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Identidade Visual */}
                  <div className="bg-sky-50/50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-100 dark:border-sky-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300 uppercase tracking-widest text-[10px]">
                      <Palette className="w-4 h-4" /> Branding Principal
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">
                          Logo da Instituição
                        </label>

                        {instLogo ? (
                          <div className="relative group">
                            <img
                              src={instLogo}
                              alt="Logo Inst"
                              className="h-16 w-auto object-contain mb-2 rounded shadow-sm"
                            />
                            <button
                              onClick={() => setInstLogo(null)}
                              className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all border border-slate-200 dark:border-slate-600 mb-2"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                        )}
                        <input
                          type="file"
                          ref={logoInputRef}
                          onChange={(e) =>
                            handleFileUpload(e, setInstLogo, 5120)
                          }
                          accept="image/*"
                          className="hidden"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">
                          Logo usada no cabeçalho e landing
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Nome Institucional
                            <button
                              onClick={() => setInstName("DAVVERO System")}
                              className="bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 hover:text-white px-2 py-0.5 rounded text-[8px] transition-colors"
                            >
                              Usar Nome do Programa
                            </button>
                          </label>
                          <input
                            type="text"
                            value={instName}
                            onChange={(e) =>
                              setInstName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold"
                            placeholder="Ex: FAJOPA"
                          />
                        </div>

                        <div className="col-span-2 relative">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Descrição do Cabeçalho
                          </label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={instDescription}
                              onChange={(e) =>
                                setInstDescription(e.target.value.toUpperCase())
                              }
                              className="input-modern w-full rounded-xl py-2 pl-9 pr-3 text-[10px] font-medium"
                              placeholder="Ex: SEU SISTEMA DE GESTÃO PARA FACULDADES, SEMINÁRIOS E DIOCESES"
                            />
                          </div>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Cor Primária
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={instColor}
                              onChange={(e) => setInstColor(e.target.value)}
                              className="w-8 h-8 rounded border-none cursor-pointer p-0"
                            />
                            <input
                              type="text"
                              value={instColor}
                              onChange={(e) => setInstColor(e.target.value)}
                              className="input-modern flex-1 rounded-xl py-1 px-3 text-[10px] uppercase font-mono"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 flex items-end">
                          <button
                            onClick={handleMagicPalette}
                            disabled={isAnalyzing}
                            className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isAnalyzing ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            IA Paletas
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Branding da Carteirinha */}
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 uppercase tracking-widest text-[10px]">
                      <ImageIcon className="w-4 h-4" /> Layout do Cartão
                    </h3>

                    <div className="space-y-6">
                      {/* Parte da Frente */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Frente do Cartão
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                              Logo Frontal
                            </span>
                            {cardLogo ? (
                              <div className="relative group">
                                <img
                                  src={cardLogo}
                                  alt="Front Logo"
                                  className="h-10 w-auto object-contain mb-1 rounded"
                                />
                                <button
                                  onClick={() => setCardLogo(null)}
                                  className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-110 shadow-lg"
                                >
                                  <Trash2 className="w-2 h-2" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  cardLogoInputRef.current?.click()
                                }
                                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                            )}
                            <input
                              type="file"
                              ref={cardLogoInputRef}
                              onChange={(e) =>
                                handleFileUpload(e, setCardLogo, 5120)
                              }
                              accept="image/*"
                              className="hidden"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">
                              Ajustes Rápidos
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                              <input
                                type="range"
                                min="-50"
                                max="50"
                                value={frontLogoConfig.y}
                                onChange={(e) =>
                                  setFrontLogoConfig({
                                    ...frontLogoConfig,
                                    y: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <input
                                type="range"
                                min="50"
                                max="200"
                                value={frontLogoConfig.scale}
                                onChange={(e) =>
                                  setFrontLogoConfig({
                                    ...frontLogoConfig,
                                    scale: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fundo Personalizado */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Verso do Cartão
                        </label>
                        <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Imagem de Fundo Acrílico (Apenas Verso)
                          </span>
                          {cardBackImage ? (
                            <div className="relative group w-full flex justify-center">
                              <img
                                src={cardBackImage}
                                alt="Fundo Verso"
                                className="h-16 w-auto object-cover mb-1 rounded-md shadow-md"
                              />
                              <button
                                onClick={() => setCardBackImage(null)}
                                className="absolute -top-2 scale-75 -right-2 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-95 shadow-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => cardBackInputRef.current?.click()}
                              className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 gap-2 text-xs font-bold"
                            >
                              <Upload className="w-4 h-4" /> Enviar Fundo
                              Opcional
                            </button>
                          )}
                          <input
                            type="file"
                            ref={cardBackInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setCardBackImage, 5120)
                            }
                            accept="image/*"
                            className="hidden"
                          />
                          <p className="text-[8px] text-center text-slate-400 mt-2">
                            Dica: Envie uma imagem no formato retrato (vertical)
                            e de alta resolução. O fundo será aplicado com o
                            efeito acrílico natural.
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg w-full mt-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2 text-center">
                            Logo Secundária (Verso) - Apenas para Dioceses
                            Autorizadas
                          </span>
                          {cardSecondaryBackLogo ? (
                            <div className="relative group w-full flex justify-center">
                              <img
                                src={cardSecondaryBackLogo}
                                alt="Logo Secundária"
                                className="h-10 w-auto object-contain mb-1 rounded"
                              />
                              <button
                                onClick={() => setCardSecondaryBackLogo(null)}
                                className="absolute -top-2 scale-75 right-1/4 p-1 bg-rose-500 text-white rounded-full transition-transform group-hover:scale-95 shadow-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                cardSecondaryBackLogoInputRef.current?.click()
                              }
                              className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-sky-500 gap-2 text-xs font-bold"
                            >
                              <Upload className="w-4 h-4" /> Enviar Logo da
                              Diocese
                            </button>
                          )}
                          <input
                            type="file"
                            ref={cardSecondaryBackLogoInputRef}
                            onChange={(e) =>
                              handleFileUpload(
                                e,
                                setCardSecondaryBackLogo,
                                5120,
                              )
                            }
                            accept="image/*"
                            className="hidden"
                          />

                          <div className="w-full mt-3">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-1">
                              Tamanho da Logo Secundária (
                              {secondaryBackLogoScale}%)
                            </label>
                            <input
                              type="range"
                              min="50"
                              max="250"
                              value={secondaryBackLogoScale}
                              onChange={(e) =>
                                setSecondaryBackLogoScale(
                                  Number(e.target.value),
                                )
                              }
                              className="w-full accent-sky-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <p className="text-[8px] text-center text-slate-400 mt-2 leading-tight">
                            Esta logo aparecerá do lado direito do verso,
                            espelhando a logo principal, exclusivamente para as
                            dioceses: Assis, Presidente Prudente, Ourinhos,
                            Araçatuba e Lins.
                          </p>
                        </div>
                      </div>

                      {/* Zoom do Cartão */}
                      <div className="space-y-3 p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                          Escala do Cartão (Zoom)
                        </label>
                        <div className="w-full">
                          <label className="block text-[8px] font-bold text-slate-400 uppercase text-center mb-1">
                            Zoom ({cardZoom}x)
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={cardZoom}
                            onChange={(e) =>
                              setCardZoom(Number(e.target.value))
                            }
                            className="w-full accent-amber-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <p className="text-[8px] text-center text-slate-400 mt-2 leading-tight">
                            Ajusta o tamanho visual global do cartão na
                            interface. Valores de 0.5 a 1.5.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Visibilidade de Campos */}
                  <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />{" "}
                      Exibição de Dados
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "name", label: "Nome" },
                        { id: "ra", label: "R.A." },
                        { id: "course", label: "Curso" },
                        { id: "diocese", label: "Diocese" },
                        { id: "birth", label: "Nascimento" },
                        { id: "validity", label: "Validade" },
                        { id: "photo", label: "Foto" },
                        { id: "qrcode", label: "QR Code" },
                        { id: "logo", label: "Logotipos" },
                        { id: "signature", label: "Assin. Diretor" },
                        { id: "rectorSignature", label: "Assin. Reitor" },
                        { id: "director", label: "Nome Diretor" },
                        { id: "rector", label: "Nome Reitor" },
                        { id: "footer", label: "Rodapé Info" },
                      ].map((field) => (
                        <label
                          key={field.id}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={visibleFields[field.id]}
                              onChange={(e) =>
                                setVisibleFields({
                                  ...visibleFields,
                                  [field.id]: e.target.checked,
                                })
                              }
                              className="sr-only"
                            />
                            <div
                              className={`w-8 h-4 rounded-full transition-colors ${visibleFields[field.id] ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
                            />
                            <div
                              className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${visibleFields[field.id] ? "translate-x-4" : ""}`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-sky-600 transition-colors uppercase">
                            {field.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
                      Textos Institucionais
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Diretor Geral
                          </label>
                          <input
                            type="text"
                            value={directorName}
                            onChange={(e) =>
                              setDirectorName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-[10px] font-semibold"
                            placeholder="NOME DO DIRETOR"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Reitor do Seminário
                          </label>
                          <input
                            type="text"
                            value={rectorName}
                            onChange={(e) =>
                              setRectorName(e.target.value.toUpperCase())
                            }
                            className="input-modern w-full rounded-xl py-2 px-3 text-[10px] font-semibold"
                            placeholder="NOME DO REITOR"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Assinaturas */}
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Assinatura Diretor
                          </span>
                          {instSignature ? (
                            <div className="relative group mb-3">
                              <img
                                src={instSignature}
                                alt="Assin"
                                className="h-10 w-auto object-contain bg-white rounded p-0.5"
                              />
                              <button
                                onClick={() => setInstSignature(null)}
                                className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => signatureInputRef.current?.click()}
                              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-sky-500 mb-3"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <input
                            type="file"
                            ref={signatureInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setInstSignature, 5120)
                            }
                            accept="image/png"
                            className="hidden"
                          />

                          <div className="w-full mt-2">
                            <div className="flex justify-between text-[8px] text-slate-400 mb-1">
                              <span>Tamanho: {signatureScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="30"
                              max="250"
                              value={signatureScale}
                              onChange={(e) =>
                                setSignatureScale(Number(e.target.value))
                              }
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                            Assinatura Reitor
                          </span>
                          {rectorSignature ? (
                            <div className="relative group mb-3">
                              <img
                                src={rectorSignature}
                                alt="Assin"
                                className="h-10 w-auto object-contain bg-white rounded p-0.5"
                              />
                              <button
                                onClick={() => setRectorSignature(null)}
                                className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                rectorSignatureInputRef.current?.click()
                              }
                              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-sky-500 mb-3"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}
                          <input
                            type="file"
                            ref={rectorSignatureInputRef}
                            onChange={(e) =>
                              handleFileUpload(e, setRectorSignature, 5120)
                            }
                            accept="image/png"
                            className="hidden"
                          />

                          <div className="w-full mt-2">
                            <div className="flex justify-between text-[8px] text-slate-400 mb-1">
                              <span>Tamanho: {rectorSignatureScale}%</span>
                            </div>
                            <input
                              type="range"
                              min="30"
                              max="250"
                              value={rectorSignatureScale}
                              onChange={(e) =>
                                setRectorSignatureScale(Number(e.target.value))
                              }
                              className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-800 dark:text-amber-300 uppercase tracking-widest text-[10px]">
                      <Type className="w-4 h-4" /> Configurações por Seminário
                    </h3>
                    <div className="space-y-6">
                      {Array.from(new Set([...AVAILABLE_SEMINARIES, ...Object.keys(seminariesConfig)])).map(sem => {
                        const config = seminariesConfig[sem] || { logo: null, signature: null, rectorName: '' };
                        return (
                          <div key={sem} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">{sem}</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2">Logo (Frente da Carteirinha)</label>
                                {config.logo ? (
                                  <div className="relative group mb-2">
                                    <img src={config.logo} alt={`Logo ${sem}`} className="h-10 w-auto object-contain bg-white rounded p-0.5 border" />
                                    <button onClick={() => updateSeminaryConfig(sem, "logo" as any, null as any)} className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <label className="p-2 px-4 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-700 cursor-pointer text-slate-500 hover:text-sky-500 mb-2 flex items-center gap-2 text-xs">
                                    <Upload className="w-4 h-4" /> Carregar Logo
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSeminaryFileWrapper(e, sem, 'logo')} />
                                  </label>
                                )}
                              </div>
                              
                              <div className="flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2">Assinatura Reitor (Verso)</label>
                                {config.signature ? (
                                  <div className="relative group mb-2">
                                    <img src={config.signature} alt={`Assinatura ${sem}`} className="h-10 w-auto object-contain bg-white rounded p-0.5 border" />
                                    <button onClick={() => updateSeminaryConfig(sem, "signature" as any, null as any)} className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <label className="p-2 px-4 rounded-lg bg-slate-100 border border-slate-200 dark:bg-slate-700 cursor-pointer text-slate-500 hover:text-sky-500 mb-2 flex items-center gap-2 text-xs">
                                    <Upload className="w-4 h-4" /> Carregar Assinatura
                                    <input type="file" className="hidden" accept="image/png" onChange={(e) => handleSeminaryFileWrapper(e, sem, 'signature')} />
                                  </label>
                                )}
                              </div>
                            </div>
                            
                            <div>
                               <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome do Reitor deste Seminário</label>
                               <input 
                                 type="text" 
                                 placeholder="NOME COMPLETO DO REITOR" 
                                 value={config.rectorName || ''}
                                 onChange={(e) => updateSeminaryConfig(sem, 'rectorName', e.target.value.toUpperCase())}
                                 className="input-modern w-full rounded-lg py-2 px-3 text-xs" 
                               />
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                               <div className="flex justify-between items-center mb-2">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase">Profissionais de Seminário</label>
                                 <button onClick={() => addSeminaryProfessional(sem)} className="text-[10px] bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-1 rounded font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors uppercase flex items-center gap-1">
                                   <Plus className="w-3 h-3" /> Adicionar
                                 </button>
                               </div>
                               <div className="space-y-2">
                                 {(config.professionals || []).length === 0 ? (
                                   <p className="text-[10px] text-slate-400 italic">Nenhum profissional configurado.</p>
                                 ) : (
                                   (config.professionals || []).map(prof => (
                                     <div key={prof.id} className="flex flex-col gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                       <div className="flex items-center gap-2">
                                          {prof.photoUrl ? (
                                            <div className="relative">
                                              <img src={prof.photoUrl} alt="Foto" className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 object-cover" />
                                              <button onClick={() => updateSeminaryProfessional(sem, prof.id, "photoUrl", null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><Trash2 className="w-2.5 h-2.5" /></button>
                                            </div>
                                          ) : (
                                            <label className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition">
                                              <Upload className="w-3 h-3 text-slate-500" />
                                              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                handleFileUpload(e, (val) => {
                                                  updateSeminaryProfessional(sem, prof.id, "photoUrl", val);
                                                });
                                              }} />
                                            </label>
                                          )}
                                          <div className="flex-1 grid grid-cols-2 gap-2">
                                            <input type="text" placeholder="Nome Completo" value={prof.name} onChange={e => updateSeminaryProfessional(sem, prof.id, "name", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="Cargo/Função" value={prof.role} onChange={e => updateSeminaryProfessional(sem, prof.id, "role", e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="Link de Agendamento (opcional)" value={prof.appointmentLink || ''} onChange={e => updateSeminaryProfessional(sem, prof.id, "appointmentLink", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                            <input type="text" placeholder="WhatsApp (ex: (00) 00000-0000)" value={prof.whatsappNumber || ''} onChange={e => updateSeminaryProfessional(sem, prof.id, "whatsappNumber", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs outline-none" />
                                          </div>
                                          <button onClick={() => removeSeminaryProfessional(sem, prof.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Remover Profissional">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                     </div>
                                   ))
                                 )}
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "database" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  {/* Banco de Dados */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest text-[10px]">
                      <Link className="w-4 h-4" /> Configurações de Dados
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Nome do Banco de Dados (Exibição no Header)
                        </label>
                        <input
                          type="text"
                          value={databaseName}
                          onChange={(e) =>
                            setDatabaseName(e.target.value.toUpperCase())
                          }
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs font-bold"
                          placeholder="Ex: FAJOPA e SPSCJ"
                        />
                        <p className="text-[9px] text-slate-400 mt-2 italic">
                          Este nome aparece no cabeçalho para identificar a base
                          de dados ativa no momento.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          URL Base do Projeto
                        </label>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest text-[10px]">
                      <Settings className="w-4 h-4" /> Header & Atalhos Rápidos
                    </h3>
                    
                    <div className="space-y-6">
                      <div className="col-span-1 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={headerLogoEnabled}
                            onChange={(e) => setHeaderLogoEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Logo no Topo
                        </label>
                        {headerLogoEnabled && (
                          <div className="pl-6 space-y-3">
                            <div className="flex flex-col items-start gap-2">
                              {headerLogoUrl ? (
                                <div className="relative group">
                                  <img
                                    src={headerLogoUrl}
                                    alt="Header Logo"
                                    className="h-16 w-auto object-contain rounded bg-white p-2 border border-slate-200"
                                  />
                                  <button
                                    onClick={() => setHeaderLogoUrl(null)}
                                    className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (e) => setHeaderLogoUrl(e.target?.result as string);
                                        reader.readAsDataURL(file);
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded text-xs font-bold transition-all hover:bg-emerald-200"
                                >
                                  Fazer Upload de Logo do Topo
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Link ao Clicar na Logo
                              </label>
                              <input
                                type="text"
                                value={headerLogoLink}
                                onChange={(e) => setHeaderLogoLink(e.target.value)}
                                className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                                placeholder="https://fajopa.org"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={liveBadgeEnabled}
                            onChange={(e) => setLiveBadgeEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Indicador "Ao Vivo" sobre a Logo
                        </label>
                        {liveBadgeEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Transmissão (YouTube)
                            </label>
                            <input
                              type="text"
                              value={liveBadgeUrl}
                              onChange={(e) => setLiveBadgeUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.youtube.com/@fajopademarilia/streams"
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialFacebookEnabled}
                            onChange={(e) => setSocialFacebookEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Ícone "Facebook" ao lado da Logo
                        </label>
                        {socialFacebookEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Facebook
                            </label>
                            <input
                              type="text"
                              value={socialFacebookUrl}
                              onChange={(e) => setSocialFacebookUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.facebook.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialInstagramEnabled}
                            onChange={(e) => setSocialInstagramEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Ícone "Instagram" ao lado da Logo
                        </label>
                        {socialInstagramEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Instagram
                            </label>
                            <input
                              type="text"
                              value={socialInstagramUrl}
                              onChange={(e) => setSocialInstagramUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.instagram.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialYoutubeEnabled}
                            onChange={(e) => setSocialYoutubeEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Ícone "YouTube" ao lado da Logo
                        </label>
                        {socialYoutubeEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do YouTube
                            </label>
                            <input
                              type="text"
                              value={socialYoutubeUrl}
                              onChange={(e) => setSocialYoutubeUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.youtube.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialWhatsappEnabled}
                            onChange={(e) => setSocialWhatsappEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Ícone "WhatsApp" ao lado da Logo
                        </label>
                        {socialWhatsappEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do WhatsApp
                            </label>
                            <input
                              type="text"
                              value={socialWhatsappUrl}
                              onChange={(e) => setSocialWhatsappUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://wa.me/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialEmailEnabled}
                            onChange={(e) => setSocialEmailEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Ícone "E-mail" ao lado da Logo
                        </label>
                        {socialEmailEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link (mailto) do E-mail
                            </label>
                            <input
                              type="text"
                              value={socialEmailUrl}
                              onChange={(e) => setSocialEmailUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="mailto:..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={sophiaEnabled}
                            onChange={(e) => setSophiaEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Botão "Portal do Aluno"
                        </label>
                        {sophiaEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Portal Sophia
                            </label>
                            <input
                              type="text"
                              value={sophiaLink}
                              onChange={(e) => setSophiaLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://portal.sophia.com.br/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={libraryEnabled}
                            onChange={(e) => setLibraryEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Botão "Biblioteca"
                        </label>
                        {libraryEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Biblioteca
                            </label>
                            <input
                              type="text"
                              value={libraryLink}
                              onChange={(e) => setLibraryLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://biblioteca.sophia.com.br/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={avaEnabled}
                            onChange={(e) => setAvaEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Botão "AVA (Ambiente Virtual)"
                        </label>
                        {avaEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do AVA
                            </label>
                            <input
                              type="text"
                              value={avaLink}
                              onChange={(e) => setAvaLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://fajopa.net/ava/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={contemplacaoEnabled}
                            onChange={(e) => setContemplacaoEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Ativar Botão "Revista Contemplação"
                        </label>
                        {contemplacaoEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Revista Contemplação
                            </label>
                            <input
                              type="text"
                              value={contemplacaoLink}
                              onChange={(e) => setContemplacaoLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://revista.fajopa.com/..."
                            />
                          </div>
                        )}
                      </div>
                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={muralEnabled}
                            onChange={(e) => setMuralEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Exibir "Mural" no App
                        </label>
                      </div>

                      <div className="border-t border-emerald-200 dark:border-emerald-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={eventsEnabled}
                            onChange={(e) => setEventsEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Exibir "Eventos" no App
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Gestão de Listas */}
                  <div className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px]">
                      Gerenciamento de Listas Customizadas
                    </h3>
                    <div className="space-y-4">
                      {/* Dioceses */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Dioceses ({customDioceses.length})
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl min-h-[40px]">
                          {customDioceses.map((d, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-bold flex items-center gap-2 group"
                            >
                              {d}
                              <button
                                onClick={() =>
                                  setCustomDioceses(
                                    customDioceses.filter(
                                      (_, idx) => idx !== i,
                                    ),
                                  )
                                }
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Adicionar Diocese + Enter"
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value
                                .trim()
                                .toUpperCase();
                              if (val && !customDioceses.includes(val)) {
                                setCustomDioceses([...customDioceses, val]);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                      </div>

                      {/* Cursos */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Cursos ({customCourses.length})
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl min-h-[40px]">
                          {customCourses.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-bold flex items-center gap-2 group"
                            >
                              {c}
                              <button
                                onClick={() =>
                                  setCustomCourses(
                                    customCourses.filter((_, idx) => idx !== i),
                                  )
                                }
                                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Adicionar Curso + Enter"
                          className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value
                                .trim()
                                .toUpperCase();
                              if (val && !customCourses.includes(val)) {
                                setCustomCourses([...customCourses, val]);
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Backups */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-indigo-700 dark:text-indigo-300 uppercase tracking-widest text-[10px]">
                      <Database className="w-4 h-4" /> Gerenciamento de Backups
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                      Exporte ou importe a base de dados completa (incluindo membros e lixeira).
                    </p>
                    <button
                      onClick={() => setShowBackup(true)}
                      className="btn-modern w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Database className="w-4 h-4" /> Abrir Painel de Backups
                    </button>
                  </div>
                </div>
              )}

              {activeTab === ("system" as any) && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[10px]">
                      <Palette className="w-4 h-4" /> Aparência do Aplicativo
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          localStorage.setItem("theme", "light");
                          document.documentElement.classList.remove("dark");
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Claro ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Sun className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Claro
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          localStorage.setItem("theme", "dark");
                          document.documentElement.classList.add("dark");
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Escuro ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Moon className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Escuro
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem("theme");
                          if (
                            window.matchMedia("(prefers-color-scheme: dark)")
                              .matches
                          ) {
                            document.documentElement.classList.add("dark");
                          } else {
                            document.documentElement.classList.remove("dark");
                          }
                          window.dispatchEvent(new Event("themeChange"));
                          showStatus("Modo Sistema ativado.", "success");
                        }}
                        className="btn-modern flex flex-col items-center justify-center p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                      >
                        <Settings className="w-5 h-5 mb-1" />{" "}
                        <span className="text-[10px] font-bold uppercase">
                          Auto
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-fuchsia-50 dark:bg-fuchsia-900/10 p-5 rounded-2xl border border-fuchsia-200 dark:border-fuchsia-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-widest text-[10px]">
                      <Sparkles className="w-4 h-4" /> Modal de Boas-vindas
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      Reexibir a tela de boas-vindas como se fosse sua primeira vez acessando a nova versão do aplicativo.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        // Delay slight to allow closing modal before opening new one
                        setTimeout(() => {
                           (window as any).triggerWelcomeModal?.();
                        }, 50);
                      }}
                      className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                    >
                      Testar Modal
                    </button>
                  </div>

                  <div className="bg-sky-50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-200 dark:border-sky-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-700 dark:text-sky-300 uppercase tracking-widest text-[10px]">
                      <BellRing className="w-4 h-4" /> Notificações do Sistema
                    </h3>
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Ative as notificações de navegador para ser alertado
                        sempre que novos alunos solicitarem verificações ou
                        enviarem sugestões de edição da identidade estudantil.
                      </p>

                      <button
                        onClick={() => {
                          if (!("Notification" in window)) {
                            showStatus(
                              "Seu navegador não suporta notificações.",
                              "error",
                            );
                            return;
                          }
                          Notification.requestPermission().then(
                            (permission) => {
                              if (permission === "granted") {
                                showStatus(
                                  "Notificações ativadas com sucesso!",
                                  "success",
                                );
                              } else {
                                showStatus(
                                  "Permissão para notificações foi negada.",
                                  "error",
                                );
                              }
                            },
                          );
                        }}
                        className="btn-modern w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <BellRing className="w-4 h-4" /> Configurar Notificações
                        no Dispositivo
                      </button>

                      <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                        <p>
                          <b>Nota:</b> Se você já negou a permissão
                          anteriormente, precisará clicar no ícone de "cadeado"
                          na barra de endereços do seu navegador para permitir
                          manualmente.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-amber-700 dark:text-amber-300 uppercase tracking-widest text-[10px]">
                      <ShieldCheck className="w-4 h-4" /> Termos de Uso (LGPD)
                    </h3>
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        A versão atual dos Termos de Uso é a <b>v{cloudSettings.termsVersion || 1}</b>. 
                        Ao atualizar a versão, todos os usuários da plataforma serão obrigados a ler e aceitar 
                        os novos termos antes de acessarem seus dados novamente, e enviarão uma notificação para todos.
                      </p>

                      <button
                        onClick={async () => {
                           if (confirm("Você tem certeza que deseja exigir o aceite dos novos termos? Isso bloqueará o acesso de alunos até que eles concordem.")) {
                              try {
                                 const newVersion = (cloudSettings.termsVersion || 1) + 1;
                                 await updateSettings({ termsVersion: newVersion });
                                 await logAdminAction("TERMS_UPDATED", `Atualizou os Termos de Uso (LGPD) para a versão v${newVersion}`);
                                 
                                 // Add global notification
                                 const newNotif = {
                                    id: "terms-update-" + Date.now(),
                                    title: "Atualização dos Termos de Uso (LGPD)",
                                    message: "Os Termos de Uso e Privacidade da plataforma foram atualizados. É necessário o aceite para continuar.",
                                    type: "alert",
                                    read: false,
                                    createdAt: new Date().toISOString()
                                 };
                                 const { addDoc, collection } = await import('firebase/firestore');
                                 await addDoc(collection(db, `artifacts/${appId}/public/data/notifications`), newNotif);
                                 
                                 showStatus(`Termos atualizados para versão ${newVersion} e notificados com sucesso!`, "success");
                              } catch(e) {
                                 console.error(e);
                                 showStatus("Erro ao atualizar os termos", "error");
                              }
                           }
                        }}
                        className="btn-modern w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" /> Notificar e Exigir Novo Aceite
                      </button>
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-emerald-700 dark:text-emerald-300 uppercase tracking-widest text-[10px]">
                      <FileText className="w-4 h-4" /> Certificados e Validação Externa
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Link de Validação FAJOPA Plus
                        </label>
                        <input
                          type="url"
                          value={certificateValidationUrl}
                          onChange={(e) => setCertificateValidationUrl(e.target.value)}
                          className="input-modern"
                          placeholder="https://plus.fajopa.org/validar"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Link direcionado aos alunos e público para validação de certificados legados.</p>
                      </div>

                      <div className="border-t border-emerald-200/60 dark:border-emerald-700/30 pt-4">
                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useGoogleScriptCertificate}
                            onChange={(e) => setUseGoogleScriptCertificate(e.target.checked)}
                            className="w-5 h-5 text-emerald-500"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Usar Google Apps Script</p>
                            <p className="text-[10px] sm:text-xs text-slate-500">Redirecionar emissor de certificados para script externo em vez do gerador nativo PDF.</p>
                          </div>
                        </label>

                        {useGoogleScriptCertificate && (
                          <div className="mt-3">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              URL do Google Script
                            </label>
                            <input
                              type="url"
                              value={googleScriptCertificateUrl}
                              onChange={(e) => setGoogleScriptCertificateUrl(e.target.value)}
                              className="input-modern"
                              placeholder="https://script.google.com/macros/..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "system" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-indigo-800 dark:text-indigo-300 uppercase tracking-widest text-[10px]">
                      <Settings className="w-4 h-4" /> Header & Atalhos Rápidos
                    </h3>
                    
                    <div className="space-y-6">
                      <div className="col-span-1 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={useWhatsappMural}
                            onChange={(e) => setUseWhatsappMural(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Usar Mural de Grupos do WhatsApp (Padrão)
                        </label>
                        <p className="text-[10px] text-slate-500 max-w-sm mt-1 mb-4">
                          Se ativado, a aba Mural mostrará uma lista de grupos do WhatsApp oficiais ao invés do feed interativo de posts.
                        </p>
                      </div>

                      <div className="col-span-1 space-y-4 border-t border-indigo-100 dark:border-indigo-500/20 pt-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={headerLogoEnabled}
                            onChange={(e) => setHeaderLogoEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Logo no Topo
                        </label>
                        {headerLogoEnabled && (
                          <div className="pl-6 space-y-3">
                            <div className="flex flex-col items-start gap-2">
                              {headerLogoUrl ? (
                                <div className="relative group">
                                  <img
                                    src={headerLogoUrl}
                                    alt="Header Logo"
                                    className="h-16 w-auto object-contain rounded bg-white p-2 border border-slate-200"
                                  />
                                  <button
                                    onClick={() => setHeaderLogoUrl(null)}
                                    className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (e) => setHeaderLogoUrl(e.target?.result as string);
                                        reader.readAsDataURL(file);
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="px-3 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 rounded text-xs font-bold transition-all hover:bg-indigo-200"
                                >
                                  Fazer Upload de Logo do Topo
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Link ao Clicar na Logo
                              </label>
                              <input
                                type="text"
                                value={headerLogoLink}
                                onChange={(e) => setHeaderLogoLink(e.target.value)}
                                className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                                placeholder="https://fajopa.org"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={liveBadgeEnabled}
                            onChange={(e) => setLiveBadgeEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Indicador "Ao Vivo" sobre a Logo
                        </label>
                        {liveBadgeEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Transmissão (YouTube)
                            </label>
                            <input
                              type="text"
                              value={liveBadgeUrl}
                              onChange={(e) => setLiveBadgeUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.youtube.com/@fajopademarilia/streams"
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialFacebookEnabled}
                            onChange={(e) => setSocialFacebookEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Ícone "Facebook" ao lado da Logo
                        </label>
                        {socialFacebookEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Facebook
                            </label>
                            <input
                              type="text"
                              value={socialFacebookUrl}
                              onChange={(e) => setSocialFacebookUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.facebook.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialInstagramEnabled}
                            onChange={(e) => setSocialInstagramEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Ícone "Instagram" ao lado da Logo
                        </label>
                        {socialInstagramEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Instagram
                            </label>
                            <input
                              type="text"
                              value={socialInstagramUrl}
                              onChange={(e) => setSocialInstagramUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.instagram.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialYoutubeEnabled}
                            onChange={(e) => setSocialYoutubeEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Ícone "YouTube" ao lado da Logo
                        </label>
                        {socialYoutubeEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do YouTube
                            </label>
                            <input
                              type="text"
                              value={socialYoutubeUrl}
                              onChange={(e) => setSocialYoutubeUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://www.youtube.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialWhatsappEnabled}
                            onChange={(e) => setSocialWhatsappEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Ícone "WhatsApp" ao lado da Logo
                        </label>
                        {socialWhatsappEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do WhatsApp
                            </label>
                            <input
                              type="text"
                              value={socialWhatsappUrl}
                              onChange={(e) => setSocialWhatsappUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://wa.me/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={socialEmailEnabled}
                            onChange={(e) => setSocialEmailEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Ícone "E-mail" ao lado da Logo
                        </label>
                        {socialEmailEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link (mailto) do E-mail
                            </label>
                            <input
                              type="text"
                              value={socialEmailUrl}
                              onChange={(e) => setSocialEmailUrl(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="mailto:..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={sophiaEnabled}
                            onChange={(e) => setSophiaEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Botão "Portal do Aluno"
                        </label>
                        {sophiaEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do Portal Sophia
                            </label>
                            <input
                              type="text"
                              value={sophiaLink}
                              onChange={(e) => setSophiaLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://portal.sophia.com.br/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={libraryEnabled}
                            onChange={(e) => setLibraryEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Botão "Biblioteca"
                        </label>
                        {libraryEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Biblioteca
                            </label>
                            <input
                              type="text"
                              value={libraryLink}
                              onChange={(e) => setLibraryLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://biblioteca.sophia.com.br/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={avaEnabled}
                            onChange={(e) => setAvaEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Botão "AVA (Ambiente Virtual)"
                        </label>
                        {avaEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link do AVA
                            </label>
                            <input
                              type="text"
                              value={avaLink}
                              onChange={(e) => setAvaLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://fajopa.net/ava/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={contemplacaoEnabled}
                            onChange={(e) => setContemplacaoEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Ativar Botão "Revista Contemplação"
                        </label>
                        {contemplacaoEnabled && (
                          <div className="pl-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Link da Revista Contemplação
                            </label>
                            <input
                              type="text"
                              value={contemplacaoLink}
                              onChange={(e) => setContemplacaoLink(e.target.value)}
                              className="input-modern w-full rounded-xl py-2 px-3 text-xs"
                              placeholder="https://revista.fajopa.com/..."
                            />
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={muralEnabled}
                            onChange={(e) => setMuralEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Exibir "Mural" no App
                        </label>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={eventsEnabled}
                            onChange={(e) => setEventsEnabled(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Exibir "Eventos" no App
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Aprovação e Moderação de Cadastros */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-2 text-emerald-800 dark:text-emerald-300 uppercase tracking-widest text-[10px]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Aprovação & Homologação de Cadastros
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-5">
                      Configure como novos cadastros de alunos, participantes e seminaristas são aprovados e ativados no sistema.
                    </p>

                    <div className="space-y-5">
                      {/* Global Auto Approve Switch */}
                      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between gap-4">
                        <div>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoApproveEnabled}
                              onChange={(e) => setAutoApproveEnabled(e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                            />
                            Aprovação Automática Geral (Todos os Novos Cadastros)
                          </label>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                            {autoApproveEnabled ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                ✓ Ativo: Qualquer pessoa que se cadastrar será aprovada e ativada imediatamente com status VÁLIDO.
                              </span>
                            ) : (
                              <span>
                                Desativado: Novos cadastros ficarão como <strong>Pendente</strong> para moderação e validação manual da secretaria.
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase shrink-0 border ${
                          autoApproveEnabled
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {autoApproveEnabled ? "Auto-Aprovação Ativa" : "Moderação Manual"}
                        </span>
                      </div>

                      {/* Whitelist / Pre-approved List */}
                      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                            Lista de Pré-Aprovados (Whitelist Automática)
                          </label>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                            {autoApproveWhitelistText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length} cadastrado(s)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Caso o nome, CPF, RA ou E-mail da pessoa esteja nesta lista, ela será <strong>aprovada automaticamente</strong> no momento do cadastro, mesmo com a aprovação geral desligada.
                        </p>
                        <textarea
                          value={autoApproveWhitelistText}
                          onChange={(e) => setAutoApproveWhitelistText(e.target.value)}
                          rows={5}
                          className="input-modern w-full rounded-xl p-3 text-xs font-mono resize-y"
                          placeholder={"Insira 1 por linha:\nJoão da Silva\n123.456.789-00\n2026.0015\naluno@fajopa.edu.br"}
                        />
                        <p className="text-[10px] text-slate-400 italic">
                          Dica: Digite nomes completos, números de CPF (com ou sem pontuação), RAs ou e-mails, um por linha ou separados por vírgula.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "mural" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  <WhatsappMuralView 
                    isAdmin={true} 
                    userRoles={[]} 
                    whatsappGroups={cloudSettings.whatsappGroups || []} 
                    whatsappCategories={cloudSettings.whatsappCategories || []}
                    customRoles={cloudSettings.customRoles || []}
                    updateSettings={updateSettings as any} 
                  />
                </div>
              )}

              {activeTab === "appointments" && (
                <div className="space-y-8 animate-in fade-in transition-all duration-300">
                  <div className="bg-sky-50/50 dark:bg-sky-900/10 p-5 rounded-2xl border border-sky-100 dark:border-sky-500/20">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-sky-800 dark:text-sky-300 uppercase tracking-widest text-[10px]">
                      <HeartHandshake className="w-4 h-4" /> Configurações de Seminário
                    </h3>
                    
                    <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-4 mb-6">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={appointmentsEnabled}
                          onChange={(e) => setAppointmentsEnabled(e.target.checked)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        Exibir "Seminário" no App
                      </label>
                      <div className="mt-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Link Externo para Agendamentos (WhatsApp/Google Agenda)</label>
                        <input
                          type="text"
                          value={appointmentsExternalLink}
                          onChange={e => setAppointmentsExternalLink(e.target.value)}
                          placeholder="Ex: https://chat.whatsapp.com/..."
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none font-bold text-slate-700 dark:text-slate-300 focus:border-sky-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Se preenchido, o sistema de agendamentos interno será desativado e este link será exibido.</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Profissionais de Seminário (Geral)</label>
                        <button onClick={addGlobalProfessional} className="text-[10px] bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 px-3 py-1.5 rounded-full font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors uppercase flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Adicionar Profissional
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {professionals.length === 0 ? (
                          <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Nenhum profissional configurado.</p>
                        ) : (
                          professionals.map(prof => (
                            <div key={prof.id} className="flex flex-col sm:flex-row gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                              <div className="flex-shrink-0 flex items-center justify-center">
                                {prof.photoUrl ? (
                                  <div className="relative">
                                    <img src={prof.photoUrl} alt="Foto" className="w-12 h-12 rounded-full border-2 border-slate-100 dark:border-slate-700 object-cover shadow-sm" />
                                    <button onClick={() => updateGlobalProfessional(prof.id, "photoUrl", null)} className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1 shadow-md">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition group-hover:border-sky-300">
                                    <Upload className="w-4 h-4 text-slate-400" />
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                      handleFileUpload(e, (val) => {
                                        updateGlobalProfessional(prof.id, "photoUrl", val);
                                      });
                                    }} />
                                  </label>
                                )}
                              </div>
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Nome Completo</label>
                                  <input type="text" placeholder="Ex: Pe. João Silva" value={prof.name} onChange={(e) => updateGlobalProfessional(prof.id, "name", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Cargo/Especialidade</label>
                                  <input type="text" placeholder="Ex: DIRETOR ESPIRITUAL" value={prof.role} onChange={(e) => updateGlobalProfessional(prof.id, "role", e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Tipo de Link</label>
                                  <select value={prof.appointmentType || "whatsapp"} onChange={(e) => updateGlobalProfessional(prof.id, "appointmentType", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none">
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="google_calendar">Google Agenda</option>
                                    <option value="other">Outro Link</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">Link de Agendamento</label>
                                  <input type="text" placeholder="Ex: https://..." value={prof.appointmentLink || ''} onChange={(e) => updateGlobalProfessional(prof.id, "appointmentLink", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 block mb-1">WhatsApp (Opcional - Exibido abaixo do botão)</label>
                                  <input type="text" placeholder="Ex: (00) 00000-0000" value={prof.whatsappNumber || ''} onChange={(e) => updateGlobalProfessional(prof.id, "whatsappNumber", e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                                </div>
                              </div>
                              <button onClick={() => removeGlobalProfessional(prof.id)} className="absolute top-2 right-2 sm:relative sm:top-0 sm:right-0 self-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Remover Profissional">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleSaveGeneral}
                  disabled={status?.type === "loading"}
                  className="btn-modern w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:active:scale-100 disabled:cursor-not-allowed"
                >
                  {status?.type === "loading" ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {status?.type === "loading" ? "Salvando..." : "Salvar Todas as Configurações"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
