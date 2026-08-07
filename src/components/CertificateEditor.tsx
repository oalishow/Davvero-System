import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Wand2, Sparkles, CheckCircle, Save, Upload, Trash2, ZoomIn, ZoomOut } from "lucide-react";
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
  { name: "Clássico", bg: "theme-classic", font: "serif" },
  { name: "Moderno", bg: "theme-modern", font: "sans" },
  { name: "Teológico", bg: "theme-theology", font: "serif" },
  { name: "Solene", bg: "theme-solemn", font: "serif" },
];

export default function CertificateEditor({
  event,
  onClose,
  onSaved,
  type = "participant",
}: CertificateEditorProps) {
  const { settings } = useSettings();
  const { showAlert, showConfirm } = useDialog();
  
  const [template, setTemplate] = useState<CertificateTemplate>(
    (type === "organizer" ? event.organizationCertificateTemplate : event.certificateTemplate) || {
      bodyText: "",
      fontFamily: "sans",
      bgStyle: "theme-classic",
      signatureName: "",
      signatureRole: "",
      signature2Name: "",
      signature2Role: "",
      isApproved: false,
      showFajopaDirectorSignature: true,
      fajopaDirectorName: "",
    }
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const rendererRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoom, setZoom] = useState(0.8);

  // Load custom assets if exists
  useEffect(() => {
    const fetchAssets = async () => {
      // First try to load from the new unified cert_assets doc
      try {
        const assetDocId = type === "organizer" ? `cert_assets_org_${event.id}` : `cert_assets_${event.id}`;
        const assetsSnap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, assetDocId)));
        if (assetsSnap.exists() && assetsSnap.data().data) {
          const assetsData = assetsSnap.data().data;
          setTemplate(prev => ({
            ...prev,
            ...(assetsData.backgroundImageUrl && { backgroundImageUrl: assetsData.backgroundImageUrl }),
            ...(assetsData.fajopaDirectorSignatureUrl && { fajopaDirectorSignatureUrl: assetsData.fajopaDirectorSignatureUrl }),
            ...(assetsData.seminarRectorSignatureUrl && { seminarRectorSignatureUrl: assetsData.seminarRectorSignatureUrl }),
          }));
          return; // If we found the new format, stop here
        }
      } catch (err) {
        console.error("Failed to load cert assets", err);
      }

      // Fallback for old custom bg format
      if ((event.certificateTemplate as any)?.hasCustomBg) {
        try {
          const bgSnap = await getDoc(doc(db, ASSETS_DOC_PATH(appId, `cert_bg_${event.id}`)));
          if (bgSnap.exists() && bgSnap.data().data) {
            setTemplate(prev => ({...prev, backgroundImageUrl: bgSnap.data().data}));
          }
        } catch (err) {
           console.error("Failed to load old cert bg", err);
        }
      }
    };

    fetchAssets();
  }, [event.id, event.certificateTemplate]);

  const handleGenerateText = async () => {
    setIsGenerating(true);
    try {
      const themeLabel = TEMPLATE_STYLES.find(t => t.bg === template.bgStyle)?.name || "Clássico";
      const certRole = type === "organizer" ? "Membro da Equipe de Organização" : "Participação";
      const certHours = type === "organizer" && event.organizationHours ? event.organizationHours : event.hours;
      
      const prompt = `Você é um curador acadêmico e teológico especialista em redação oficial.
Escreva O CORPO do texto de um Certificado de ${certRole} para o evento "${event.title}".
Descrição do evento: "${event.description}".
Carga horária: ${certHours} horas.
Data de Início: ${new Date(event.startDate).toLocaleDateString('pt-BR')}

Tone of Voice / Tema selecionado: ${themeLabel}.
- Se 'Tema' for Teológico/Solene, use um tom mais cerimonial, espiritual e acadêmico.
- Se for Moderno/Clássico, seja direto e elegante.

Instruções RIGOROSAS:
1. Comece diretamente com o texto (ex: "Certificamos que..."). Sem saudações.
2. OBRIGATÓRIO: Use exatamente a tag "[NOME DO ALUNO]" no lugar do nome e "[RA DO ALUNO]" onde faria sentido colocar o registro acadêmico se quiser.
3. Não inclua assinaturas ou cabeçalhos. Apenas o parágrafo central.
4. Mencione a carga horária e de forma elegante o nome do evento.`;

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
      setTemplate({ ...template, bodyText: text.trim().replace(/^"|"$/g, '') });
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao gerar texto: " + e.message, { type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyNanoBanana = () => {
    const styles = TEMPLATE_STYLES.slice(2);
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    setTemplate({
      ...template,
      bgStyle: randomStyle.bg,
      fontFamily: randomStyle.font,
    });
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof CertificateTemplate) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const maxSize = fieldName === 'backgroundImageUrl' ? 2000 : 400; // Backgrounds can be large, signatures smaller
      const base64 = await resizeAndConvertToBase64(file, maxSize);
      setTemplate({ ...template, [fieldName]: base64 });
    } catch (err) {
      console.error(err);
      showAlert("Erro ao carregar imagem.", { type: 'error' });
    }
  };

  const handleSave = async (shouldApprove: boolean = false) => {
    if (shouldApprove && !(await showConfirm("Ao conferir e liberar, os alunos poderão baixar o certificado. Deseja continuar?", { type: 'warning' }))) return;
    setIsSaving(true);
    console.log(`Start handleSave (approve: ${shouldApprove})...`);
    
    try {
      const finalTemplate: any = { ...template, isApproved: shouldApprove || template.isApproved };
      const assetsData: any = {};
      let hasAnyAssets = false;

      // Extract all URLs (both data URI and HTTP) to the assets document 
      // to keep the global events document small.
      
      // 1. Background
      if (template.backgroundImageUrl) {
        assetsData.backgroundImageUrl = template.backgroundImageUrl;
        hasAnyAssets = true;
        finalTemplate.hasCustomBg = true;
      } else {
        finalTemplate.hasCustomBg = false;
      }
      delete finalTemplate.backgroundImageUrl;

      // 2. FAJOPA Signature
      if (template.fajopaDirectorSignatureUrl) {
        assetsData.fajopaDirectorSignatureUrl = template.fajopaDirectorSignatureUrl;
        hasAnyAssets = true;
        finalTemplate.hasFajopaSignature = true;
      } else {
        finalTemplate.hasFajopaSignature = false;
      }
      delete finalTemplate.fajopaDirectorSignatureUrl;

      // 3. Seminar Signature
      if (template.seminarRectorSignatureUrl) {
        assetsData.seminarRectorSignatureUrl = template.seminarRectorSignatureUrl;
        hasAnyAssets = true;
        finalTemplate.hasRectorSignature = true;
      } else {
        finalTemplate.hasRectorSignature = false;
      }
      delete finalTemplate.seminarRectorSignatureUrl;

      // Always update assets doc if we have assets OR if we previously had them (to ensure sync)
      console.log("Saving assets document...");
      const assetDocId = type === "organizer" ? `cert_assets_org_${event.id}` : `cert_assets_${event.id}`;
      await setDoc(doc(db, ASSETS_DOC_PATH(appId, assetDocId)), { 
        data: hasAnyAssets ? assetsData : null,
        updatedAt: new Date().toISOString()
      });

      console.log("Updating main event document...");
      if (type === "organizer") {
        await updateEvent(event.id, { organizationCertificateTemplate: finalTemplate });
        onSaved({ ...event, organizationCertificateTemplate: finalTemplate });
      } else {
        await updateEvent(event.id, { certificateTemplate: finalTemplate });
        onSaved({ ...event, certificateTemplate: finalTemplate });
      }
      
      showAlert(shouldApprove ? "Configurações do certificado liberadas com sucesso!" : "Alterações salvas com sucesso!", { type: 'success' });
    } catch (e: any) {
      console.error("Error saving certificate:", e);
      showAlert("Erro ao salvar: " + (e.message || "Tente novamente."), { type: 'error' });
    } finally {
      setIsSaving(false);
      console.log("handleSave finished.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto border border-slate-200 dark:border-slate-800">
        
        {/* CABEÇALHO DO EDITOR */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <Wand2 className="w-5 h-5 text-sky-500" />
             <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
               Editor de Certificado {type === "organizer" ? "da Organização" : "de Participação"}
             </h2>
             <span className="hidden sm:inline text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
               {event.title}
             </span>
             {template.isApproved && (
               <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                 <CheckCircle className="w-3 h-3" />
                 Liberado
               </span>
             )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        {/* ÁREA DE CONTEÚDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          {/* SEÇÃO 1: FERRAMENTAS (Topo) */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
            {/* Coluna Esquerda: Textos e Inteligência Artificial */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider flex items-center gap-2">
                Configurações de Texto
              </h3>
              
              <div className="space-y-2">
                <textarea
                  value={template.bodyText}
                  onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                  className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-500 resize-none text-slate-700 dark:text-slate-300"
                  placeholder="Deixe em branco para usar o texto padrão..."
                ></textarea>
                <p className="text-[10px] text-slate-400">Use [NOME DO ALUNO] como variável de substituição.</p>
              </div>

              <button
                onClick={handleGenerateText}
                disabled={isGenerating}
                className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-2.5 rounded-lg font-bold hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? "Gerando..." : "Produzir Texto com Gemini"}
              </button>
            </div>
            
            {/* Coluna Direita: Design e Assinaturas */}
            <div className="space-y-5 md:border-l md:border-slate-100 dark:md:border-slate-800 md:pl-8">
              <div className="flex items-center justify-between">
                 <h3 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Design & Fundo</h3>
                 <button
                   onClick={applyNanoBanana}
                   className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                 >
                   <Wand2 className="w-3 h-3" />
                   Nano Banana
                 </button>
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATE_STYLES.map((ts, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTemplate({ ...template, bgStyle: ts.bg, fontFamily: ts.font, backgroundImageUrl: undefined })}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${
                        template.bgStyle === ts.bg && !template.backgroundImageUrl
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                      }`}
                    >
                      {ts.name}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                   {template.backgroundImageUrl ? (
                     <div className="relative w-full h-16 bg-slate-100 rounded-lg overflow-hidden border-2 border-sky-500">
                        <img src={template.backgroundImageUrl} alt="Background" className="w-full h-full object-cover opacity-80" />
                        <button onClick={() => setTemplate({ ...template, backgroundImageUrl: undefined })} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
                     </div>
                   ) : (
                     <label className="w-full py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">Enviar fundo personalizado</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadImage(e, "backgroundImageUrl")} />
                     </label>
                   )}
                </div>
              </div>

              {/* Assinaturas */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                 <h3 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Assinaturas</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id="showFajopaDirector"
                          checked={template.showFajopaDirectorSignature ?? false}
                          onChange={(e) => setTemplate({ ...template, showFajopaDirectorSignature: e.target.checked })}
                          className="rounded text-sky-600 focus:ring-sky-500 dark:bg-slate-900 dark:border-slate-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="showFajopaDirector" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase cursor-pointer">
                          Diretor FAJOPA
                        </label>
                      </div>
                      {(template.showFajopaDirectorSignature ?? false) && (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder={settings.directorName || "Nome do Diretor"}
                            value={template.fajopaDirectorName || ""}
                            onChange={(e) => setTemplate({ ...template, fajopaDirectorName: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] outline-none focus:border-sky-500"
                          />
                          <label className="text-[10px] text-sky-600 font-bold cursor-pointer hover:underline block">
                            {template.fajopaDirectorSignatureUrl ? 'Trocar Imagem' : '+ Adicionar Imagem Local'}
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadImage(e, "fajopaDirectorSignatureUrl")} />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id="showSeminarRector"
                          checked={template.showSeminarRectorSignature ?? false}
                          onChange={(e) => setTemplate({ ...template, showSeminarRectorSignature: e.target.checked })}
                          className="rounded text-sky-600 focus:ring-sky-500 dark:bg-slate-900 dark:border-slate-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="showSeminarRector" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase cursor-pointer">
                          Reitor do Seminário
                        </label>
                      </div>
                      {(template.showSeminarRectorSignature ?? false) && (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder={settings.rectorName || "Nome do Reitor"}
                            value={template.seminarRectorName || ""}
                            onChange={(e) => setTemplate({ ...template, seminarRectorName: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] outline-none focus:border-sky-500"
                          />
                          <label className="text-[10px] text-sky-600 font-bold cursor-pointer hover:underline block">
                            {template.seminarRectorSignatureUrl ? 'Trocar Imagem' : '+ Adicionar Imagem Local'}
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadImage(e, "seminarRectorSignatureUrl")} />
                          </label>
                        </div>
                      )}
                    </div>
                 </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: VISUALIZAÇÃO (Abaixo) */}
          <div className="bg-slate-200 dark:bg-slate-950 flex-1 flex flex-col items-center justify-center p-8 min-h-[500px] overflow-hidden">
             
             {/* Controles de Zoom simples */}
             <div className="flex gap-2 bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg mb-4 shadow-sm backdrop-blur-sm z-10">
               <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4 text-slate-700 dark:text-slate-300"/></button>
               <span className="text-xs font-bold w-12 text-center text-slate-700 dark:text-slate-300 place-self-center">{Math.round(zoom * 100)}%</span>
               <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4 text-slate-700 dark:text-slate-300"/></button>
             </div>

             <div className="flex-1 w-full flex items-center justify-center overflow-auto custom-scrollbar">
                <div 
                   className="shadow-2xl transition-transform transform origin-center"
                   style={{ transform: `scale(${zoom})` }}
                >
                   <CertificateRenderer 
                     ref={rendererRef} 
                     event={event} 
                     template={template} 
                     member={{ name: "JOÃO DA SILVA", ra: "123456" }} 
                     isOrganizer={type === "organizer"}
                   />
                </div>
             </div>
          </div>
        </div>

        {/* RODAPÉ DO EDITOR COM AÇÕES */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors">
            Cancelar
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>

            <button 
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? "Salvando..." : (
                 <>
                   <CheckCircle className="w-4 h-4" />
                   Conferir e Liberar
                 </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>, document.body
  );
}
