import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Landmark,
  Plus,
  Trash2,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Save,
  Check,
  Search,
  ExternalLink,
  Globe,
  Instagram,
  Youtube,
  Facebook,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Clock,
  Shield,
  Heart,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Edit2,
  X,
  AlertCircle,
  FileText,
  Calendar,
  Users,
  ShieldCheck,
  ArrowUpRight,
  Eye,
  EyeOff,
  Navigation,
  Sun,
  Moon,
  QrCode,
  Coins,
  Wallet,
  CreditCard,
  Sliders,
  ZoomIn,
  Maximize2
} from "lucide-react";
import { AVAILABLE_DIOCESES, Member } from "../types";
import { DIOCESES_DATA, getDioceseInfo, DioceseInfo, DioceseLink, DioceseVisibility, buildMapsUrl } from "../data/diocesesData";
import { useSettings } from "../context/SettingsContext";
import { resizeAndConvertToBase64 } from "../lib/imageUtils";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface DioceseManagerProps {
  initialDioceseKey?: string;
  onClose?: () => void;
}

const GRADIENT_PRESETS = [
  { id: "from-sky-700 via-sky-800 to-indigo-950", name: "Azul Celestial", color: "#0284c7" },
  { id: "from-indigo-700 via-indigo-800 to-slate-950", name: "Índigo Eclesial", color: "#4f46e5" },
  { id: "from-amber-700 via-amber-800 to-amber-950", name: "Dourado Franciscan", color: "#d97706" },
  { id: "from-emerald-700 via-emerald-800 to-teal-950", name: "Verde Esperança", color: "#059669" },
  { id: "from-rose-700 via-rose-800 to-red-950", name: "Rubro Pentecostal", color: "#e11d48" },
  { id: "from-purple-700 via-purple-800 to-indigo-950", name: "Púrpura Arquidiocesano", color: "#7e22ce" },
  { id: "from-teal-700 via-teal-800 to-cyan-950", name: "Teal Pastoral", color: "#0d9488" },
  { id: "from-blue-700 via-blue-800 to-indigo-950", name: "Mariano Azul", color: "#2563eb" },
  { id: "from-slate-800 via-slate-900 to-zinc-950", name: "Sóbrio Noturno", color: "#334155" },
];

