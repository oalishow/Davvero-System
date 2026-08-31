import React, { useState, useEffect, useMemo } from "react";
import {
  Landmark,
  Globe,
  Instagram,
  Youtube,
  Facebook,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles,
  Search,
  FileText,
  Heart,
  Users,
  Building2,
  Navigation,
  Cross,
  BookOpen,
  ArrowUpRight,
  Shield,
  Settings as SettingsIcon,
  Image as ImageIcon,
  Crown,
  Coins,
  QrCode,
  Wallet
} from "lucide-react";
import { AVAILABLE_DIOCESES, Member } from "../types";
import { DIOCESES_DATA, getDioceseInfo, DioceseInfo, DioceseLink } from "../data/diocesesData";
import { useSettings } from "../context/SettingsContext";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Modal from "./Modal";
import DioceseManager from "./DioceseManager";
import { QRCodeCanvas } from "qrcode.react";

interface DioceseHubProps {
  member?: Member | null;
  onNavigateToEvents?: (dioceseFilter?: string) => void;
}

export default function DioceseHub({ member, onNavigateToEvents }: DioceseHubProps) {
  const { settings } = useSettings();

  // Admin access control state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // 1. Session admin master flag
    if (typeof window !== "undefined" && sessionStorage.getItem("adminMasterLogged") === "true") {
      return true;
    }
    // 2. Member roles check
    if (member?.roles && member.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
      return true;
    }
    // 3. LocalStorage cached member check
    if (typeof window !== "undefined") {
      const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
      if (cachedMemberStr) {
        try {
          const m = JSON.parse(cachedMemberStr) as Member;
          if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
            return true;
          }
        } catch(e) {}
      }
    }
    return false;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAdmin(true);
      }
    });
    return () => unsub();
  }, []);

  // Combine default dioceses with any custom dioceses in settings
  const allDioceses = useMemo(() => {
    const list = Array.from(
      new Set([
        ...AVAILABLE_DIOCESES,
        ...(settings.customDioceses || []),
        ...Object.keys(settings.diocesesConfig || {})
      ])
    );
    return list;
  }, [settings.customDioceses, settings.diocesesConfig]);

  // Initial diocese from member, url parameter, or localStorage, fallback to MARÍLIA
  const [selectedDioceseKey, setSelectedDioceseKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlDiocese = params.get("diocese");
      if (urlDiocese) {
        return urlDiocese.toUpperCase().trim();
      }
      const saved = localStorage.getItem("davvero_selected_diocese");
      if (saved) return saved;
    }
    if (member?.diocese) {
      return member.diocese.toUpperCase().trim();
    }
    return "MARÍLIA";
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Sync with user's selection and save preference
  const handleSelectDiocese = (key: string) => {
    setSelectedDioceseKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("davvero_selected_diocese", key);
    }
  };

  const dioceseInfo: DioceseInfo = useMemo(() => {
    return getDioceseInfo(selectedDioceseKey, settings.diocesesConfig);
  }, [selectedDioceseKey, settings.diocesesConfig]);

  // Filter links based on search
  const filteredLinks = useMemo(() => {
    if (!searchTerm.trim()) return dioceseInfo.links;
    const term = searchTerm.toLowerCase();
    return dioceseInfo.links.filter(
      (link) =>
        link.title.toLowerCase().includes(term) ||
        (link.subtitle && link.subtitle.toLowerCase().includes(term)) ||
        link.category.toLowerCase().includes(term)
    );
  }, [dioceseInfo, searchTerm]);

  const copyToClipboard = async (text: string, type: "email" | "link" | "pix") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2500);
      } else if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else if (type === "pix") {
        setCopiedPix(true);
        setTimeout(() => setCopiedPix(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  // Public Share URL using davvero.netlify.app
  const PUBLIC_SHARE_BASE = "https://davvero.netlify.app";
  const shareDioceseUrl = `${PUBLIC_SHARE_BASE}/?tab=diocese&diocese=${encodeURIComponent(selectedDioceseKey)}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${dioceseInfo.name} • Hub & Links Oficiais`,
          text: `Acesse contatos, Cúria, redes sociais e serviços da ${dioceseInfo.name} no DAVVERO System.`,
          url: shareDioceseUrl,
        });
      } catch {
        setShowShareModal(true);
      }
    } else {
      setShowShareModal(true);
    }
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case "globe":
        return <Globe className="w-5 h-5 text-sky-500" />;
      case "instagram":
        return <Instagram className="w-5 h-5 text-pink-500" />;
      case "youtube":
        return <Youtube className="w-5 h-5 text-red-500" />;
      case "facebook":
        return <Facebook className="w-5 h-5 text-blue-600" />;
      case "phone":
        return <Phone className="w-5 h-5 text-emerald-500" />;
      case "message":
        return <MessageCircle className="w-5 h-5 text-emerald-500" />;
      case "mail":
        return <Mail className="w-5 h-5 text-indigo-500" />;
      case "map":
        return <MapPin className="w-5 h-5 text-rose-500" />;
      case "file-text":
        return <FileText className="w-5 h-5 text-amber-500" />;
      case "calendar":
        return <Calendar className="w-5 h-5 text-purple-500" />;
      case "heart":
        return <Heart className="w-5 h-5 text-rose-500" />;
      case "users":
        return <Users className="w-5 h-5 text-blue-500" />;
      case "shield":
        return <ShieldCheck className="w-5 h-5 text-teal-500" />;
      default:
        return <ArrowUpRight className="w-5 h-5 text-sky-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* HEADER HERO CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-indigo-900/40">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none mix-blend-overlay">
          <Landmark className="w-48 h-48" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black uppercase tracking-wider text-sky-300">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Linktree Eclesial • Província & Dioceses</span>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/80 hover:bg-sky-600 text-white text-xs font-bold transition-all active:scale-95 border border-sky-400/30 cursor-pointer shadow-sm"
                  title="Configurar dados, logos oficiais e links das Dioceses"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span>Configurar Diocese</span>
                </button>
              )}

              <button
                onClick={handleNativeShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all active:scale-95 border border-white/15 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-300" />
                <span>Compartilhar</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2">
                Minha Diocese
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-xl font-medium leading-relaxed">
                Central de contatos da Cúria, redes sociais oficiais, WhatsApp,
                expediente, chancelaria e serviços da sua Igreja diocesana.
              </p>
            </div>

            {/* Diocese quick switcher for larger screens */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shrink-0 max-w-xs w-full">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-300 mb-1.5 flex items-center gap-1">
                <Landmark className="w-3 h-3" /> Selecionar Diocese
              </p>
              <select
                value={selectedDioceseKey}
                onChange={(e) => handleSelectDiocese(e.target.value)}
                className="w-full bg-slate-900/90 text-white border border-white/20 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none cursor-pointer focus:border-sky-400"
              >
                {allDioceses.map((d) => (
                  <option key={d} value={d} className="bg-slate-900 text-white font-medium">
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* DIOCESE PILLS SELECTOR BAR */}
      <div className="bg-white dark:bg-slate-800/80 backdrop-blur-sm p-2 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-0.5 px-1">
          {allDioceses.map((diocese) => {
            const isSelected = selectedDioceseKey === diocese;
            const isMemberDiocese =
              member?.diocese && member.diocese.toUpperCase().trim() === diocese.toUpperCase().trim();
            const hasCustom = Boolean(settings.diocesesConfig?.[diocese]);

            return (
              <button
                key={diocese}
                onClick={() => handleSelectDiocese(diocese)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-sky-600 text-white shadow-md scale-105"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Landmark className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-sky-500"}`} />
                <span>{diocese}</span>
                {hasCustom && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-sky-500"}`} />
                )}
                {isMemberDiocese && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
                      isSelected ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
                    }`}
                  >
                    Minha
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CURRENT DIOCESE PROFILE CARD (LINKTREE TOP HERO) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden">
        {/* Diocese Cover Banner */}
        <div className={`bg-gradient-to-r ${dioceseInfo.coverGradient} p-6 sm:p-8 text-white relative`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
            {/* Emblem / Official Logo / Heraldic Shield */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/15 backdrop-blur-md border-2 border-white/30 p-2 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
              {dioceseInfo.logoUrl ? (
                <img
                  src={dioceseInfo.logoUrl}
                  alt={`Logo oficial ${dioceseInfo.name}`}
                  className="w-full h-full object-contain filter drop-shadow-md"
                />
              ) : (
                <Landmark className="w-12 h-12 sm:w-14 sm:h-14 text-white" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/25">
                  {dioceseInfo.type}
                </span>
                {dioceseInfo.foundationYear && (
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white/90">
                    Desde {dioceseInfo.foundationYear}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
                {dioceseInfo.name}
              </h2>
              <p className="text-xs sm:text-sm text-white/90 font-medium">
                Padroeiro(a): <strong className="text-white font-bold">{dioceseInfo.patron}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* EPISCOPAL IDENTITY & BISHOP PROFILE CARD */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-50/70 via-slate-50 to-amber-50/30 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* ENLARGED BISHOP PHOTO & EMBLEM ROW */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Bishop Photo */}
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-slate-700 border-2 border-amber-400 shadow-md overflow-hidden flex items-center justify-center">
                  {dioceseInfo.bishop.photoUrl ? (
                    <img
                      src={dioceseInfo.bishop.photoUrl}
                      alt={dioceseInfo.bishop.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                    />
                  ) : (
                    <Shield className="w-12 h-12 text-amber-500 opacity-60" />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-1 bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs border border-white">
                  Episcopal
                </div>
              </div>

              {/* Bishop's Heraldic Shield / Emblem (if available) */}
              {dioceseInfo.bishop.emblemUrl && (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-amber-300 dark:border-amber-600/60 p-1.5 flex flex-col items-center justify-center shadow-sm shrink-0">
                  <img
                    src={dioceseInfo.bishop.emblemUrl}
                    alt={`Brasão episcopal ${dioceseInfo.bishop.name}`}
                    className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                  />
                  <span className="text-[8px] font-black uppercase tracking-tighter text-amber-700 dark:text-amber-400 mt-0.5">
                    Brasão
                  </span>
                </div>
              )}
            </div>

            {/* Bishop Details */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Crown className="w-3.5 h-3.5" />
                <span>{dioceseInfo.bishop.title}</span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                {dioceseInfo.bishop.name}
              </h3>

              {dioceseInfo.bishop.motto && (
                <div className="pt-0.5">
                  <p className="italic text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-serif bg-amber-500/10 dark:bg-amber-500/15 px-3 py-1.5 rounded-xl inline-block border border-amber-400/20">
                    Lema: <strong className="font-semibold text-slate-800 dark:text-slate-100">« {dioceseInfo.bishop.motto} »</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QUICK DIRECT CONTACTS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
          {/* WhatsApp Direct */}
          {dioceseInfo.curia.whatsapp ? (
            <a
              href={`https://wa.me/${dioceseInfo.curia.whatsapp}?text=${encodeURIComponent(
                `Olá, Cúria da ${dioceseInfo.name}! Gostaria de informações.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all hover:scale-[1.02] shadow-sm text-center group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 mb-1 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">WhatsApp</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-full">
                {dioceseInfo.curia.whatsappFormatted || "Conversar"}
              </span>
            </a>
          ) : null}

          {/* Telefone Cúria */}
          {dioceseInfo.curia.phone ? (
            <a
              href={`tel:${dioceseInfo.curia.phone}`}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-900/50 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-all hover:scale-[1.02] shadow-sm text-center group"
            >
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 mb-1 group-hover:scale-110 transition-transform">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">Ligar p/ Cúria</span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold truncate max-w-full">
                {dioceseInfo.curia.phoneFormatted}
              </span>
            </a>
          ) : null}

          {/* Copiar E-mail */}
          {dioceseInfo.curia.email ? (
            <button
              onClick={() => copyToClipboard(dioceseInfo.curia.email, "email")}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all hover:scale-[1.02] shadow-sm text-center group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 mb-1 group-hover:scale-110 transition-transform">
                {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Mail className="w-4 h-4" />}
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                {copiedEmail ? "E-mail Copiado!" : "Copiar E-mail"}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-full">
                {dioceseInfo.curia.email}
              </span>
            </button>
          ) : null}

          {/* Como Chegar (Google Maps) */}
          {dioceseInfo.curia.mapsUrl ? (
            <a
              href={dioceseInfo.curia.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all hover:scale-[1.02] shadow-sm text-center group"
            >
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 mb-1 group-hover:scale-110 transition-transform">
                <Navigation className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">Como Chegar</span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold truncate max-w-full">
                {dioceseInfo.curia.city} - {dioceseInfo.curia.state}
              </span>
            </a>
          ) : null}
        </div>

        {/* CURIA ADDRESS & OFFICE HOURS DETAILS */}
        <div className="p-4 sm:p-5 text-xs text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {dioceseInfo.curia.address}
                {dioceseInfo.curia.neighborhood && ` - ${dioceseInfo.curia.neighborhood}`}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {dioceseInfo.curia.city}/{dioceseInfo.curia.state} • CEP {dioceseInfo.curia.cep}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-100 dark:bg-slate-700/50 p-2.5 rounded-xl">
            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Atendimento da Cúria
              </p>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {dioceseInfo.curia.officeHours}
              </p>
            </div>
          </div>
        </div>

        {/* DIOCESE PIX & DÍZIMO DIOCESANO BLOCK */}
        {dioceseInfo.pix?.key ? (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50/30 dark:from-emerald-950/30 dark:via-slate-800 dark:to-emerald-950/20 border-t border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Coins className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300">
                    PIX Oficial da Diocese
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {dioceseInfo.pix.keyType}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight truncate mt-0.5">
                  {dioceseInfo.pix.key}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {dioceseInfo.pix.receiverName || `Mitra Diocesana de ${dioceseInfo.shortName}`}
                  {dioceseInfo.pix.bankName && ` • ${dioceseInfo.pix.bankName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(dioceseInfo.pix!.key, "pix")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                title="Copiar Chave PIX"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? "PIX Copiado!" : "Copiar Chave"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPixModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/80 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Ver QR Code PIX para pagamento"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>
            </div>
          </div>
        ) : isAdmin ? (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>Chave PIX da Diocese ainda não cadastrada.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <SettingsIcon className="w-3 h-3" />
              <span>Configurar PIX</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar links, redes ou serviços da diocese..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-sky-500 transition-all text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Quick link to diocesan events in DAVVERO */}
        {onNavigateToEvents && (
          <button
            onClick={() => onNavigateToEvents(selectedDioceseKey)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Ver Eventos da {selectedDioceseKey}</span>
          </button>
        )}
      </div>

      {/* LINKTREE STYLE CARDS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            Links Oficiais & Canais ({filteredLinks.length})
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">Toque para abrir</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target={link.isExternal !== false ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className={`group flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                link.highlight
                  ? "bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:from-slate-800 dark:to-slate-800/90 border-sky-300 dark:border-sky-700/80 ring-1 ring-sky-400/20"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                    link.highlight
                      ? "bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400"
                      : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {renderIcon(link.iconName)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                      {link.title}
                    </h4>
                    {link.highlight && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-sky-500 text-white shrink-0">
                        Destaque
                      </span>
                    )}
                  </div>
                  {link.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {link.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 transition-all shrink-0 ml-2">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </a>
          ))}
        </div>

        {filteredLinks.length === 0 && (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <Search className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Nenhum link encontrado para "{searchTerm}"
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>

      {/* MODAL: CONFIGURAÇÃO / EDIÇÃO DE DIOCESES (ADMIN ONLY) */}
      {isAdmin && showConfigModal && (
        <Modal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title="Configuração & Gerenciamento de Dioceses"
          maxWidth="max-w-5xl"
        >
          <DioceseManager
            initialDioceseKey={selectedDioceseKey}
            onClose={() => setShowConfigModal(false)}
          />
        </Modal>
      )}

      {/* SHARE MODAL */}
      {showShareModal && (
        <Modal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={`Compartilhar ${dioceseInfo.name}`}
        >
          <div className="space-y-4 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Aponte a câmera para abrir o Linktree oficial da <strong>{dioceseInfo.name}</strong> ou copie o link direto.
            </p>

            <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block mx-auto">
              <QRCodeCanvas value={shareDioceseUrl} size={180} />
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <input
                type="text"
                readOnly
                value={shareDioceseUrl}
                className="bg-transparent flex-1 outline-none font-mono text-[11px] text-slate-700 dark:text-slate-300"
              />
              <button
                onClick={() => copyToClipboard(shareDioceseUrl, "link")}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* PIX MODAL */}
      {showPixModal && dioceseInfo.pix?.key && (
        <Modal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          title={`PIX Oficial • ${dioceseInfo.name}`}
        >
          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-block">
                {dioceseInfo.pix.keyType} Oficial
              </span>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                {dioceseInfo.pix.receiverName || dioceseInfo.name}
              </h4>
              {dioceseInfo.pix.bankName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {dioceseInfo.pix.bankName} {dioceseInfo.pix.city && `• ${dioceseInfo.pix.city}`}
                </p>
              )}
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-emerald-600 shadow-md inline-block mx-auto">
              <QRCodeCanvas value={dioceseInfo.pix.key} size={200} />
            </div>

            {dioceseInfo.pix.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-emerald-50 dark:bg-slate-800 p-2.5 rounded-xl border border-emerald-200 dark:border-slate-700">
                « {dioceseInfo.pix.description} »
              </p>
            )}

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <input
                type="text"
                readOnly
                value={dioceseInfo.pix.key}
                className="bg-transparent flex-1 outline-none font-mono text-xs font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(dioceseInfo.pix!.key, "pix")}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? "Copiado!" : "Copiar Chave"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

