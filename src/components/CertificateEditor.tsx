import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Wand2,
  Sparkles,
  CheckCircle,
  Save,
  Upload,
  Trash2,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Type,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  AlignRight,
  MoveVertical,
  Sliders,
  AlertTriangle,
  FileBadge,
  Layers,
  Palette,
  PenTool,
  Maximize2,
} from "lucide-react";
import type { Event, CertificateTemplate } from "../types";
import { updateEvent, db, appId } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { CertificateRenderer } from "./CertificateRenderer";
import { resizeAndConvertToBase64 } from "../lib/imageUtils";
import { useSettings } from "../context/SettingsContext";
import { useDialog } from "../context/DialogContext";

interface CertificateEditorProps {
  event: Event;
  onClose: () => void;
  onSaved: (updatedEvent: Event) => void;
  type?: "participant" | "organizer";
}

const TEMPLATE_STYLES = [
  { name: "Clássico Imperial", bg: "theme-classic", font: "serif", desc: "Dourado e marfim nobre" },
  { name: "Moderno Platina", bg: "theme-modern", font: "sans", desc: "Linhas geométricas em azul royal" },
  { name: "Teológico Solene", bg: "theme-theology", font: "serif", desc: "Bordô cerimonial e filigrana" },
  { name: "Noite Dourada", bg: "theme-solemn", font: "serif", desc: "Azul profundo e ouro metálico" },
  { name: "Institucional FAJOPA", bg: "theme-fajopa", font: "serif", desc: "Azul acadêmico oficial" },
  { name: "Diplomático Real", bg: "theme-diplomatic", font: "serif", desc: "Verde esmeralda e dourado" },
  { name: "Minimalista Clean", bg: "theme-minimal", font: "sans", desc: "Linhas puras de alto contraste" },
  { name: "Pergaminho Vintage", bg: "theme-parchment", font: "serif", desc: "Sépia aquecido clássico" },
  { name: "Honra ao Mérito", bg: "theme-laurel", font: "cinzel", desc: "Moldura laureada dourada" },
  { name: "Esmeralda & Ouro Nobre", bg: "theme-emerald-gold", font: "serif", desc: "Verde floresta nobre com ornatos dourados" },
  { name: "Excelência Navy", bg: "theme-academic-navy", font: "sans", desc: "Azul marinho com linhas guilloché celestes" },
  { name: "Renascença Clássica", bg: "theme-renaissance", font: "serif", desc: "Pergaminho nobre com cantoneiras barrocas" },
  { name: "Rubi Contemporâneo", bg: "theme-contemporary-ruby", font: "sans", desc: "Vermelho cardeal sóbrio e moderno" },
];

const FONT_FAMILIES = [
  { id: "serif", name: "Serif Clássico (Playfair/Times)" },
  { id: "sans", name: "Sans Moderno (Inter/Arial)" },
  { id: "cinzel", name: "Nobre Monumental (Cinzel)" },
  { id: "script", name: "Manuscrita Elegante (Script)" },
  { id: "merriweather", name: "Editorial Nobre (Merriweather)" },
  { id: "montserrat", name: "Contemporâneo (Montserrat)" },
  { id: "mono", name: "Oficial Datilografado (Mono)" },
];

