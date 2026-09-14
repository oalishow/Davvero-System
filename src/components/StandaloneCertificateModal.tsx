import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Award,
  Upload,
  FileSpreadsheet,
  FileText,
  UserCheck,
  UserX,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  Sparkles,
  FileArchive,
  ChevronRight,
  ShieldCheck,
  Search,
  PenTool,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, appId, auth } from "../lib/firebase";
import { CertificateRenderer } from "./CertificateRenderer";
import {
  generateCertificateCode,
  registerCertificateRecord,
  type CertificateRecord,
} from "../lib/certificateAuth";
import type { Event, Member, CertificateTemplate, CustomSignatureItem } from "../types";

interface ParsedRecipient {
  id: string;
  name: string;
  ra?: string;
  cpf?: string;
  email?: string;
  isRegistered: boolean;
  matchedMember?: Member;
  certCode?: string;
}

interface StandaloneCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEvent?: Event | null; // Se for para visualizar/baixar de um evento avulso já criado
  adminMember?: Member | null;
  onSuccess?: () => void;
}

export default function StandaloneCertificateModal({
  isOpen,
  onClose,
  existingEvent,
  adminMember,
  onSuccess,
}: StandaloneCertificateModalProps) {
  // Passos: 1 = Configuração & Nomes, 2 = Concluído / Downloads
  const [step, setStep] = useState<"form" | "result">(existingEvent ? "result" : "form");

  // Dados do certificado
  const [title, setTitle] = useState(existingEvent?.title || "");
  const [certType, setCertType] = useState<"participant" | "organizer">(
    existingEvent?.organizationCertificateTemplate ? "organizer" : "participant"
  );
  const [hours, setHours] = useState(existingEvent?.hours?.toString() || "20");
  const [format, setFormat] = useState(existingEvent?.format || "Presencial");
  const [eventDate, setEventDate] = useState(
    existingEvent?.startDate ? existingEvent.startDate.substring(0, 10) : new Date().toISOString().substring(0, 10)
  );
  const [location, setLocation] = useState(existingEvent?.location || "Marília - SP");
  const [bgStyle, setBgStyle] = useState<string>(
    existingEvent?.certificateTemplate?.bgStyle || "theme-classic"
  );
  const [customBodyText, setCustomBodyText] = useState<string>(
    existingEvent?.certificateTemplate?.bodyText || ""
  );

  // Assinaturas
  const [showFajopaDirector, setShowFajopaDirector] = useState(
    existingEvent?.certificateTemplate?.showFajopaDirectorSignature ?? true
  );
  const [showSeminarRector, setShowSeminarRector] = useState(
    existingEvent?.certificateTemplate?.showSeminarRectorSignature ?? true
  );
  const [showCustomSig, setShowCustomSig] = useState(
    existingEvent?.certificateTemplate?.showSignature1 ?? false
  );
  const [customSigName, setCustomSigName] = useState(
    existingEvent?.certificateTemplate?.signature1Name || ""
  );
  const [customSigRole, setCustomSigRole] = useState(
    existingEvent?.certificateTemplate?.signature1Role || "Coordenador(a)"
  );
  const [customSignatures, setCustomSignatures] = useState<CustomSignatureItem[]>(
    existingEvent?.certificateTemplate?.customSignatures || []
  );

  const handleAddCustomSignature = () => {
    const newSig: CustomSignatureItem = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: "",
      role: "",
      show: true,
    };
    setCustomSignatures((prev) => [...prev, newSig]);
  };

  const handleRemoveCustomSignature = (sigId: string) => {
    setCustomSignatures((prev) => prev.filter((s) => s.id !== sigId));
  };

  const handleUpdateCustomSignature = (sigId: string, updates: Partial<CustomSignatureItem>) => {
    setCustomSignatures((prev) =>
      prev.map((s) => (s.id === sigId ? { ...s, ...updates } : s))
    );
  };

  const handleUploadCustomSignature = async (
    e: React.ChangeEvent<HTMLInputElement>,
    sigId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          handleUpdateCustomSignature(sigId, { signatureUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert("Erro ao processar imagem da assinatura.");
    }
  };

  // Lista de estudantes cadastrados no sistema para matching
  const [systemStudents, setSystemStudents] = useState<Member[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Participantes importados/digitados
  const [recipients, setRecipients] = useState<ParsedRecipient[]>([]);
  const [inputMode, setInputMode] = useState<"file" | "paste" | "manual">("file");
  const [pasteText, setPasteText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualRa, setManualRa] = useState("");
  const [manualCpf, setManualCpf] = useState("");

  // Estado de processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [createdEvent, setCreatedEvent] = useState<Event | null>(existingEvent || null);

  // Visualização de prévia de participante individual
  const [previewRecipient, setPreviewRecipient] = useState<ParsedRecipient | null>(null);

  // Download individual e em lote (.ZIP)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, percentage: 0 });

  // Busca na tabela de resultados
  const [searchFilter, setSearchFilter] = useState("");

  // Carrega alunos do Firestore para fazer o matching por nome/RA/CPF
  useEffect(() => {
    if (!isOpen) return;
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`));
        const list: Member[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setSystemStudents(list);
      } catch (err) {
        console.warn("Notice loading students for matching:", err);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [isOpen]);

  // Se já veio com um evento existente, carregar os participantes
  useEffect(() => {
    if (existingEvent && isOpen) {
      setCreatedEvent(existingEvent);
      setStep("result");
      setTitle(existingEvent.title || "");
      setHours(existingEvent.hours?.toString() || "20");
      setFormat(existingEvent.format || "Presencial");

      // Carregar participantes do evento existente
      const loadExistingRecipients = async () => {
        try {
          const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/attendances`));
          const list: ParsedRecipient[] = [];

          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.eventId === existingEvent.id) {
              list.push({
                id: docSnap.id,
                name: data.studentName || "Participante",
                ra: data.studentRa || "",
                cpf: data.studentCpf || "",
                email: data.studentEmail || "",
                isRegistered: true,
                certCode: generateCertificateCode(existingEvent, {
                  id: data.studentId,
                  name: data.studentName,
                  ra: data.studentRa,
                  cpf: data.studentCpf,
                } as Member),
              });
            }
          });

          // Também adiciona os externos
          if (existingEvent.externalRecipients && Array.isArray(existingEvent.externalRecipients)) {
            existingEvent.externalRecipients.forEach((ext) => {
              list.push({
                id: ext.id,
                name: ext.name,
                ra: ext.ra || "",
                cpf: ext.cpf || "",
                email: ext.email || "",
                isRegistered: false,
                certCode: ext.certCode || generateCertificateCode(existingEvent, {
                  id: ext.id,
                  name: ext.name,
                  ra: ext.ra,
                  cpf: ext.cpf,
                } as Member),
              });
            });
          }

          setRecipients(list);
        } catch (err) {
          console.warn("Error loading existing recipients:", err);
        }
      };

      loadExistingRecipients();
    }
  }, [existingEvent, isOpen]);

  // Função para normalizar strings para comparação
  const normalize = (str: string) => {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  // Tenta encontrar um aluno no sistema pelo Nome, RA ou CPF
  const matchStudent = (name: string, ra?: string, cpf?: string): Member | undefined => {
    const cleanName = normalize(name);
    const cleanRa = (ra || "").replace(/[^0-9a-zA-Z]/g, "").trim();
    const cleanCpf = (cpf || "").replace(/[^0-9]/g, "").trim();

    return systemStudents.find((s) => {
      // 1. Busca por RA exato
      if (cleanRa && s.ra && s.ra.replace(/[^0-9a-zA-Z]/g, "").trim() === cleanRa) {
        return true;
      }
      // 2. Busca por CPF exato
      if (cleanCpf && s.cpf && s.cpf.replace(/[^0-9]/g, "").trim() === cleanCpf) {
        return true;
      }
      // 3. Busca por Nome completo normalizado
      const studentCleanName = normalize(s.name || "");
      if (cleanName && studentCleanName && (cleanName === studentCleanName || studentCleanName.includes(cleanName) || cleanName.includes(studentCleanName))) {
        return true;
      }
      return false;
    });
  };

  // Processar planilha (.xlsx, .xls, .csv, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith(".txt")) {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (!text) return;
        processNamesText(text);
      };
      reader.readAsText(file);
    } else {
      // Excel ou CSV via XLSX
      reader.onload = async (evt) => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!json || json.length === 0) {
            alert("A planilha parece estar vazia.");
            return;
          }

          // Identificar cabeçalhos na primeira linha com dados
          let headerRowIndex = 0;
          let nameCol = -1;
          let raCol = -1;
          let cpfCol = -1;
          let emailCol = -1;

          for (let r = 0; r < Math.min(5, json.length); r++) {
            const row = json[r] || [];
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || "").toLowerCase().trim();
              if (nameCol === -1 && (val.includes("nome") || val.includes("name") || val.includes("aluno") || val.includes("participante"))) {
                nameCol = c;
                headerRowIndex = r;
              }
              if (raCol === -1 && (val === "ra" || val.includes("registro") || val.includes("matricula"))) {
                raCol = c;
              }
              if (cpfCol === -1 && val.includes("cpf")) {
                cpfCol = c;
              }
              if (emailCol === -1 && (val.includes("email") || val.includes("e-mail"))) {
                emailCol = c;
              }
            }
            if (nameCol !== -1) break;
          }

          // Se não encontrou coluna explícita de nome, assume a primeira coluna com texto
          if (nameCol === -1) {
            nameCol = 0;
            headerRowIndex = -1; // não pula cabeçalho
          }

          const parsedList: ParsedRecipient[] = [];
          for (let i = headerRowIndex + 1; i < json.length; i++) {
            const row = json[i];
            if (!row || !row[nameCol]) continue;
            const rawName = String(row[nameCol]).trim();
            if (!rawName || rawName.length < 2) continue;

            const rawRa = raCol !== -1 && row[raCol] ? String(row[raCol]).trim() : undefined;
            const rawCpf = cpfCol !== -1 && row[cpfCol] ? String(row[cpfCol]).trim() : undefined;
            const rawEmail = emailCol !== -1 && row[emailCol] ? String(row[emailCol]).trim() : undefined;

            const matched = matchStudent(rawName, rawRa, rawCpf);

            parsedList.push({
              id: "rec_" + Math.random().toString(36).substring(2, 9),
              name: matched ? matched.name : rawName,
              ra: matched?.ra || rawRa || "",
              cpf: matched?.cpf || rawCpf || "",
              email: matched?.email || rawEmail || "",
              isRegistered: Boolean(matched),
              matchedMember: matched,
            });
          }

          if (parsedList.length === 0) {
            alert("Nenhum nome válido foi encontrado na planilha.");
            return;
          }

          setRecipients((prev) => [...prev, ...parsedList]);
        } catch (err: any) {
          console.error("Erro ao ler planilha:", err);
          alert("Não foi possível processar a planilha. Verifique se o arquivo está no formato correto.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Processar texto colado com lista de nomes (1 por linha)
  const processNamesText = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 1);

    if (lines.length === 0) {
      alert("Nenhum nome válido detectado no texto.");
      return;
    }

    const parsedList: ParsedRecipient[] = lines.map((line) => {
      // Pode ser formato "Nome, RA, CPF"
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const rawName = parts[0] || line;
      const rawRa = parts[1] || "";
      const rawCpf = parts[2] || "";

      const matched = matchStudent(rawName, rawRa, rawCpf);

      return {
        id: "rec_" + Math.random().toString(36).substring(2, 9),
        name: matched ? matched.name : rawName,
        ra: matched?.ra || rawRa,
        cpf: matched?.cpf || rawCpf,
        email: matched?.email || "",
        isRegistered: Boolean(matched),
        matchedMember: matched,
      };
    });

    setRecipients((prev) => [...prev, ...parsedList]);
    setPasteText("");
  };

  // Adicionar manualmente 1 participante
  const handleAddManual = () => {
    if (!manualName.trim()) {
      alert("Por favor, digite o nome da pessoa.");
      return;
    }

    const matched = matchStudent(manualName, manualRa, manualCpf);

    setRecipients((prev) => [
      ...prev,
      {
        id: "rec_" + Math.random().toString(36).substring(2, 9),
        name: matched ? matched.name : manualName.trim(),
        ra: matched?.ra || manualRa.trim(),
        cpf: matched?.cpf || manualCpf.trim(),
        email: matched?.email || "",
        isRegistered: Boolean(matched),
        matchedMember: matched,
      },
    ]);

    setManualName("");
    setManualRa("");
    setManualCpf("");
  };

  // Remover participante da lista
  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // Template montado para o certificado
  const builtTemplate: CertificateTemplate = useMemo(() => {
    return {
      bgStyle: bgStyle as any,
      fontFamily: "serif",
      titleText: "CERTIFICADO",
      subtitleText: certType === "organizer" ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO",
      bodyText: customBodyText || "",
      isApproved: true,
      showFajopaDirectorSignature: showFajopaDirector,
      showSeminarRectorSignature: showSeminarRector,
      showSignature1: showCustomSig,
      signature1Name: customSigName,
      signature1Role: customSigRole,
      customSignatures: customSignatures,
      fontSize: 26,
      textAlign: "justify",
      textBoxWidth: "normal",
    };
  }, [
    bgStyle,
    certType,
    customBodyText,
    showFajopaDirector,
    showSeminarRector,
    showCustomSig,
    customSigName,
    customSigRole,
    customSignatures,
  ]);

  // Objeto de evento simulado para renderização do certificado
  const activeEvent: Event = useMemo(() => {
    if (createdEvent) return createdEvent;
    return {
      id: "temp_standalone_" + Math.random().toString(36).substring(2, 8),
      title: title || "Atividade Acadêmica / Curso",
      hours: Number(hours) || 20,
      format: format,
      startDate: eventDate,
      endDate: eventDate,
      location: location,
      status: "encerrado",
      isCertificateReleased: true,
      certificateReleasedAt: new Date().toISOString(),
      certificateTemplate: builtTemplate,
      organizationCertificateTemplate: certType === "organizer" ? builtTemplate : undefined,
      isStandaloneCert: true,
    } as Event;
  }, [createdEvent, title, hours, format, eventDate, location, builtTemplate, certType]);

  // Contadores
  const registeredCount = recipients.filter((r) => r.isRegistered).length;
  const externalCount = recipients.filter((r) => !r.isRegistered).length;

  // -------------------------------------------------------------
  // SALVAR E GERAR CERTIFICADOS NO BANCO DE DADOS
  // -------------------------------------------------------------
  const handleGenerateCertificates = async () => {
    if (!title.trim()) {
      alert("Por favor, preencha o Título da Atividade/Curso.");
      return;
    }
    if (recipients.length === 0) {
      alert("Adicione pelo menos um participante através de planilha ou digitando os nomes.");
      return;
    }

    setIsProcessing(true);
    setProcessStatus("Criando registro da atividade no sistema...");

    try {
      const nowIso = new Date().toISOString();

      // 1. Criar o documento do evento avulso em `events`
      const eventPayload: Partial<Event> = {
        title: title.trim(),
        hours: Number(hours) || 20,
        format: format,
        startDate: eventDate,
        endDate: eventDate,
        location: location.trim(),
        status: "encerrado",
        isCertificateReleased: true,
        certificateReleasedAt: nowIso,
        certificateTemplate: builtTemplate,
        organizationCertificateTemplate: certType === "organizer" ? builtTemplate : undefined,
        createdAt: nowIso,
        isStandaloneCert: true,
      };

      const eventRef = await addDoc(
        collection(db, `artifacts/${appId}/public/data/events`),
        eventPayload
      );
      const newEventId = eventRef.id;

      // Se houver assinaturas com imagens, salva documento de assets associado
      const customSigsAssets: Record<string, string> = {};
      if (customSignatures && customSignatures.length > 0) {
        for (const sig of customSignatures) {
          if (sig.signatureUrl) {
            customSigsAssets[sig.id] = sig.signatureUrl;
          }
        }
      }
      if (Object.keys(customSigsAssets).length > 0) {
        try {
          await setDoc(doc(db, `artifacts/${appId}/public/data/cert_assets_${newEventId}`), {
            data: { customSignatures: customSigsAssets },
            updatedAt: nowIso,
          });
        } catch (e) {
          console.warn("Falha ao salvar assets de assinaturas:", e);
        }
      }

      const finalEvent: Event = {
        ...eventPayload,
        id: newEventId,
      } as Event;

      setCreatedEvent(finalEvent);

      // 2. Processar cada participante
      const updatedRecipients: ParsedRecipient[] = [];
      const externalList: any[] = [];

      for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i];
        setProcessStatus(
          `Processando e emitindo certificados (${i + 1} de ${recipients.length}): ${item.name}...`
        );

        // Gera código de autenticidade oficial
        const dummyMember: Member = {
          id: item.matchedMember?.id || item.id,
          name: item.name,
          ra: item.ra || "",
          cpf: item.cpf || "",
          course: item.matchedMember?.course || "",
          email: item.email || "",
          roles: ["aluno"],
          isApproved: true,
          status: "VALID",
          createdAt: nowIso,
        };

        const certCode = generateCertificateCode(finalEvent, dummyMember);

        if (item.isRegistered && item.matchedMember) {
          // Criar registro de presença / attendance vinculado ao aluno
          const attRef = doc(
            collection(db, `artifacts/${appId}/public/data/attendances`)
          );
          await setDoc(attRef, {
            eventId: newEventId,
            studentId: item.matchedMember.id,
            studentName: item.matchedMember.name,
            studentRa: item.matchedMember.ra || "",
            studentCpf: item.matchedMember.cpf || "",
            studentEmail: item.matchedMember.email || "",
            status: "presente",
            isOrganizer: certType === "organizer",
            timestamp: nowIso,
            certificateReleasedAt: nowIso,
            createdAt: nowIso,
          });

          // Registrar na tabela de autenticidade para consulta pública por QR Code
          await registerCertificateRecord({
            code: certCode,
            event: finalEvent,
            member: dummyMember,
            isOrganizer: certType === "organizer",
          }).catch((e) => console.warn("Notice registering cert record:", e));

          updatedRecipients.push({
            ...item,
            certCode,
          });
        } else {
          // Participante Externo: Salva na lista de externos do evento
          const extRecord = {
            id: item.id,
            name: item.name,
            ra: item.ra || "",
            cpf: item.cpf || "",
            email: item.email || "",
            certCode,
          };
          externalList.push(extRecord);

          // Também registra o código no validador público de autenticidade
          await registerCertificateRecord({
            code: certCode,
            event: finalEvent,
            member: dummyMember,
            isOrganizer: certType === "organizer",
          }).catch((e) => console.warn("Notice registering ext cert record:", e));

          updatedRecipients.push({
            ...item,
            certCode,
          });
        }
      }

      // Atualiza o evento com a lista de destinatários externos para persistência completa
      if (externalList.length > 0) {
        await setDoc(
          doc(db, `artifacts/${appId}/public/data/events`, newEventId),
          { externalRecipients: externalList },
          { merge: true }
        );
      }

      setRecipients(updatedRecipients);
      setStep("result");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Erro ao gerar certificados:", err);
      alert(`Falha ao gerar certificados: ${err?.message || "Tente novamente."}`);
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  // -------------------------------------------------------------
  // UTILITÁRIO: RENDERIZAR CERTIFICADO PARA CANVAS
  // -------------------------------------------------------------
  const renderCertificateToCanvas = async (nodeId: string): Promise<HTMLCanvasElement> => {
    const node = document.getElementById(nodeId);
    if (!node) {
      throw new Error(`Elemento de renderização não encontrado (#${nodeId})`);
    }

    // 1. Garantir que todas as imagens estejam decodificadas
    const imgElements = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgElements.map((img) => {
        if (img.complete && img.naturalWidth !== 0) {
          return (img.decode ? img.decode() : Promise.resolve()).catch(() => Promise.resolve());
        }
        return new Promise<void>((resolve) => {
          const onFinish = () => {
            img.removeEventListener("load", onFinish);
            img.removeEventListener("error", onFinish);
            resolve();
          };
          img.addEventListener("load", onFinish);
          img.addEventListener("error", onFinish);
          setTimeout(onFinish, 1400);
        });
      })
    );

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 180));

    try {
      const { toCanvas } = await import("html-to-image");
      const canvas = await toCanvas(node, {
        pixelRatio: 2.2,
        skipFonts: false,
        cacheBust: true,
      });
      return canvas;
    } catch (errCanvas) {
      console.warn("toCanvas falhou, usando fallback html2canvas:", errCanvas);
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      return canvas;
    }
  };

  // Gerar objeto jsPDF em A4 Paisagem
  const generatePdfFromCanvas = async (canvas: HTMLCanvasElement) => {
    const { jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/jpeg", 0.96);
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    pdf.addImage(imgData, "JPEG", 0, 0, 297, 210, undefined, "FAST");
    return pdf;
  };

  // Limpar nome de arquivo
  const sanitizeFilename = (name: string) => {
    return name
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 60);
  };

  // -------------------------------------------------------------
  // BAIXAR CERTIFICADO INDIVIDUAL
  // -------------------------------------------------------------
  const handleDownloadSingle = async (rec: ParsedRecipient) => {
    if (downloadingId) return;
    setDownloadingId(rec.id);

    try {
      const nodeId = `standalone-hidden-cert-${rec.id}`;
      const canvas = await renderCertificateToCanvas(nodeId);
      const pdf = await generatePdfFromCanvas(canvas);

      const typeStr = certType === "organizer" ? "Organizacao" : "Participacao";
      const cleanName = sanitizeFilename(rec.name || "Participante");
      const cleanTitle = sanitizeFilename(title || "Certificado");
      const fileName = `Certificado_${typeStr}_${cleanName}_${cleanTitle}.pdf`;

      pdf.save(fileName);
    } catch (err: any) {
      console.error("Erro ao baixar certificado individual:", err);
      alert(`Falha ao gerar o PDF: ${err?.message || "Tente novamente."}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // -------------------------------------------------------------
  // BAIXAR TODOS OS CERTIFICADOS EM ZIP
  // -------------------------------------------------------------
  const handleDownloadAllZip = async () => {
    if (isExportingZip || recipients.length === 0) return;

    setIsExportingZip(true);
    setZipProgress({
      current: 0,
      total: recipients.length,
      percentage: 0,
    });

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const cleanTitle = sanitizeFilename(title || "Certificados");
      const total = recipients.length;

      for (let i = 0; i < total; i++) {
        const rec = recipients[i];
        const stepNum = i + 1;
        const pct = Math.round(((stepNum - 0.5) / total) * 90);

        setZipProgress({
          current: stepNum,
          total,
          percentage: pct,
        });

        const nodeId = `standalone-hidden-cert-${rec.id}`;
        const canvas = await renderCertificateToCanvas(nodeId);
        const pdf = await generatePdfFromCanvas(canvas);

        const typeStr = certType === "organizer" ? "Organizacao" : "Participacao";
        const cleanName = sanitizeFilename(rec.name || `Participante_${stepNum}`);
        const fileName = `Certificado_${typeStr}_${cleanName}.pdf`;

        const pdfBlob = pdf.output("blob");
        zip.file(fileName, pdfBlob);
      }

      setZipProgress({
        current: total,
        total,
        percentage: 95,
      });

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificados_${cleanTitle}_${total}_unidades.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      console.error("Erro ao gerar ZIP de certificados:", err);
      alert(`Falha ao empacotar os certificados em ZIP: ${err?.message || "Tente novamente."}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  if (!isOpen) return null;

  const filteredRecipients = recipients.filter((r) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      (r.ra && r.ra.toLowerCase().includes(term)) ||
      (r.cpf && r.cpf.includes(term)) ||
      (r.certCode && r.certCode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[94vh] min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white leading-tight flex items-center gap-2">
                Emissão de Certificados Avulsos / Por Planilha
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                  Sem Evento Prévio
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gere certificados em lote ou avulsos. Alunos com conta no sistema recebem automaticamente; externos são baixados pelo administrador.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {step === "form" ? (
            <>
              {/* Seção 1: Dados da Atividade */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  1. Dados da Atividade / Curso
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Título da Atividade / Curso <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Curso de Extensão em Teologia Fundamental"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Tipo de Certificado
                    </label>
                    <select
                      value={certType}
                      onChange={(e) => setCertType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800 dark:text-slate-100"
                    >
                      <option value="participant">Participação</option>
                      <option value="organizer">Organização / Equipe</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Carga Horária (Horas)
                    </label>
                    <input
                      type="number"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="20"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Formato
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="Presencial">Presencial</option>
                      <option value="Online">Online</option>
                      <option value="Híbrido">Híbrido</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Data de Realização / Conclusão
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Local / Realização
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: Marília - SP"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Opções de Design e Assinaturas */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-4 items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Estilo de Fundo:</span>
                    <select
                      value={bgStyle}
                      onChange={(e) => setBgStyle(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="theme-classic">Clássico (Brasão FAJOPA)</option>
                      <option value="theme-gold">Dourado Nobre</option>
                      <option value="theme-modern">Moderno Azul</option>
                      <option value="theme-minimal">Minimalista Limpo</option>
                      <option value="custom-dark">Escuro / Solene</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showFajopaDirector}
                        onChange={(e) => setShowFajopaDirector(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      Diretor FAJOPA
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={showSeminarRector}
                        onChange={(e) => setShowSeminarRector(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      Reitor do Seminário
                    </label>
                  </div>

                  {/* Assinaturas & Signatários Adicionais */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                          Outras Assinaturas & Signatários ({customSignatures.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomSignature}
                        className="px-2.5 py-1 text-xs font-bold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Outra Assinatura
                      </button>
                    </div>

                    {customSignatures.length > 0 && (
                      <div className="space-y-2.5">
                        {customSignatures.map((sig, sIdx) => (
                          <div
                            key={sig.id}
                            className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`sa_sig_toggle_${sig.id}`}
                                  checked={sig.show !== false}
                                  onChange={(e) =>
                                    handleUpdateCustomSignature(sig.id, { show: e.target.checked })
                                  }
                                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer w-3.5 h-3.5"
                                />
                                <label
                                  htmlFor={`sa_sig_toggle_${sig.id}`}
                                  className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5"
                                >
                                  <span className="w-4 h-4 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-[10px] flex items-center justify-center font-bold">
                                    {sIdx + 1}
                                  </span>
                                  Signatário Adicional {sIdx + 1}
                                </label>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomSignature(sig.id)}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Nome do Signatário
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Prof. Dr. Carlos Menezes"
                                  value={sig.name || ""}
                                  onChange={(e) =>
                                    handleUpdateCustomSignature(sig.id, { name: e.target.value })
                                  }
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Cargo / Função
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: Coordenador de Curso / Palestrante"
                                  value={sig.role || ""}
                                  onChange={(e) =>
                                    handleUpdateCustomSignature(sig.id, { role: e.target.value })
                                  }
                                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                              {sig.signatureUrl ? (
                                <div className="flex items-center gap-3">
                                  <div className="h-7 w-20 bg-white rounded border border-slate-200 flex items-center justify-center p-0.5 shadow-xs">
                                    <img
                                      src={sig.signatureUrl}
                                      alt={sig.name}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                  <label className="text-[11px] text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
                                    <Upload className="w-3 h-3" /> Trocar
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept="image/*"
                                      onChange={(e) => handleUploadCustomSignature(e, sig.id)}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCustomSignature(sig.id, { signatureUrl: undefined })
                                    }
                                    className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                                  >
                                    Remover imagem
                                  </button>
                                </div>
                              ) : (
                                <label className="w-full py-1.5 px-2.5 border border-dashed border-sky-300 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-950/20 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors">
                                  <Upload className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                  <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                                    Anexar Assinatura Digitalizada (PNG/JPG)
                                  </span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleUploadCustomSignature(e, sig.id)}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção 2: Importação de Participantes */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      2. Importar ou Inserir Participantes
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      O sistema reconhecerá automaticamente se a pessoa já é aluna cadastrada.
                    </p>
                  </div>

                  {/* Tabs de entrada */}
                  <div className="flex bg-slate-200/80 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setInputMode("file")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        inputMode === "file"
                          ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" /> Planilha / Arquivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("paste")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        inputMode === "paste"
                          ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Colar Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("manual")}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        inputMode === "manual"
                          ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Manual
                    </button>
                  </div>
                </div>

                {/* Modo Planilha */}
                {inputMode === "file" && (
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-2xl p-6 text-center bg-white dark:bg-slate-900/60 transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Clique para selecionar ou arraste sua planilha
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Suporta arquivos Excel (.xlsx, .xls), CSV (.csv) e texto (.txt)
                    </p>
                    <label className="mt-3 inline-block px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
                      Procurar Arquivo
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Modo Colar Texto */}
                {inputMode === "paste" && (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Cole aqui a lista de nomes (um por linha)...&#10;Exemplo:&#10;João Silva dos Santos&#10;Maria Oliveira Costa&#10;Carlos Eduardo Souza"
                      className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-mono"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => processNamesText(pasteText)}
                        disabled={!pasteText.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Nomes à Lista
                      </button>
                    </div>
                  </div>
                )}

                {/* Modo Manual */}
                {inputMode === "manual" && (
                  <div className="flex flex-col sm:flex-row gap-2.5 items-end">
                    <div className="flex-1 space-y-1 w-full">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Nome Completo <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ex: Ana Clara Ribeiro"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="w-full sm:w-32 space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        RA (Opcional)
                      </label>
                      <input
                        type="text"
                        value={manualRa}
                        onChange={(e) => setManualRa(e.target.value)}
                        placeholder="Ex: 202401"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div className="w-full sm:w-36 space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        CPF (Opcional)
                      </label>
                      <input
                        type="text"
                        value={manualCpf}
                        onChange={(e) => setManualCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManual}
                      className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>
                )}
              </div>

              {/* Seção 3: Lista de Participantes Identificados */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Participantes Prontos para Emissão ({recipients.length})
                    </h3>
                  </div>

                  {recipients.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> {registeredCount} no Sistema (Minha ID)
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-lg flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5" /> {externalCount} Externos (Download Admin)
                      </span>
                    </div>
                  )}
                </div>

                {recipients.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white/60 dark:bg-slate-900/40">
                    Nenhum participante adicionado ainda. Faça upload da planilha ou digite os nomes acima.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {recipients.map((rec, idx) => (
                      <div
                        key={rec.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400 w-5">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {rec.name}
                            </p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-2">
                              {rec.ra && <span>RA: {rec.ra}</span>}
                              {rec.cpf && <span>CPF: {rec.cpf}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {rec.isRegistered ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Conta no Sistema
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              <UserX className="w-3 h-3" /> Participante Externo
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setPreviewRecipient(rec)}
                            title="Pré-visualizar certificado"
                            className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(rec.id)}
                            title="Remover"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* PASSO 2: RESULTADOS & DOWNLOADS */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500 text-white">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200 leading-tight">
                      Certificados Emitidos com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {registeredCount > 0 && (
                        <span>
                          {registeredCount} certificado(s) vinculado(s) à conta dos alunos (visível na Minha ID).{" "}
                        </span>
                      )}
                      {externalCount > 0 && (
                        <span>
                          {externalCount} certificado(s) de externos disponíveis para download abaixo.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadAllZip}
                  disabled={isExportingZip || recipients.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isExportingZip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Empacotando ZIP ({zipProgress.percentage}%)...</span>
                    </>
                  ) : (
                    <>
                      <FileArchive className="w-4 h-4" />
                      <span>Baixar Todos os Certificados (.ZIP)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Barra de Busca de Certificados Gerados */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filtrar por nome, RA ou código de autenticidade..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 shrink-0">
                  <span>Total: {recipients.length} certificados</span>
                </div>
              </div>

              {/* Tabela de Certificados Gerados */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecipients.map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                            {rec.name}
                          </h4>
                          {rec.isRegistered ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                              Vinculado à Conta
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                              Participante Externo
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                          {rec.ra && <span>RA: {rec.ra}</span>}
                          {rec.certCode && (
                            <span className="font-mono text-sky-600 dark:text-sky-400">
                              Código: {rec.certCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => setPreviewRecipient(rec)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Visualizar
                      </button>

                      <button
                        onClick={() => handleDownloadSingle(rec)}
                        disabled={downloadingId === rec.id}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {downloadingId === rec.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Gerando PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          {step === "form" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleGenerateCertificates}
                disabled={isProcessing || recipients.length === 0 || !title.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{processStatus || "Gerando..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar {recipients.length} Certificados</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Voltar à Edição
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE PRÉVIA INDIVIDUAL */}
      {previewRecipient && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                  Prévia: Certificado de {previewRecipient.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewRecipient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-slate-950/20 rounded-2xl my-2">
              <div
                style={{
                  width: 1122,
                  height: 793,
                  transform: "scale(0.55)",
                  transformOrigin: "center center",
                }}
                className="shrink-0"
              >
                <CertificateRenderer
                  id={`preview-standalone-cert-${previewRecipient.id}`}
                  event={activeEvent}
                  template={builtTemplate}
                  member={{
                    id: previewRecipient.matchedMember?.id || previewRecipient.id,
                    name: previewRecipient.name,
                    ra: previewRecipient.ra,
                    cpf: previewRecipient.cpf,
                    course: previewRecipient.matchedMember?.course || "",
                  } as Member}
                  isOrganizer={certType === "organizer"}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500">
                {previewRecipient.isRegistered
                  ? "✓ Este certificado ficará visível na conta do aluno."
                  : "ℹ Participante externo (disponível para download pelo administrador)."}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewRecipient(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Fechar
                </button>
                <button
                  onClick={() => handleDownloadSingle(previewRecipient)}
                  disabled={downloadingId === previewRecipient.id}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Este PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTAINER OCULTO DE ALTA DEFINIÇÃO PARA CAPTURA DE PDFS */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -10000,
          left: -10000,
          width: "1122px",
          height: "793px",
          pointerEvents: "none",
          opacity: 0,
          zIndex: -1,
        }}
      >
        {recipients.map((rec) => (
          <div
            key={rec.id}
            id={`standalone-hidden-cert-${rec.id}`}
            style={{ width: 1122, height: 793, position: "relative" }}
          >
            <CertificateRenderer
              id={`canvas-node-${rec.id}`}
              event={activeEvent}
              template={builtTemplate}
              member={{
                id: rec.matchedMember?.id || rec.id,
                name: rec.name,
                ra: rec.ra,
                cpf: rec.cpf,
                course: rec.matchedMember?.course || "",
              } as Member}
              isOrganizer={certType === "organizer"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