export default function DioceseManager({ initialDioceseKey, onClose }: DioceseManagerProps) {
  const { settings, updateSettings } = useSettings();

  // Admin access validation
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("adminMasterLogged") === "true") {
      return true;
    }
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

  // Combine list of dioceses
  const allDioceseKeys = useMemo(() => {
    const list = Array.from(
      new Set([
        ...AVAILABLE_DIOCESES,
        ...(settings.customDioceses || []),
        ...Object.keys(settings.diocesesConfig || {})
      ])
    );
    return list;
  }, [settings.customDioceses, settings.diocesesConfig]);

  const [selectedKey, setSelectedKey] = useState<string>(() => {
    if (initialDioceseKey) return initialDioceseKey.toUpperCase().trim();
    return allDioceseKeys[0] || "MARÍLIA";
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "success" | "error" | "loading" } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDioceseName, setNewDioceseName] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [removeBgAuto, setRemoveBgAuto] = useState(false); // Preservar detalhes e transparência nativa de PNG
  const [previewBgDark, setPreviewBgDark] = useState(true);

  // Link Editor State
  const [editingLink, setEditingLink] = useState<DioceseLink | null>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Load current diocese draft info
  const [form, setForm] = useState<DioceseInfo>(() => {
    return getDioceseInfo(selectedKey, settings.diocesesConfig);
  });

  // When selection changes, reload form
  useEffect(() => {
    setForm(getDioceseInfo(selectedKey, settings.diocesesConfig));
    setEditingLink(null);
    setIsAddingLink(false);
  }, [selectedKey, settings.diocesesConfig]);

  const isCustomDiocese = !AVAILABLE_DIOCESES.includes(selectedKey);
  const hasCustomConfig = Boolean(
    settings.diocesesConfig && settings.diocesesConfig[selectedKey]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bishopPhotoInputRef = useRef<HTMLInputElement>(null);
  const bishopEmblemInputRef = useRef<HTMLInputElement>(null);
  const pixQrCodeInputRef = useRef<HTMLInputElement>(null);

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const base64 = await resizeAndConvertToBase64(file, 480, {
        preserveAlpha: true,
        removeWhiteBg: removeBgAuto,
        mimeType: "image/png"
      });

      setForm(prev => ({
        ...prev,
        logoUrl: base64
      }));

      setStatus({ msg: "Logo oficial processada com máxima fidelidade!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: err?.message || "Erro ao processar imagem da logo.", type: "error" });
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Bishop Photo Upload
  const handleBishopPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const base64 = await resizeAndConvertToBase64(file, 500, {
        quality: 0.85,
        mimeType: "image/jpeg"
      });

      setForm(prev => ({
        ...prev,
        bishop: {
          ...prev.bishop,
          photoUrl: base64
        }
      }));

      setStatus({ msg: "Foto episcopal em alta resolução carregada!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: err?.message || "Erro ao processar foto.", type: "error" });
    } finally {
      setIsProcessingImage(false);
      if (bishopPhotoInputRef.current) bishopPhotoInputRef.current.value = "";
    }
  };

  // Handle Bishop Emblem / Coat of Arms Upload
  const handleBishopEmblemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const base64 = await resizeAndConvertToBase64(file, 480, {
        preserveAlpha: true,
        removeWhiteBg: removeBgAuto,
        mimeType: "image/png"
      });

      setForm(prev => ({
        ...prev,
        bishop: {
          ...prev.bishop,
          emblemUrl: base64
        }
      }));

      setStatus({ msg: "Brasão/Emblema episcopal processado sem cortes de detalhes!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: err?.message || "Erro ao processar emblema episcopal.", type: "error" });
    } finally {
      setIsProcessingImage(false);
      if (bishopEmblemInputRef.current) bishopEmblemInputRef.current.value = "";
    }
  };

  // Handle PIX QR Code Upload
  const handlePixQrCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const base64 = await resizeAndConvertToBase64(file, 350, {
        quality: 0.88,
        mimeType: "image/jpeg"
      });

      setForm(prev => ({
        ...prev,
        pix: {
          ...(prev.pix || {
            key: "",
            keyType: "CNPJ",
            receiverName: "",
            bankName: "",
            city: "",
            description: ""
          }),
          qrCodeImageUrl: base64
        }
      }));

      setStatus({ msg: "Imagem do QR Code PIX anexada com sucesso!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: err?.message || "Erro ao processar imagem do QR Code.", type: "error" });
    } finally {
      setIsProcessingImage(false);
      if (pixQrCodeInputRef.current) pixQrCodeInputRef.current.value = "";
    }
  };

  // Save changes to settings
  const handleSave = async () => {
    try {
      setStatus({ msg: "Salvando configurações na nuvem...", type: "loading" });

      const updatedDiocesesConfig = {
        ...(settings.diocesesConfig || {}),
        [selectedKey]: {
          ...form,
          id: selectedKey
        }
      };

      let updatedCustomDioceses = settings.customDioceses || [];
      if (isCustomDiocese && !updatedCustomDioceses.includes(selectedKey)) {
        updatedCustomDioceses = [...updatedCustomDioceses, selectedKey];
      }

      await updateSettings({
        diocesesConfig: updatedDiocesesConfig,
        customDioceses: updatedCustomDioceses
      });

      setStatus({ msg: "Alterações da Diocese salvas com sucesso!", type: "success" });
      setTimeout(() => setStatus(null), 3500);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: "Erro ao salvar na nuvem: " + (err?.message || err), type: "error" });
    }
  };

  // Restore Default Config
  const handleRestoreDefault = async () => {
    if (!confirm(`Deseja restaurar as configurações originais da ${selectedKey}?`)) return;

    try {
      setStatus({ msg: "Restaurando padrão...", type: "loading" });

      const updatedDiocesesConfig = { ...(settings.diocesesConfig || {}) };
      delete updatedDiocesesConfig[selectedKey];

      await updateSettings({
        diocesesConfig: updatedDiocesesConfig
      });

      setForm(getDioceseInfo(selectedKey, updatedDiocesesConfig));
      setStatus({ msg: "Configurações restauradas para o padrão oficial!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: "Erro ao restaurar: " + (err?.message || err), type: "error" });
    }
  };

  // Delete Custom Diocese
  const handleDeleteCustomDiocese = async () => {
    if (!confirm(`Tem certeza que deseja excluir a Diocese "${selectedKey}" do sistema?`)) return;

    try {
      setStatus({ msg: "Excluindo diocese...", type: "loading" });

      const updatedDiocesesConfig = { ...(settings.diocesesConfig || {}) };
      delete updatedDiocesesConfig[selectedKey];

      const updatedCustomDioceses = (settings.customDioceses || []).filter(
        d => d.toUpperCase().trim() !== selectedKey
      );

      await updateSettings({
        diocesesConfig: updatedDiocesesConfig,
        customDioceses: updatedCustomDioceses
      });

      setSelectedKey("MARÍLIA");
      setStatus({ msg: "Diocese excluída com sucesso.", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: "Erro ao excluir diocese.", type: "error" });
    }
  };

  // Create New Diocese
  const handleCreateNewDiocese = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDioceseName.trim();
    if (!cleanName) return;

    const normalized = cleanName.toUpperCase();
    if (allDioceseKeys.includes(normalized)) {
      alert("Já existe uma Diocese cadastrada com este nome.");
      return;
    }

    const newInfo: DioceseInfo = {
      id: normalized,
      name: `Diocese de ${cleanName}`,
      shortName: cleanName,
      type: "Diocese",
      logoUrl: null,
      bishop: {
        name: "Bispo Diocesano",
        title: "Governo Pastoral",
        motto: "In Caritate et Veritate",
        photoUrl: null
      },
      patron: "Padroeiro(a) Diocesano",
      foundationYear: new Date().getFullYear().toString(),
      curia: {
        address: `Cúria Diocesana de ${cleanName}`,
        neighborhood: "Centro",
        city: cleanName,
        state: "SP",
        cep: "00000-000",
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=Curia+Diocesana+${encodeURIComponent(cleanName)}`,
        phone: "",
        phoneFormatted: "(00) 0000-0000",
        whatsapp: "",
        whatsappFormatted: "(00) 00000-0000",
        email: `curia@diocese${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "")}.org.br`,
        officeHours: "Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
      },
      social: {
        website: "",
        instagram: "",
        youtube: "",
        facebook: ""
      },
      links: [
        {
          id: `${normalized.toLowerCase()}-oficial`,
          title: `Portal Oficial da Diocese de ${cleanName}`,
          subtitle: "Notícias, clero e comunicados oficiais",
          url: "https://",
          category: "oficial",
          iconName: "globe",
          highlight: true
        }
      ],
      coverGradient: "from-sky-700 via-sky-800 to-indigo-950",
      themeColor: "#0284c7"
    };

    const updatedCustomDioceses = [...(settings.customDioceses || []), normalized];
    const updatedDiocesesConfig = {
      ...(settings.diocesesConfig || {}),
      [normalized]: newInfo
    };

    await updateSettings({
      customDioceses: updatedCustomDioceses,
      diocesesConfig: updatedDiocesesConfig
    });

    setSelectedKey(normalized);
    setShowAddModal(false);
    setNewDioceseName("");
    setStatus({ msg: `Diocese "${cleanName}" adicionada com sucesso!`, type: "success" });
    setTimeout(() => setStatus(null), 3000);
  };

  // Generate Google Maps URL automatically
  const handleAutoGenerateMaps = () => {
    const generated = buildMapsUrl(
      form.curia.address,
      form.curia.neighborhood,
      form.curia.city,
      form.curia.state,
      form.curia.cep,
      form.name
    );
    setForm(prev => ({
      ...prev,
      curia: {
        ...prev.curia,
        mapsUrl: generated || prev.curia.mapsUrl
      }
    }));
  };

  // Automatically update address field and synchronize Maps "Como Chegar" URL in real-time
  const updateCuriaAddress = (field: keyof DioceseInfo["curia"], value: string) => {
    setForm(prev => {
      const updatedCuria = { ...prev.curia, [field]: value };
      const autoMapsUrl = buildMapsUrl(
        field === "address" ? value : updatedCuria.address,
        field === "neighborhood" ? value : updatedCuria.neighborhood,
        field === "city" ? value : updatedCuria.city,
        field === "state" ? value : updatedCuria.state,
        field === "cep" ? value : updatedCuria.cep,
        prev.name
      );
      return {
        ...prev,
        curia: {
          ...updatedCuria,
          mapsUrl: autoMapsUrl || updatedCuria.mapsUrl
        }
      };
    });
  };

  // Link Management
  const handleSaveLink = (linkData: DioceseLink) => {
    let updatedLinks = [...form.links];
    if (editingLink) {
      updatedLinks = updatedLinks.map(l => l.id === linkData.id ? linkData : l);
    } else {
      updatedLinks.push(linkData);
    }

    setForm(prev => ({ ...prev, links: updatedLinks }));
    setEditingLink(null);
    setIsAddingLink(false);
  };

  const handleDeleteLink = (linkId: string) => {
    setForm(prev => ({
      ...prev,
      links: prev.links.filter(l => l.id !== linkId)
    }));
  };

  const handleMoveLink = (index: number, direction: "up" | "down") => {
    const newLinks = [...form.links];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLinks.length) return;

    const temp = newLinks[index];
    newLinks[index] = newLinks[targetIndex];
    newLinks[targetIndex] = temp;

    setForm(prev => ({ ...prev, links: newLinks }));
  };

  const filteredDioceseKeys = useMemo(() => {
    if (!searchTerm.trim()) return allDioceseKeys;
    const term = searchTerm.toLowerCase();
    return allDioceseKeys.filter(k => k.toLowerCase().includes(term));
  }, [allDioceseKeys, searchTerm]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Acesso Restrito a Administradores
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Apenas administradores, membros da diretoria ou equipe de comunicação do DAVVERO têm permissão para editar os dados, logos oficiais e brasões das Dioceses.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            Fechar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              <span>Painel & Configurações de Dioceses</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/20 uppercase tracking-widest">
                Linktree Eclesial
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Personalize logos oficiais, dados da Cúria, redes sociais, brasões e links de todas as dioceses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Nova Diocese</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {status && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all ${
            status.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : status.type === "loading"
              ? "bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{status.msg}</span>
        </div>
      )}

      {/* DIOCESE SELECTION TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-sky-500" />
              Diocese em Edição:
            </span>

            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 cursor-pointer shadow-sm"
            >
              {allDioceseKeys.map(k => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasCustomConfig && (
              <button
                type="button"
                onClick={handleRestoreDefault}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all border border-amber-500/20 cursor-pointer"
                title="Restaurar valores de fábrica desta diocese"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrão</span>
              </button>
            )}

            {isCustomDiocese && (
              <button
                type="button"
                onClick={handleDeleteCustomDiocese}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all border border-rose-500/20 cursor-pointer"
                title="Excluir esta diocese customizada"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Diocese</span>
              </button>
            )}

            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer ml-auto sm:ml-0"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Diocese</span>
            </button>
          </div>
        </div>

        {/* Diocese Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {allDioceseKeys.map(k => {
            const isSelected = selectedKey === k;
            const isCustom = !AVAILABLE_DIOCESES.includes(k);
            const isConfigured = Boolean(settings.diocesesConfig?.[k]);

            return (
              <button
                key={k}
                onClick={() => setSelectedKey(k)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                  isSelected
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm scale-105"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400"
                }`}
              >
                <span>{k}</span>
                {isConfigured && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-sky-500"}`} />
                )}
                {isCustom && (
                  <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-500 font-black">
                    Nova
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TWO COLUMNS FORM LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LOGOS & VISUAL ASSETS (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* LOGO OFICIAL CARD */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-500" />
                Logo Oficial / Brasão Diocesano
              </h3>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewBgDark(false)}
                  className={`p-1 rounded text-xs ${!previewBgDark ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"}`}
                  title="Fundo Claro"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBgDark(true)}
                  className={`p-1 rounded text-xs ${previewBgDark ? "bg-slate-900 text-white shadow-xs" : "text-slate-400"}`}
                  title="Fundo Escuro"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Logo Preview Container */}
            <div
              className={`w-full min-h-[12rem] py-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                previewBgDark
                  ? "bg-slate-900 border-slate-700"
                  : "bg-slate-100 border-slate-300"
              }`}
            >
              {form.logoUrl ? (
                <div className="relative group p-3 flex flex-col items-center justify-center">
                  <div
                    style={{
                      width: `${form.logoSize || 112}px`,
                      height: `${form.logoSize || 112}px`
                    }}
                    className={`rounded-2xl p-2 flex items-center justify-center transition-all ${
                      form.logoBg === "transparent"
                        ? "bg-transparent border border-white/20"
                        : form.logoBg === "glass"
                        ? "bg-white/20 backdrop-blur-md border border-white/30"
                        : "bg-white border-2 border-slate-200 shadow-md"
                    }`}
                  >
                    <img
                      src={form.logoUrl}
                      alt={`Logo ${form.name}`}
                      className="w-full h-full object-contain filter drop-shadow-sm transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-sky-500 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" /> Trocar
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, logoUrl: null }))}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-rose-500 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 mx-auto flex items-center justify-center">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Nenhuma logo personalizada enviada
                  </p>
                  <p className="text-[10px] text-slate-400">
                    (O sistema usará o ícone heráldico padrão)
                  </p>
                </div>
              )}
            </div>

            {/* Logo Resizing Slider & Background Controls */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-500" /> Redimensionar Brasão/Logo da Diocese:
                  </span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                    {form.logoSize || 112}px
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="260"
                  step="2"
                  value={form.logoSize || 112}
                  onChange={(e) => setForm(prev => ({ ...prev, logoSize: Number(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                  <span className="text-slate-400">Atalhos:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "80px", val: 80 },
                      { label: "100px", val: 100 },
                      { label: "112px (Padrão)", val: 112 },
                      { label: "140px", val: 140 },
                      { label: "180px", val: 180 },
                      { label: "220px", val: 220 }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, logoSize: preset.val }))}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                          (form.logoSize || 112) === preset.val
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                  Fundo do Emblema no Banner:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoBg: "white" }))}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                      (!form.logoBg || form.logoBg === "white")
                        ? "bg-white text-slate-900 border-sky-500 shadow-xs ring-1 ring-sky-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Branco Sólido (Protege PNG)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoBg: "glass" }))}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.logoBg === "glass"
                        ? "bg-white text-slate-900 border-sky-500 shadow-xs ring-1 ring-sky-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Vidro Fosco
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoBg: "transparent" }))}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                      form.logoBg === "transparent"
                        ? "bg-white text-slate-900 border-sky-500 shadow-xs ring-1 ring-sky-500"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Transparente
                  </button>
                </div>
              </div>
            </div>

            {/* Upload Buttons & Options */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="space-y-2.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{form.logoUrl ? "Enviar Nova Logo Oficial" : "Fazer Upload da Logo"}</span>
                </button>

                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoUrl: null }))}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-900/40 dark:text-slate-300 dark:hover:text-rose-300 transition-colors"
                    title="Remover Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Auto White Background Removal Checkbox */}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={removeBgAuto}
                  onChange={(e) => setRemoveBgAuto(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span>Remover borda branca externa automaticamente (ideal p/ brasões digitalizados)</span>
              </label>

              {/* Direct URL input fallback */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Ou insira o link direto da imagem (URL):
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.org.br/brasao.png"
                  value={form.logoUrl || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, logoUrl: e.target.value.trim() || null }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* FOTO E BRASÃO DO BISPO / EPISCOPAL */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <Shield className="w-4 h-4 text-amber-500" />
              Identidade Episcopal (Foto & Brasão do Bispo)
            </h3>

            {/* 1. FOTO DO BISPO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span>Foto Oficial do Bispo / Arcebispo</span>
                </label>
                {form.bishop.photoUrl && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                    Foto Ativa
                  </span>
                )}
              </div>

              <input
                type="file"
                ref={bishopPhotoInputRef}
                onChange={handleBishopPhotoUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: `${form.bishop.photoSize || 108}px`,
                    height: `${form.bishop.photoSize || 108}px`
                  }}
                  className="rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-amber-400/40 shadow-sm overflow-hidden flex items-center justify-center shrink-0 transition-all"
                >
                  {form.bishop.photoUrl ? (
                    <img
                      src={form.bishop.photoUrl}
                      alt={form.bishop.name}
                      style={{
                        transform: `scale(${(form.bishop.photoZoom || 100) / 100})`
                      }}
                      className="w-full h-full object-cover transition-transform"
                    />
                  ) : (
                    <Shield className="w-10 h-10 text-amber-500 opacity-60" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => bishopPhotoInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{form.bishop.photoUrl ? "Trocar Foto" : "Enviar Foto Oficial"}</span>
                    </button>
                    {form.bishop.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoUrl: null } }))}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 transition-colors"
                        title="Remover Foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="URL da foto (ex: https://.../bispo.jpg)"
                    value={form.bishop.photoUrl || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoUrl: e.target.value.trim() || null } }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Photo Resizing and Zoom Sliders */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-sky-500" /> Tamanho da Foto do Bispo:
                      </span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                        {form.bishop.photoSize || 108}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="260"
                      step="2"
                      value={form.bishop.photoSize || 108}
                      onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoSize: Number(e.target.value) } }))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                    />
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {[
                        { label: "80px", val: 80 },
                        { label: "108px (Padrão)", val: 108 },
                        { label: "140px", val: 140 },
                        { label: "180px", val: 180 },
                        { label: "220px", val: 220 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoSize: preset.val } }))}
                          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                            (form.bishop.photoSize || 108) === preset.val
                              ? "bg-sky-600 text-white"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <ZoomIn className="w-3 h-3 text-amber-500" /> Zoom/Enquadramento:
                      </span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        {form.bishop.photoZoom || 100}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="200"
                      step="2"
                      value={form.bishop.photoZoom || 100}
                      onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoZoom: Number(e.target.value) } }))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {[
                        { label: "100% (Normal)", val: 100 },
                        { label: "115%", val: 115 },
                        { label: "130%", val: 130 },
                        { label: "150%", val: 150 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, photoZoom: preset.val } }))}
                          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                            (form.bishop.photoZoom || 100) === preset.val
                              ? "bg-amber-600 text-white"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. BRASÃO / EMBLEMA EPISCOPAL DO BISPO */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Brasão / Emblema Episcopal do Bispo</span>
                </label>
                {form.bishop.emblemUrl && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                    Brasão Ativo
                  </span>
                )}
              </div>

              <input
                type="file"
                ref={bishopEmblemInputRef}
                onChange={handleBishopEmblemUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: `${form.bishop.emblemSize || 92}px`,
                    height: `${form.bishop.emblemSize || 92}px`
                  }}
                  className={`rounded-2xl border-2 p-2 flex flex-col items-center justify-center overflow-hidden shrink-0 transition-all ${
                    form.bishop.emblemBg === "transparent"
                      ? "bg-transparent border-dashed border-amber-300 dark:border-amber-600/60"
                      : form.bishop.emblemBg === "dark"
                      ? "bg-slate-900 border-slate-700"
                      : "bg-white border-amber-300 dark:border-amber-400 shadow-xs"
                  }`}
                >
                  {form.bishop.emblemUrl ? (
                    <img
                      src={form.bishop.emblemUrl}
                      alt={`Brasão episcopal ${form.bishop.name}`}
                      className="w-full h-full object-contain filter drop-shadow-xs"
                    />
                  ) : (
                    <div className="text-center">
                      <Shield className="w-8 h-8 text-amber-500/50 mx-auto" />
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Sem Brasão</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => bishopEmblemInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{form.bishop.emblemUrl ? "Trocar Brasão" : "Enviar Brasão Episcopal"}</span>
                    </button>
                    {form.bishop.emblemUrl && (
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemUrl: null } }))}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 transition-colors"
                        title="Remover Brasão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="URL do brasão (ex: https://.../brasao-dom.png)"
                    value={form.bishop.emblemUrl || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemUrl: e.target.value.trim() || null } }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Bishop Emblem Resizing Slider & Background Controls */}
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-amber-500" /> Redimensionar Brasão Episcopal:
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      {form.bishop.emblemSize || 92}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="260"
                    step="2"
                    value={form.bishop.emblemSize || 92}
                    onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemSize: Number(e.target.value) } }))}
                    className="w-full h-2 bg-amber-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <span className="text-slate-400">Atalhos:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "70px", val: 70 },
                        { label: "92px (Padrão)", val: 92 },
                        { label: "120px", val: 120 },
                        { label: "160px", val: 160 },
                        { label: "200px", val: 200 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemSize: preset.val } }))}
                          className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                            (form.bishop.emblemSize || 92) === preset.val
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/30">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-1.5">
                    Fundo do Brasão Episcopal:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemBg: "white" } }))}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                        (!form.bishop.emblemBg || form.bishop.emblemBg === "white")
                          ? "bg-white text-amber-900 border-amber-500 shadow-xs ring-1 ring-amber-500"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      Branco (Recomendado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemBg: "dark" } }))}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                        form.bishop.emblemBg === "dark"
                          ? "bg-slate-900 text-white border-amber-500 shadow-xs ring-1 ring-amber-500"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      Fundo Escuro
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, emblemBg: "transparent" } }))}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                        form.bishop.emblemBg === "transparent"
                          ? "bg-white text-slate-900 border-amber-500 shadow-xs ring-1 ring-amber-500"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      Transparente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CAPA & CORES VISUAIS */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Identidade Visual & Capa
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Gradiente do Banner Superior:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected = form.coverGradient === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, coverGradient: preset.id, themeColor: preset.color }))}
                        className={`h-10 rounded-xl bg-gradient-to-r ${preset.id} relative border-2 transition-all cursor-pointer ${
                          isSelected ? "border-white ring-2 ring-sky-500 scale-105" : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        title={preset.name}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Cor de Destaque Primária (Hex):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.themeColor || "#0284c7"}
                    onChange={(e) => setForm(prev => ({ ...prev, themeColor: e.target.value }))}
                    className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.themeColor || "#0284c7"}
                    onChange={(e) => setForm(prev => ({ ...prev, themeColor: e.target.value }))}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INSTITUTIONAL, CURIA & LINKTREE (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* DADOS INSTITUCIONAIS */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <Landmark className="w-4 h-4 text-sky-500" />
              1. Informações Institucionais & Bispo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Nome Completo da Diocese:
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Diocese de Marília"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Nome Curto / Cidade Sede:
                </label>
                <input
                  type="text"
                  value={form.shortName}
                  onChange={(e) => setForm(prev => ({ ...prev, shortName: e.target.value }))}
                  placeholder="ex: Marília"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Tipo Canônico:
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="Diocese">Diocese</option>
                  <option value="Arquidiocese">Arquidiocese</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Nome do Bispo / Arcebispo:
                </label>
                <input
                  type="text"
                  value={form.bishop.name}
                  onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, name: e.target.value } }))}
                  placeholder="ex: Dom Luiz Antonio Cipolini"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Título Episcopal:
                </label>
                <input
                  type="text"
                  value={form.bishop.title}
                  onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, title: e.target.value } }))}
                  placeholder="ex: Bispo Diocesano / Arcebispo Metropolitano"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Lema Episcopal:
                </label>
                <input
                  type="text"
                  value={form.bishop.motto || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, bishop: { ...prev.bishop, motto: e.target.value } }))}
                  placeholder="ex: In humilitate cordis"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Padroeiro(a) Diocesano:
                </label>
                <input
                  type="text"
                  value={form.patron}
                  onChange={(e) => setForm(prev => ({ ...prev, patron: e.target.value }))}
                  placeholder="ex: São Pedro Apóstolo"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Ano de Criação / Fundação:
                </label>
                <input
                  type="text"
                  value={form.foundationYear || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, foundationYear: e.target.value }))}
                  placeholder="ex: 1952"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* DADOS DA CÚRIA & CONTATOS */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                2. Cúria Diocesana & Expediente
              </h3>

              <button
                type="button"
                onClick={handleAutoGenerateMaps}
                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                title="Gera o link de navegação do Google Maps com base no endereço"
              >
                <Navigation className="w-3 h-3" />
                <span>Gerar Link Maps</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Endereço da Cúria (Logradouro e Número):
                </label>
                <input
                  type="text"
                  value={form.curia.address}
                  onChange={(e) => updateCuriaAddress("address", e.target.value)}
                  placeholder="ex: Av. Nelson Spielmann, 521"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Bairro:
                </label>
                <input
                  type="text"
                  value={form.curia.neighborhood || ""}
                  onChange={(e) => updateCuriaAddress("neighborhood", e.target.value)}
                  placeholder="ex: Centro"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Cidade:
                  </label>
                  <input
                    type="text"
                    value={form.curia.city}
                    onChange={(e) => updateCuriaAddress("city", e.target.value)}
                    placeholder="Marília"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    UF:
                  </label>
                  <input
                    type="text"
                    value={form.curia.state}
                    onChange={(e) => updateCuriaAddress("state", e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 uppercase text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  CEP:
                </label>
                <input
                  type="text"
                  value={form.curia.cep}
                  onChange={(e) => updateCuriaAddress("cep", e.target.value)}
                  placeholder="ex: 17509-001"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  E-mail Oficial / Chancelaria:
                </label>
                <input
                  type="email"
                  value={form.curia.email}
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, email: e.target.value } }))}
                  placeholder="ex: curia@diocesedemarilia.org.br"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Telefone da Cúria:
                </label>
                <input
                  type="text"
                  value={form.curia.phoneFormatted}
                  onChange={(e) => {
                    const formatted = e.target.value;
                    const raw = formatted.replace(/\D/g, "");
                    setForm(prev => ({
                      ...prev,
                      curia: {
                        ...prev.curia,
                        phoneFormatted: formatted,
                        phone: raw ? `+55${raw}` : ""
                      }
                    }));
                  }}
                  placeholder="ex: (14) 3401-2360"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  WhatsApp Oficial da Cúria:
                </label>
                <input
                  type="text"
                  value={form.curia.whatsappFormatted || ""}
                  onChange={(e) => {
                    const formatted = e.target.value;
                    const raw = formatted.replace(/\D/g, "");
                    setForm(prev => ({
                      ...prev,
                      curia: {
                        ...prev.curia,
                        whatsappFormatted: formatted,
                        whatsapp: raw ? `55${raw}` : ""
                      }
                    }));
                  }}
                  placeholder="ex: (14) 99793-1811"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Horário de Atendimento da Cúria:
                </label>
                <input
                  type="text"
                  value={form.curia.officeHours}
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, officeHours: e.target.value } }))}
                  placeholder="ex: Segunda a Sexta, das 08h às 11h30 e das 13h às 17h"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Link Google Maps (Como Chegar):
                </label>
                <input
                  type="url"
                  value={form.curia.mapsUrl}
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, mapsUrl: e.target.value } }))}
                  placeholder="https://maps.google.com/..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* DADOS PIX & DÍZIMO / DOAÇÕES */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                3. Chave PIX Oficial & Dízimo Diocesano
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Doações & Cúria
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Chave PIX da Diocese:
                </label>
                <input
                  type="text"
                  value={form.pix?.key || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        key: e.target.value
                      }
                    }))
                  }
                  placeholder="ex: 44.444.444/0001-44 ou curia@diocese.org.br"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Tipo da Chave:
                </label>
                <select
                  value={form.pix?.keyType || "CNPJ"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        keyType: e.target.value as any
                      }
                    }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="CNPJ">CNPJ (Mitra Diocesana)</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Telefone">Telefone / Celular</option>
                  <option value="Chave Aleatória">Chave Aleatória (EVP)</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Titular / Razão Social (Favorecido):
                </label>
                <input
                  type="text"
                  value={form.pix?.receiverName || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        receiverName: e.target.value
                      }
                    }))
                  }
                  placeholder="ex: Mitra Diocesana de Assis"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Instituição Financeira / Banco:
                </label>
                <input
                  type="text"
                  value={form.pix?.bankName || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        bankName: e.target.value
                      }
                    }))
                  }
                  placeholder="ex: Banco do Brasil / Sicoob"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Cidade do Titular / Conta:
                </label>
                <input
                  type="text"
                  value={form.pix?.city || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        city: e.target.value
                      }
                    }))
                  }
                  placeholder="ex: Assis - SP"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Finalidade / Mensagem Pastoral:
                </label>
                <input
                  type="text"
                  value={form.pix?.description || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pix: {
                        ...(prev.pix || {
                          key: "",
                          keyType: "CNPJ",
                          receiverName: "",
                          bankName: "",
                          city: "",
                          description: ""
                        }),
                        description: e.target.value
                      }
                    }))
                  }
                  placeholder="ex: Dízimo Diocesano, Manutenção da Cúria e Apoio às Vocações Sacerdotais"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* UPLOAD DA IMAGEM DO QR CODE PIX */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Imagem Personalizada do QR Code PIX (Opcional)
                  </span>
                </div>
                {form.pix?.qrCodeImageUrl && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    QR Code Anexado
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Você pode fazer o upload da imagem do QR Code exportada do aplicativo do banco da Diocese ou do banner de arrecadação.
              </p>

              <input
                type="file"
                ref={pixQrCodeInputRef}
                onChange={handlePixQrCodeUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                {form.pix?.qrCodeImageUrl ? (
                  <div className="w-24 h-24 rounded-xl bg-white p-1.5 border-2 border-emerald-500 shadow-md flex items-center justify-center shrink-0">
                    <img
                      src={form.pix.qrCodeImageUrl}
                      alt="QR Code PIX Diocese"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-slate-200 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <QrCode className="w-8 h-8 opacity-40 mb-1" />
                    <span className="text-[9px] font-bold">Sem imagem</span>
                  </div>
                )}

                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pixQrCodeInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{form.pix?.qrCodeImageUrl ? "Trocar Imagem QR Code" : "Fazer Upload do QR Code"}</span>
                    </button>

                    {form.pix?.qrCodeImageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            pix: {
                              ...(prev.pix || { key: "" }),
                              qrCodeImageUrl: null
                            }
                          }))
                        }
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover Imagem</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="url"
                    placeholder="Ou insira a URL direta da imagem do QR Code..."
                    value={form.pix?.qrCodeImageUrl || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        pix: {
                          ...(prev.pix || { key: "" }),
                          qrCodeImageUrl: e.target.value.trim() || null
                        }
                      }))
                    }
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Preview Box for PIX */}
            {form.pix?.key && (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {form.pix.receiverName || "Chave PIX Diocesana"}
                    </p>
                    <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                      {form.pix.keyType}: {form.pix.key}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                  Configurado
                </span>
              </div>
            )}
          </div>

          {/* VISIBILIDADE & OCULTAÇÃO DE INFORMAÇÕES NO PAINEL DA DIOCESE */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                4. Visibilidade & Ocultação de Seções no Painel
              </h3>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    visibility: {
                      hideBishop: false,
                      hideCuria: false,
                      hideContacts: false,
                      hidePix: false,
                      hideSocial: false,
                      hideLinks: false,
                      hidePatron: false,
                      hideFoundationYear: false
                    }
                  }))
                }
                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Exibir Todas
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecione quais informações ou blocos você deseja exibir ou ocultar na visualização pública do painel desta diocese:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Ocultar Perfil Episcopal */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideBishop
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideBishop ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Perfil Episcopal & Bispo</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Foto, Lema, Título e Brasão</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideBishop || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideBishop: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Contatos Rápidos */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideContacts
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideContacts ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Barra de Contatos Rápidos</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">WhatsApp, Fone, E-mail, Mapa</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideContacts || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideContacts: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Cúria e Horários */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideCuria
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideCuria ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Cúria & Horários</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Endereço, CEP e Atendimento</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideCuria || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideCuria: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar PIX & Dízimo */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hidePix
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-teal-50/60 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hidePix ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Chave PIX & Dízimo</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Card de doação e QR Code</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hidePix || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hidePix: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Redes Sociais */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideSocial
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideSocial ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Redes Sociais Oficiais</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Instagram, YouTube, Facebook, Site</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideSocial || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideSocial: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Links Linktree */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideLinks
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideLinks ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Lista de Links (Linktree)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Canais, links e botões adicionais</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideLinks || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideLinks: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Padroeiro */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hidePatron
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hidePatron ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Padroeiro(a)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Nome do Padroeiro na Capa</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hidePatron || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hidePatron: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>

              {/* Ocultar Fundação */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  form.visibility?.hideFoundationYear
                    ? "bg-slate-100/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-400"
                    : "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {form.visibility?.hideFoundationYear ? (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block leading-tight">Ano de Fundação</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Selo "Desde XXXX"</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.visibility?.hideFoundationYear || false}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...(prev.visibility || {}),
                        hideFoundationYear: e.target.checked
                      }
                    }))
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 shrink-0 ml-2"
                />
              </label>
            </div>
          </div>

          {/* REDES SOCIAIS OFICIAIS */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <Globe className="w-4 h-4 text-sky-500" />
              4. Redes Sociais & Portal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Website / Portal Oficial:
                </label>
                <input
                  type="url"
                  value={form.social.website || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, social: { ...prev.social, website: e.target.value } }))}
                  placeholder="https://diocesedemarilia.org.br"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Instagram Oficial:
                </label>
                <input
                  type="text"
                  value={form.social.instagram || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, social: { ...prev.social, instagram: e.target.value } }))}
                  placeholder="https://instagram.com/dioceses..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Canal no YouTube:
                </label>
                <input
                  type="text"
                  value={form.social.youtube || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, social: { ...prev.social, youtube: e.target.value } }))}
                  placeholder="https://youtube.com/@dioceses..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Página no Facebook:
                </label>
                <input
                  type="text"
                  value={form.social.facebook || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, social: { ...prev.social, facebook: e.target.value } }))}
                  placeholder="https://facebook.com/dioceses..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* GERENCIADOR DE LINKS LINKTREE */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                5. Links & Canais do Linktree ({form.links.length})
              </h3>

              <button
                type="button"
                onClick={() => {
                  setEditingLink({
                    id: `link-${Date.now()}`,
                    title: "",
                    subtitle: "",
                    url: "https://",
                    category: "oficial",
                    iconName: "globe",
                    highlight: false
                  });
                  setIsAddingLink(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-bold transition-all border border-sky-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Link</span>
              </button>
            </div>

            {/* List of Links */}
            <div className="space-y-2">
              {form.links.map((link, idx) => (
                <div
                  key={link.id || idx}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    link.highlight
                      ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800"
                      : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveLink(idx, "up")}
                        className="text-slate-400 hover:text-sky-500 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.links.length - 1}
                        onClick={() => handleMoveLink(idx, "down")}
                        className="text-slate-400 hover:text-sky-500 disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sky-500 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {link.title || "Sem título"}
                        </span>
                        {link.highlight && (
                          <span className="px-1 rounded text-[8px] font-black uppercase bg-sky-500 text-white shrink-0">
                            Destaque
                          </span>
                        )}
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase shrink-0">
                          {link.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                        {link.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLink(link);
                        setIsAddingLink(false);
                      }}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-sky-50 text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-700"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 dark:border-slate-700"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {form.links.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  Nenhum link cadastrado nesta diocese.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADICIONAR NOVA DIOCESE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-500" />
                Cadastrar Nova Diocese
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digite o nome da nova Diocese para adicioná-la ao ecossistema do DAVVERO e personalizar seus dados.
            </p>

            <form onSubmit={handleCreateNewDiocese} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Nome da Cidade / Sede da Diocese:
                </label>
                <input
                  type="text"
                  value={newDioceseName}
                  onChange={(e) => setNewDioceseName(e.target.value)}
                  placeholder="ex: PRESIDENTE EPITÁCIO, SANTOS, CAMPINAS..."
                  required
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Criar Diocese
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR / ADICIONAR LINK */}
      {editingLink && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-500" />
                {isAddingLink ? "Adicionar Link" : "Editar Link"}
              </h3>
              <button
                onClick={() => setEditingLink(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Título do Link:
                </label>
                <input
                  type="text"
                  value={editingLink.title}
                  onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                  placeholder="ex: Portal Oficial da Diocese"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Subtítulo / Descrição Curta:
                </label>
                <input
                  type="text"
                  value={editingLink.subtitle || ""}
                  onChange={(e) => setEditingLink({ ...editingLink, subtitle: e.target.value })}
                  placeholder="ex: Notícias, decretos e comunicados da Cúria"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  URL / Endereço Web:
                </label>
                <input
                  type="url"
                  value={editingLink.url}
                  onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Categoria:
                  </label>
                  <select
                    value={editingLink.category}
                    onChange={(e) => setEditingLink({ ...editingLink, category: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="oficial">Oficial</option>
                    <option value="social">Rede Social</option>
                    <option value="pastoral">Pastoral</option>
                    <option value="servico">Serviço / Chancelaria</option>
                    <option value="contato">Contato</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Ícone:
                  </label>
                  <select
                    value={editingLink.iconName || "globe"}
                    onChange={(e) => setEditingLink({ ...editingLink, iconName: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="globe">🌐 Globo / Site</option>
                    <option value="instagram">📸 Instagram</option>
                    <option value="youtube">▶️ YouTube</option>
                    <option value="facebook">👥 Facebook</option>
                    <option value="phone">📞 Telefone</option>
                    <option value="message">💬 WhatsApp</option>
                    <option value="mail">✉️ E-mail</option>
                    <option value="map">📍 Mapa / Paróquias</option>
                    <option value="file-text">📄 Documento / Chancelaria</option>
                    <option value="shield">🛡️ Tribunal / Brasão</option>
                    <option value="heart">❤️ Vocações / Pastoral</option>
                    <option value="calendar">📅 Calendário / Eventos</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingLink.highlight || false}
                    onChange={(e) => setEditingLink({ ...editingLink, highlight: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Destacar este link no topo do Linktree com moldura especial
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditingLink(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveLink(editingLink)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Salvar Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