export default function CertificateEditor({
  event,
  onClose,
  onSaved,
  type = "participant",
}: CertificateEditorProps) {
  const { settings } = useSettings();
  const { showAlert, showConfirm } = useDialog();

  const [activeTab, setActiveTab] = useState<"text" | "design" | "logo" | "signatures">("text");

  const [template, setTemplate] = useState<CertificateTemplate>(
    (type === "organizer" ? event.organizationCertificateTemplate : event.certificateTemplate) || {
      bodyText: "",
      fontFamily: "serif",
      bgStyle: "theme-classic",
      signatureName: "",
      signatureRole: "",
      signature2Name: "",
      signature2Role: "",
      isApproved: false,
      showFajopaDirectorSignature: true,
      fajopaDirectorName: "",
      showSeminarRectorSignature: true,
      seminarRectorName: "",
      fontSize: 26,
      isBold: false,
      textAlign: "justify",
      textBoxWidth: "normal",
      titleText: "CERTIFICADO",
      subtitleText: type === "organizer" ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO",
      showLogo: true,
      logoSize: 70,
      logoPosition: "top-center",
      signatureSize: 65,
      signaturePosition: "space-around",
      signatureOffsetY: 0,
    }
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const rendererRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(0.75);

  // Check if hours are missing
  const certHours = type === "organizer" && event.organizationHours ? event.organizationHours : event.hours;
  const hasHours =
    certHours &&
    String(certHours).trim() !== "" &&
    String(certHours).toLowerCase() !== "null" &&
    String(certHours).toLowerCase() !== "undefined" &&
    Number(certHours) !== 0;

  // Load custom assets if exists
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const assetDocId = type === "organizer" ? `cert_assets_org_${event.id}` : `cert_assets_${event.id}`;
        const assetsSnap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, assetDocId)));
        if (assetsSnap.exists() && assetsSnap.data().data) {
          const assetsData = assetsSnap.data().data;
          setTemplate((prev) => ({
            ...prev,
            ...(assetsData.backgroundImageUrl && { backgroundImageUrl: assetsData.backgroundImageUrl }),
            ...(assetsData.logoUrl && { logoUrl: assetsData.logoUrl }),
            ...(assetsData.fajopaDirectorSignatureUrl && {
              fajopaDirectorSignatureUrl: assetsData.fajopaDirectorSignatureUrl,
            }),
            ...(assetsData.seminarRectorSignatureUrl && {
              seminarRectorSignatureUrl: assetsData.seminarRectorSignatureUrl,
            }),
          }));
          return;
        }
      } catch (err) {
        console.error("Failed to load cert assets", err);
      }

      // Fallback for old custom bg format
      if ((event.certificateTemplate as any)?.hasCustomBg) {
        try {
          const bgSnap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, `cert_bg_${event.id}`)));
          if (bgSnap.exists() && bgSnap.data().data) {
            setTemplate((prev) => ({ ...prev, backgroundImageUrl: bgSnap.data().data }));
          }
        } catch (err) {
          console.error("Failed to load old cert bg", err);
        }
      }
    };

    fetchAssets();
  }, [event.id, event.certificateTemplate, type]);

  const handleGenerateText = async () => {
    setIsGenerating(true);
    try {
      const themeLabel = TEMPLATE_STYLES.find((t) => t.bg === template.bgStyle)?.name || "Clássico Imperial";
      const certRole = type === "organizer" ? "Membro da Equipe de Organização" : "Participação";
      const hoursDesc = hasHours ? `Carga horária: ${certHours} horas.` : "Carga horária: Não especificada (NÃO inclua a palavra 'null').";

      const prompt = `Você é um redator acadêmico e institucional sênior.
Escreva O CORPO do texto de um Certificado de ${certRole} para o evento "${event.title}".
Descrição do evento: "${event.description || 'Atividade acadêmica institucional'}".
${hoursDesc}
Data de Início: ${new Date(event.startDate).toLocaleDateString("pt-BR")}
Data de Término: ${new Date(event.endDate || event.startDate).toLocaleDateString("pt-BR")}

Estilo do tema: ${themeLabel}.

Instruções RIGOROSAS:
1. Inicie diretamente com o texto do certificado (ex: "Certificamos que [NOME DO ALUNO]..."). Sem saudações ou títulos.
2. Use a variável "[NOME DO ALUNO]" no lugar do nome do participante.
3. Se desejar citar registro acadêmico, use "[RA DO ALUNO]".
4. Se a carga horária foi informada (${hasHours ? certHours : 'não informada'}), cite ${hasHours ? `a carga horária de ${certHours} horas` : 'a participação com êxito sem citar horas'}. NUNCA escreva 'null' ou 'undefined'.
5. Não inclua assinaturas ou cabeçalhos. Apenas o parágrafo formal central.`;

      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3-flash-preview",
          contents: prompt,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const response = await res.json();
      const text = response.text || "";
      setTemplate({ ...template, bodyText: text.trim().replace(/^"|"$/g, "") });
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao gerar texto: " + e.message, { type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyNanoBanana = () => {
    const randomStyle = TEMPLATE_STYLES[Math.floor(Math.random() * TEMPLATE_STYLES.length)];
    const fontOptions = ["serif", "sans", "cinzel", "script", "merriweather", "montserrat"];
    const randomFont = fontOptions[Math.floor(Math.random() * fontOptions.length)];
    const randomAlignments: ("justify" | "center" | "left")[] = ["justify", "center"];
    const randomAlign = randomAlignments[Math.floor(Math.random() * randomAlignments.length)];

    setTemplate({
      ...template,
      bgStyle: randomStyle.bg,
      fontFamily: randomFont,
      textAlign: randomAlign,
      fontSize: 26,
      textBoxWidth: "normal",
      signaturePosition: "space-around",
    });
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof CertificateTemplate
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isBg = fieldName === "backgroundImageUrl";
      const maxSize = isBg ? 2000 : 800;
      const isLogoOrSignature = fieldName === "logoUrl" || fieldName.includes("Signature") || fieldName.includes("signature");
      
      const base64 = await resizeAndConvertToBase64(file, maxSize, {
        preserveAlpha: true,
        removeWhiteBg: isLogoOrSignature,
        mimeType: isBg ? "image/jpeg" : "image/png",
      });
      setTemplate({ ...template, [fieldName]: base64 });
    } catch (err) {
      console.error(err);
      showAlert("Erro ao carregar imagem.", { type: "error" });
    }
  };

  const handleSave = async (shouldApprove: boolean = false) => {
    if (
      shouldApprove &&
      !(await showConfirm(
        "Ao conferir e liberar, os alunos poderão visualizar e baixar o certificado oficial. Deseja continuar?",
        { type: "warning" }
      ))
    )
      return;

    setIsSaving(true);
    try {
      const finalTemplate: any = { ...template, isApproved: shouldApprove || template.isApproved };
      const assetsData: any = {};
      let hasAnyAssets = false;

      // 1. Background
      if (template.backgroundImageUrl) {
        assetsData.backgroundImageUrl = template.backgroundImageUrl;
        hasAnyAssets = true;
        finalTemplate.hasCustomBg = true;
      } else {
        finalTemplate.hasCustomBg = false;
      }
      delete finalTemplate.backgroundImageUrl;

      // 2. Logo
      if (template.logoUrl) {
        assetsData.logoUrl = template.logoUrl;
        hasAnyAssets = true;
        finalTemplate.hasCustomLogo = true;
      } else {
        finalTemplate.hasCustomLogo = false;
      }
      delete finalTemplate.logoUrl;

      // 3. FAJOPA Signature
      if (template.fajopaDirectorSignatureUrl) {
        assetsData.fajopaDirectorSignatureUrl = template.fajopaDirectorSignatureUrl;
        hasAnyAssets = true;
        finalTemplate.hasFajopaSignature = true;
      } else {
        finalTemplate.hasFajopaSignature = false;
      }
      delete finalTemplate.fajopaDirectorSignatureUrl;

      // 4. Seminar Signature
      if (template.seminarRectorSignatureUrl) {
        assetsData.seminarRectorSignatureUrl = template.seminarRectorSignatureUrl;
        hasAnyAssets = true;
        finalTemplate.hasRectorSignature = true;
      } else {
        finalTemplate.hasRectorSignature = false;
      }
      delete finalTemplate.seminarRectorSignatureUrl;

      // Update assets document
      const assetDocId = type === "organizer" ? `cert_assets_org_${event.id}` : `cert_assets_${event.id}`;
      await setDoc(doc(db, ASSETS_DOC_PATH(appId, assetDocId)), {
        data: hasAnyAssets ? assetsData : null,
        updatedAt: new Date().toISOString(),
      });

      // Update main event document
      if (type === "organizer") {
        await updateEvent(event.id, { organizationCertificateTemplate: finalTemplate });
        onSaved({ ...event, organizationCertificateTemplate: finalTemplate });
      } else {
        await updateEvent(event.id, { certificateTemplate: finalTemplate });
        onSaved({ ...event, certificateTemplate: finalTemplate });
      }

      showAlert(
        shouldApprove
          ? "Certificado conferido e liberado com sucesso para os participantes!"
          : "Configurações do certificado salvas com sucesso!",
        { type: "success" }
      );
    } catch (e: any) {
      console.error("Error saving certificate:", e);
      showAlert("Erro ao salvar certificado: " + (e.message || "Tente novamente."), { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[96vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto border border-slate-200 dark:border-slate-800">
        
        {/* CABEÇALHO DO EDITOR */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-between items-center shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <FileBadge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
                Editor de Certificado {type === "organizer" ? "de Organização" : "de Participação"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[280px] sm:max-w-md truncate">
                  {event.title}
                </span>
                {template.isApproved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                    <CheckCircle className="w-3 h-3" />
                    Liberado
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* ALERTA DE CARGA HORÁRIA SE NÃO INFORMADA */}
        {!hasHours && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Aviso de Carga Horária:</strong> Este evento não possui carga horária registrada. O certificado será emitido sem o campo de horas (sem exibir &quot;null&quot;). Lembre-se que a definição de horas é fundamental para a validação acadêmica e aproveitamento de créditos pelos alunos.
              </span>
            </div>
          </div>
        )}

        {/* CORPO PRINCIPAL COM LAYOUT SPLIT (CONTROLES E PREVIEW) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row">
          
          {/* PAINEL DE CONTROLES (Esquerda ou Topo) */}
          <div className="w-full lg:w-[460px] xl:w-[500px] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col shrink-0">
            
            {/* ABAS DE FERRAMENTAS */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 gap-1 shrink-0 overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setActiveTab("text")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "text"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Texto & Tipografia
              </button>

              <button
                onClick={() => setActiveTab("logo")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "logo"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Logo do Evento
              </button>

              <button
                onClick={() => setActiveTab("design")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "design"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Design & Estilos
              </button>

              <button
                onClick={() => setActiveTab("signatures")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === "signatures"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                Assinaturas
              </button>
            </div>

            {/* CONTEÚDO DA ABA ATIVA */}
            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1 max-h-[520px] lg:max-h-none">
              
              {/* ABA 1: TEXTO & TIPOGRAFIA */}
              {activeTab === "text" && (
                <div className="space-y-4">
                  {/* Título & Subtítulo */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 block">
                        Título Principal
                      </label>
                      <input
                        type="text"
                        value={template.titleText || "CERTIFICADO"}
                        onChange={(e) => setTemplate({ ...template, titleText: e.target.value })}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                        placeholder="CERTIFICADO"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1 block">
                        Subtítulo
                      </label>
                      <input
                        type="text"
                        value={template.subtitleText || (type === "organizer" ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO")}
                        onChange={(e) => setTemplate({ ...template, subtitleText: e.target.value })}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                        placeholder="DE PARTICIPAÇÃO"
                      />
                    </div>
                  </div>

                  {/* Fonte */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5 block">
                      Família Tipográfica
                    </label>
                    <select
                      value={template.fontFamily || "serif"}
                      onChange={(e) => setTemplate({ ...template, fontFamily: e.target.value })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      {FONT_FAMILIES.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Formatação: Tamanho, Negrito, Alinhamento, Largura da Caixa */}
                  <div className="bg-white dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                      Ajustes do Texto Central
                    </span>

                    {/* Tamanho da Fonte (Aumentar / Diminuir) */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Tamanho da Fonte:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplate((t) => ({ ...t, fontSize: Math.max((t.fontSize || 26) - 2, 18) }))}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                          title="Diminuir Fonte"
                        >
                          A-
                        </button>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-10 text-center">
                          {template.fontSize || 26}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setTemplate((t) => ({ ...t, fontSize: Math.min((t.fontSize || 26) + 2, 40) }))}
                          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                          title="Aumentar Fonte"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    {/* Botões de Formatação: Negrito & Alinhamento */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, isBold: !template.isBold })}
                        className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors ${
                          template.isBold
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                        title="Colocar em Negrito"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        Negrito
                      </button>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, textAlign: "justify" })}
                          className={`p-1.5 rounded-lg ${
                            template.textAlign === "justify" || !template.textAlign
                              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          title="Justificado"
                        >
                          <AlignJustify className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, textAlign: "center" })}
                          className={`p-1.5 rounded-lg ${
                            template.textAlign === "center"
                              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          title="Centralizado"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, textAlign: "left" })}
                          className={`p-1.5 rounded-lg ${
                            template.textAlign === "left"
                              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          title="Alinhado à Esquerda"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, textAlign: "right" })}
                          className={`p-1.5 rounded-lg ${
                            template.textAlign === "right"
                              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                          title="Alinhado à Direita"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Largura da Caixa de Texto */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                        Largura da Caixa do Texto:
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: "narrow", label: "Compacta" },
                          { id: "normal", label: "Padrão" },
                          { id: "wide", label: "Ampla" },
                          { id: "full", label: "Total" },
                        ].map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setTemplate({ ...template, textBoxWidth: w.id as any })}
                            className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                              (template.textBoxWidth || "normal") === w.id
                                ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Corpo do Texto */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Corpo do Texto
                      </label>
                      <span className="text-[10px] text-slate-400">Variável: [NOME DO ALUNO]</span>
                    </div>
                    <textarea
                      value={template.bodyText}
                      onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                      className="w-full h-28 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs leading-relaxed outline-none focus:border-sky-500 resize-none text-slate-800 dark:text-slate-200 shadow-inner"
                      placeholder="Deixe em branco para utilizar a redação institucional padrão..."
                    ></textarea>
                  </div>

                  {/* Botão de Redação IA */}
                  <button
                    type="button"
                    onClick={handleGenerateText}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] disabled:opacity-50 text-xs"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
                    {isGenerating ? "Redigindo com Gemini..." : "Redigir com IA Gemini"}
                  </button>
                </div>
              )}

              {/* ABA 2: LOGO DO EVENTO */}
              {activeTab === "logo" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Logo no Certificado</h4>
                      <p className="text-[11px] text-slate-500">Adicione a logo oficial do evento ou instituição</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showLogo ?? true}
                        onChange={(e) => setTemplate({ ...template, showLogo: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>

                  {/* Preview da Logo */}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[120px] text-center space-y-3">
                    {template.logoUrl || (template.showLogo && event.imageUrl) ? (
                      <div className="relative group">
                        <img
                          src={template.logoUrl || event.imageUrl}
                          alt="Logo do Evento"
                          style={{ height: `${template.logoSize || 70}px` }}
                          className="object-contain max-w-[200px] drop-shadow-sm rounded-lg"
                        />
                        {template.logoUrl && (
                          <button
                            onClick={() => setTemplate({ ...template, logoUrl: undefined })}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                            title="Remover Logo Customizada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs flex flex-col items-center gap-1.5">
                        <ImageIcon className="w-8 h-8 opacity-40" />
                        <span>Nenhuma logo selecionada</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-850 w-full">
                      <label className="py-2 px-3 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        {template.logoUrl ? "Trocar Logo (PNG/JPG)" : "Enviar Nova Logo"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleUploadImage(e, "logoUrl")}
                        />
                      </label>

                      {event.imageUrl && !template.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, logoUrl: event.imageUrl })}
                          className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          Usar Imagem do Evento
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Posição da Logo */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5 block">
                      Posicionamento da Logo
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "top-center", label: "Centro Superior" },
                        { id: "top-left", label: "Canto Esquerdo" },
                        { id: "top-right", label: "Canto Direito" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTemplate({ ...template, logoPosition: p.id as any })}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                            (template.logoPosition || "top-center") === p.id
                              ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tamanho da Logo */}
                  <div className="bg-white dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Tamanho da Logo:</span>
                      <span className="font-bold text-sky-600">{template.logoSize || 70}px</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="150"
                      step="5"
                      value={template.logoSize || 70}
                      onChange={(e) => setTemplate({ ...template, logoSize: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Pequena (40px)</span>
                      <span>Média (70px)</span>
                      <span>Grande (150px)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: DESIGN & ESTILOS */}
              {activeTab === "design" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Temas e Molduras Oficiais</h4>
                      <p className="text-[11px] text-slate-500">Escolha o modelo de design para o certificado</p>
                    </div>
                    <button
                      type="button"
                      onClick={applyNanoBanana}
                      className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                      title="Sortear combinações harmoniosas de design"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Nano Banana AI
                    </button>
                  </div>

                  {/* Grid de Temas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TEMPLATE_STYLES.map((ts) => (
                      <button
                        key={ts.bg}
                        type="button"
                        onClick={() =>
                          setTemplate({
                            ...template,
                            bgStyle: ts.bg,
                            fontFamily: ts.font,
                            backgroundImageUrl: undefined,
                          })
                        }
                        className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                          template.bgStyle === ts.bg && !template.backgroundImageUrl
                            ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs">{ts.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{ts.desc}</div>
                        </div>
                        {template.bgStyle === ts.bg && !template.backgroundImageUrl && (
                          <span className="self-end mt-2 text-[10px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Selecionado
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Fundo Personalizado */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-2 block">
                      Ou utilize uma Arte de Fundo Personalizada
                    </label>
                    {template.backgroundImageUrl ? (
                      <div className="relative w-full h-20 bg-slate-100 rounded-2xl overflow-hidden border-2 border-sky-500 shadow-sm">
                        <img
                          src={template.backgroundImageUrl}
                          alt="Fundo Personalizado"
                          className="w-full h-full object-cover opacity-90"
                        />
                        <button
                          onClick={() => setTemplate({ ...template, backgroundImageUrl: undefined })}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                          title="Remover fundo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full py-3 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Enviar imagem de fundo (PNG / JPG de alta resolução)
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleUploadImage(e, "backgroundImageUrl")}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 4: ASSINATURAS */}
              {activeTab === "signatures" && (
                <div className="space-y-4">
                  {/* Controles de Tamanho e Posição das Assinaturas */}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Ajuste Fino das Assinaturas
                    </span>

                    {/* Tamanho da Assinatura */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Tamanho / Altura:</span>
                        <span className="font-bold text-sky-600">{template.signatureSize || 65}px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="120"
                        step="5"
                        value={template.signatureSize || 65}
                        onChange={(e) => setTemplate({ ...template, signatureSize: Number(e.target.value) })}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Pequena (40px)</span>
                        <span>Média (65px)</span>
                        <span>Grande (120px)</span>
                      </div>
                    </div>

                    {/* Mover Assinaturas Verticalmente */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <MoveVertical className="w-3.5 h-3.5" /> Mover Posição Vertical:
                        </span>
                        <span className="font-bold text-sky-600">{template.signatureOffsetY || 0}px</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        step="2"
                        value={template.signatureOffsetY || 0}
                        onChange={(e) => setTemplate({ ...template, signatureOffsetY: Number(e.target.value) })}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Mais Alto (-30px)</span>
                        <span>Neutro (0)</span>
                        <span>Mais Baixo (+30px)</span>
                      </div>
                    </div>

                    {/* Distribuição Horizontal */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                        Alinhamento / Distribuição:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "space-around", label: "Espaçadas" },
                          { id: "center", label: "Centralizadas" },
                          { id: "space-between", label: "Extremidades" },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setTemplate({ ...template, signaturePosition: d.id as any })}
                            className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                              (template.signaturePosition || "space-around") === d.id
                                ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Assinatura 1: Diretor FAJOPA */}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="showFajopaDirector"
                          checked={template.showFajopaDirectorSignature ?? true}
                          onChange={(e) =>
                            setTemplate({ ...template, showFajopaDirectorSignature: e.target.checked })
                          }
                          className="rounded text-sky-600 focus:ring-sky-500 dark:bg-slate-900 dark:border-slate-600 w-4 h-4 cursor-pointer"
                        />
                        <label
                          htmlFor="showFajopaDirector"
                          className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase cursor-pointer"
                        >
                          Diretor de Ensino FAJOPA
                        </label>
                      </div>
                    </div>

                    {(template.showFajopaDirectorSignature ?? true) && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                        <input
                          type="text"
                          placeholder={settings.directorName || "Nome do Diretor FAJOPA"}
                          value={template.fajopaDirectorName || ""}
                          onChange={(e) => setTemplate({ ...template, fajopaDirectorName: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-sky-600 dark:text-sky-400 font-bold cursor-pointer hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {template.fajopaDirectorSignatureUrl ? "Trocar Imagem Assinatura" : "Enviar Imagem Assinatura"}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleUploadImage(e, "fajopaDirectorSignatureUrl")}
                            />
                          </label>
                          {template.fajopaDirectorSignatureUrl && (
                            <button
                              type="button"
                              onClick={() => setTemplate({ ...template, fajopaDirectorSignatureUrl: undefined })}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Remover imagem
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assinatura 2: Reitor do Seminário */}
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="showSeminarRector"
                          checked={template.showSeminarRectorSignature ?? true}
                          onChange={(e) =>
                            setTemplate({ ...template, showSeminarRectorSignature: e.target.checked })
                          }
                          className="rounded text-sky-600 focus:ring-sky-500 dark:bg-slate-900 dark:border-slate-600 w-4 h-4 cursor-pointer"
                        />
                        <label
                          htmlFor="showSeminarRector"
                          className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase cursor-pointer"
                        >
                          Reitor do Seminário
                        </label>
                      </div>
                    </div>

                    {(template.showSeminarRectorSignature ?? true) && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                        <input
                          type="text"
                          placeholder={settings.rectorName || "Nome do Reitor"}
                          value={template.seminarRectorName || ""}
                          onChange={(e) => setTemplate({ ...template, seminarRectorName: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] text-sky-600 dark:text-sky-400 font-bold cursor-pointer hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {template.seminarRectorSignatureUrl ? "Trocar Imagem Assinatura" : "Enviar Imagem Assinatura"}
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleUploadImage(e, "seminarRectorSignatureUrl")}
                            />
                          </label>
                          {template.seminarRectorSignatureUrl && (
                            <button
                              type="button"
                              onClick={() => setTemplate({ ...template, seminarRectorSignatureUrl: undefined })}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Remover imagem
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DE PRÉ-VISUALIZAÇÃO (Direita) */}
          <div className="bg-slate-200/90 dark:bg-slate-950 flex-1 flex flex-col items-center justify-start p-4 sm:p-6 min-h-[480px] overflow-hidden">
            
            {/* Barra de Controles do Preview (Zoom & Info) */}
            <div className="w-full flex items-center justify-between mb-3 z-10 px-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <FileBadge className="w-4 h-4 text-sky-500" />
                <span>Pré-visualização em Tempo Real (A4 Paisagem)</span>
              </div>

              <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 py-1 px-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(z - 0.05, 0.3))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold w-12 text-center text-slate-800 dark:text-slate-200">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(z + 0.05, 1.5))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(0.75)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                  title="Restaurar 75%"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Container do Certificado Renderizado */}
            <div className="flex-1 w-full flex items-center justify-center overflow-auto custom-scrollbar p-2">
              <div
                className="shadow-2xl transition-transform transform origin-center rounded-sm"
                style={{ transform: `scale(${zoom})` }}
              >
                <CertificateRenderer
                  ref={rendererRef}
                  event={event}
                  template={template}
                  member={{ name: "JOÃO PEDRO DA SILVA", ra: "2026-00123" }}
                  isOrganizer={type === "organizer"}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO EDITOR COM AÇÕES */}
        <div className="p-4 sm:px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            {type === "organizer" ? "Modelo de Organização do Evento" : "Modelo de Participação Geral"}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-6 py-2.5 bg-slate-900 hover:bg-black dark:bg-sky-500 dark:hover:bg-sky-400 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Conferir e Liberar aos Alunos"}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
