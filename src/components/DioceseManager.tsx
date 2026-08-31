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
  Navigation,
  Sun,
  Moon
} from "lucide-react";
import { AVAILABLE_DIOCESES, Member } from "../types";
import { DIOCESES_DATA, getDioceseInfo, DioceseInfo, DioceseLink } from "../data/diocesesData";
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
  const [removeBgAuto, setRemoveBgAuto] = useState(true);
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

  // Handle Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const base64 = await resizeAndConvertToBase64(file, 400, {
        preserveAlpha: true,
        removeWhiteBg: removeBgAuto,
        mimeType: "image/png"
      });

      setForm(prev => ({
        ...prev,
        logoUrl: base64
      }));

      setStatus({ msg: "Logo processada com sucesso!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: "Erro ao processar imagem da logo.", type: "error" });
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
      const base64 = await resizeAndConvertToBase64(file, 450, {
        quality: 0.9,
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
      setStatus({ msg: "Erro ao processar foto.", type: "error" });
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
      const base64 = await resizeAndConvertToBase64(file, 400, {
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

      setStatus({ msg: "Brasão/Emblema episcopal processado com sucesso!", type: "success" });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: "Erro ao processar emblema episcopal.", type: "error" });
    } finally {
      setIsProcessingImage(false);
      if (bishopEmblemInputRef.current) bishopEmblemInputRef.current.value = "";
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
    const query = [
      form.curia.address,
      form.curia.neighborhood,
      form.curia.city,
      form.curia.state,
      form.curia.cep
    ].filter(Boolean).join(", ");

    const generated = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    setForm(prev => ({
      ...prev,
      curia: {
        ...prev.curia,
        mapsUrl: generated
      }
    }));
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
              className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                previewBgDark
                  ? "bg-slate-900 border-slate-700"
                  : "bg-slate-100 border-slate-300"
              }`}
            >
              {form.logoUrl ? (
                <div className="relative group p-4 flex flex-col items-center justify-center w-full h-full">
                  <img
                    src={form.logoUrl}
                    alt={`Logo ${form.name}`}
                    className="max-h-32 max-w-full object-contain filter drop-shadow-md transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
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
                <span>Remover fundo branco automaticamente (ideal p/ brasões digitalizados)</span>
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
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-amber-400/40 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                  {form.bishop.photoUrl ? (
                    <img
                      src={form.bishop.photoUrl}
                      alt={form.bishop.name}
                      className="w-full h-full object-cover"
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
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed flex items-center justify-center p-1.5 overflow-hidden shrink-0 transition-colors ${
                    previewBgDark ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-300"
                  }`}
                >
                  {form.bishop.emblemUrl ? (
                    <img
                      src={form.bishop.emblemUrl}
                      alt={`Brasão episcopal ${form.bishop.name}`}
                      className="w-full h-full object-contain filter drop-shadow-md"
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
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, address: e.target.value } }))}
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
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, neighborhood: e.target.value } }))}
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
                    onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, city: e.target.value } }))}
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
                    onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, state: e.target.value.toUpperCase() } }))}
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
                  onChange={(e) => setForm(prev => ({ ...prev, curia: { ...prev.curia, cep: e.target.value } }))}
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

          {/* REDES SOCIAIS OFICIAIS */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <Globe className="w-4 h-4 text-sky-500" />
              3. Redes Sociais & Portal
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
                4. Links & Canais do Linktree ({form.links.length})
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
