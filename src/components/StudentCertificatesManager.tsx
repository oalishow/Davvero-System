import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { collection, query, getDocs, where, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import {
  Award,
  Download,
  Eye,
  FileArchive,
  Clock,
  Calendar,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  RotateCw,
  RotateCcw,
  Ban,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Copy,
  Check,
  FileText,
  ExternalLink,
  Sparkles,
  Trash2,
} from "lucide-react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { toCanvas } from "html-to-image";
import html2canvas from "html2canvas";
import { db, appId } from "../lib/firebase";
import { ASSETS_DOC_PATH } from "../lib/constants";
import { CertificateRenderer } from "./CertificateRenderer";
import {
  generateCertificateCode,
  isEventCertificateReleased,
  resolveCertificateReleaseDate,
  type CertificateRecord,
} from "../lib/certificateAuth";
import type { Member, Event, Attendance, CertificateTemplate } from "../types";

// Componente para carregar e hidratar templates e assinaturas do Firestore
const AsyncAdminCertificateRenderer = React.memo(
  ({
    event,
    member,
    isOrganizer,
    id,
  }: {
    event: Event;
    member: Partial<Member>;
    isOrganizer?: boolean;
    id?: string;
  }) => {
    const [template, setTemplate] = useState<CertificateTemplate>(() => {
      return (
        (isOrganizer
          ? event.organizationCertificateTemplate
          : event.certificateTemplate) || {
          bgStyle: "theme-classic",
          titleText: "CERTIFICADO",
          bodyText: "",
        }
      );
    });

    useEffect(() => {
      const initial =
        (isOrganizer
          ? event.organizationCertificateTemplate
          : event.certificateTemplate) || {
          bgStyle: "theme-classic",
          titleText: "CERTIFICADO",
          bodyText: "",
        };
      setTemplate(initial);

      let isMounted = true;
      const assetDocId = isOrganizer
        ? `cert_assets_org_${event.id}`
        : `cert_assets_${event.id}`;
      const docRef = doc(db, ASSETS_DOC_PATH(appId, assetDocId));

      getDoc(docRef)
        .then((snap) => {
          if (!isMounted || !snap.exists()) return;
          const snapData = snap.data();
          const assets = snapData?.data !== undefined ? snapData.data : snapData;
          if (assets) {
            setTemplate((prev) => ({
              ...prev,
              ...(assets.backgroundImageUrl && { backgroundImageUrl: assets.backgroundImageUrl }),
              ...(assets.logoUrl && { logoUrl: assets.logoUrl }),
              ...(assets.logo2Url && { logo2Url: assets.logo2Url }),
              ...(assets.fajopaDirectorSignatureUrl && {
                fajopaDirectorSignatureUrl: assets.fajopaDirectorSignatureUrl,
              }),
              ...(assets.seminarRectorSignatureUrl && {
                seminarRectorSignatureUrl: assets.seminarRectorSignatureUrl,
              }),
              ...(assets.signature1Url && { signature1Url: assets.signature1Url }),
              ...(assets.signature2Url && { signature2Url: assets.signature2Url }),
              ...(assets.signature3Url && { signature3Url: assets.signature3Url }),
            }));
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }, [event.id, isOrganizer, event.organizationCertificateTemplate, event.certificateTemplate]);

    return (
      <CertificateRenderer
        id={id}
        event={event}
        template={template}
        member={member}
        isOrganizer={isOrganizer}
      />
    );
  }
);

export interface StudentCertificateItem {
  id: string;
  key: string;
  title: string;
  type: "participant" | "organizer" | "external";
  event?: Event;
  dateText: string;
  releaseDateText: string;
  hours: number;
  certCode: string;
  formatText?: string;
  externalCert?: {
    id: string;
    title: string;
    fileUrl: string;
    uploadedAt: string;
  };
}

interface StudentCertificatesManagerProps {
  member: Member;
  onCountChange?: (count: number) => void;
}

export default function StudentCertificatesManager({
  member,
  onCountChange,
}: StudentCertificatesManagerProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [certRecords, setCertRecords] = useState<CertificateRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    "all" | "participant" | "organizer" | "external"
  >("all");

  // Estado de download individual
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Estado de download em ZIP
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{
    current: number;
    total: number;
    statusText: string;
    percentage: number;
  } | null>(null);

  // Estado de prévia do certificado
  const [previewCert, setPreviewCert] = useState<StudentCertificateItem | null>(
    null
  );
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // Estado de remoção/revogação de certificados pelo Administrador
  const [certToDelete, setCertToDelete] = useState<StudentCertificateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removedKeys, setRemovedKeys] = useState<string[]>(() => member.revokedCertKeys || []);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleDeleteCertificate = async () => {
    if (!certToDelete) return;
    setIsDeleting(true);
    try {
      const studentRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);

      // 1. Se for anexo externo
      if (certToDelete.type === "external" && certToDelete.externalCert) {
        const remainingExternal = (member.externalCertificates || []).filter(
          (ext) => ext.id !== certToDelete.externalCert?.id
        );
        await updateDoc(studentRef, {
          externalCertificates: remainingExternal,
          revokedCertKeys: arrayUnion(certToDelete.key),
        });
      } else {
        // 2. Certificado de participação ou organização
        await updateDoc(studentRef, {
          revokedCertificateCodes: arrayUnion(certToDelete.certCode),
          revokedCertKeys: arrayUnion(certToDelete.key),
        }).catch(console.warn);

        // Se tiver evento associado, atualiza o documento de presença correspondente
        if (certToDelete.event) {
          const eventId = certToDelete.event.id;
          const matchingAtt = attendances.find(
            (a) => a.eventId === eventId && (a.studentId === member.id || a.studentId === member.alphaCode)
          );
          if (matchingAtt) {
            const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, matchingAtt.id);
            if (certToDelete.type === "participant") {
              await updateDoc(attRef, {
                revokedParticipantCert: true,
                status: "inscrito",
              }).catch(console.warn);
            } else if (certToDelete.type === "organizer") {
              await updateDoc(attRef, {
                revokedOrgCert: true,
                isOrganizer: false,
              }).catch(console.warn);
            }
          }
        }

        // Deleta registro na coleção de certificados emitidos se existir
        const certsCol = collection(db, `artifacts/${appId}/public/data/certificates`);
        const certSnap = await getDocs(
          query(certsCol, where("code", "==", certToDelete.certCode))
        ).catch(() => null);
        if (certSnap && !certSnap.empty) {
          for (const d of certSnap.docs) {
            await deleteDoc(d.ref).catch(console.warn);
          }
        }
      }

      setRemovedKeys((prev) => [...prev, certToDelete.key]);
      setActionFeedback({
        type: "success",
        message: `Certificado "${certToDelete.title}" foi removido do aluno com sucesso!`,
      });
      setCertToDelete(null);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error("Erro ao remover certificado:", err);
      setActionFeedback({
        type: "error",
        message: "Falha ao remover o certificado. Tente novamente.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreCertificate = async (cert: StudentCertificateItem) => {
    setIsDeleting(true);
    try {
      const studentRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
      await updateDoc(studentRef, {
        revokedCertificateCodes: arrayRemove(cert.certCode),
        revokedCertKeys: arrayRemove(cert.key),
      }).catch(console.warn);

      if (cert.event) {
        const eventId = cert.event.id;
        const matchingAtt = attendances.find(
          (a) => a.eventId === eventId && (a.studentId === member.id || a.studentId === member.alphaCode)
        );
        if (matchingAtt) {
          const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, matchingAtt.id);
          if (cert.type === "participant") {
            await updateDoc(attRef, {
              revokedParticipantCert: false,
              status: "presente",
            }).catch(console.warn);
          } else if (cert.type === "organizer") {
            await updateDoc(attRef, {
              revokedOrgCert: false,
              isOrganizer: true,
            }).catch(console.warn);
          }
        }
      }

      setRemovedKeys((prev) => prev.filter((k) => k !== cert.key));
      setActionFeedback({
        type: "success",
        message: `Certificado "${cert.title}" restaurado com sucesso!`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      console.error("Erro ao restaurar certificado:", err);
      setActionFeedback({
        type: "error",
        message: "Falha ao restaurar o certificado. Tente novamente.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // CARREGAR DADOS DO ALUNO NO FIRESTORE
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadStudentCertData() {
      setLoading(true);
      try {
        const eventsCol = collection(db, `artifacts/${appId}/public/data/events`);
        const attendancesCol = collection(
          db,
          `artifacts/${appId}/public/data/attendances`
        );
        const certsCol = collection(
          db,
          `artifacts/${appId}/public/data/certificates`
        );

        // Dispara buscas paralelas
        const tasks: Promise<any>[] = [
          getDocs(query(eventsCol)).catch(() => null),
          getDocs(query(attendancesCol, where("studentId", "==", member.id))).catch(
            () => null
          ),
          member.alphaCode
            ? getDocs(
                query(attendancesCol, where("studentId", "==", member.alphaCode))
              ).catch(() => null)
            : Promise.resolve(null),
          member.ra
            ? getDocs(query(attendancesCol, where("memberRa", "==", member.ra))).catch(
                () => null
              )
            : Promise.resolve(null),
          member.cpf
            ? getDocs(
                query(attendancesCol, where("studentCpf", "==", member.cpf))
              ).catch(() => null)
            : Promise.resolve(null),
          // Certificados registrados
          getDocs(query(certsCol, where("studentId", "==", member.id))).catch(
            () => null
          ),
          member.ra
            ? getDocs(query(certsCol, where("memberRa", "==", member.ra))).catch(
                () => null
              )
            : Promise.resolve(null),
        ];

        const [
          eventsSnap,
          attByIdSnap,
          attByAlphaSnap,
          attByRaSnap,
          attByCpfSnap,
          certsByIdSnap,
          certsByRaSnap,
        ] = await Promise.all(tasks);

        if (!isMounted) return;

        // Processar Eventos
        const loadedEvents: Event[] = [];
        if (eventsSnap && !eventsSnap.empty) {
          eventsSnap.forEach((doc: any) => {
            if (!doc.id.startsWith("_")) {
              loadedEvents.push({ id: doc.id, ...doc.data() } as Event);
            }
          });
        }
        setEvents(loadedEvents);

        // Processar Presenças
        const attMap = new Map<string, Attendance>();
        const attSnaps = [
          attByIdSnap,
          attByAlphaSnap,
          attByRaSnap,
          attByCpfSnap,
        ];
        attSnaps.forEach((snap) => {
          if (snap && !snap.empty) {
            snap.forEach((doc: any) => {
              const data = { id: doc.id, ...doc.data() } as Attendance;
              // Chave de unicidade: eventId + (isOrganizer ? '_org' : '_part')
              const key = `${data.eventId}_${Boolean(data.isOrganizer)}`;
              if (!attMap.has(key)) {
                attMap.set(key, data);
              }
            });
          }
        });
        setAttendances(Array.from(attMap.values()));

        // Processar Certificados Registrados
        const certMap = new Map<string, CertificateRecord>();
        [certsByIdSnap, certsByRaSnap].forEach((snap) => {
          if (snap && !snap.empty) {
            snap.forEach((doc: any) => {
              const data = doc.data() as CertificateRecord;
              if (data.code && !certMap.has(data.code)) {
                certMap.set(data.code, data);
              }
            });
          }
        });
        setCertRecords(Array.from(certMap.values()));
      } catch (err) {
        console.error("Erro ao carregar dados de certificados do aluno:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStudentCertData();
    return () => {
      isMounted = false;
    };
  }, [member.id, member.alphaCode, member.ra, member.cpf]);

  // -------------------------------------------------------------
  // RESOLVER TODOS OS CERTIFICADOS DO ALUNO (ATIVOS E REVOGADOS)
  // -------------------------------------------------------------
  const { allCertificates, revokedCertificates } = useMemo(() => {
    const list: StudentCertificateItem[] = [];
    const revokedList: StudentCertificateItem[] = [];
    const eventMap = new Map<string, Event>();
    events.forEach((ev) => eventMap.set(ev.id, ev));

    const isRevoked = (key: string, code?: string) => {
      if (removedKeys.includes(key)) return true;
      if (member.revokedCertKeys?.includes(key)) return true;
      if (code && member.revokedCertificateCodes?.includes(code)) return true;
      return false;
    };

    // 1. Processar presença nos eventos
    attendances.forEach((att) => {
      const ev = eventMap.get(att.eventId);
      if (!ev) return;

      const isReleased =
        ev.status === "encerrado" ||
        isEventCertificateReleased(ev) ||
        (ev as any).isCertificateReleased === true;

      const isEligible =
        (att.status === "presente" ||
        att.status === "apto_para_certificado" ||
        Boolean(ev.allowAllRegisteredCertificates)) &&
        !att.revokedParticipantCert;

      const startObj = new Date(ev.startDate);
      const endObj = ev.endDate ? new Date(ev.endDate) : startObj;
      const startStr = !isNaN(startObj.getTime())
        ? startObj.toLocaleDateString("pt-BR")
        : "";
      const endStr = !isNaN(endObj.getTime())
        ? endObj.toLocaleDateString("pt-BR")
        : startStr;
      const dateText = startStr === endStr ? startStr : `${startStr} a ${endStr}`;
      const formatText =
        ev.format === "online"
          ? "Online"
          : ev.format === "hibrido"
          ? "Híbrido"
          : "Presencial";

      const releaseInfo = resolveCertificateReleaseDate(ev, undefined, member);

      // Certificado de Participação
      const partKey = `${ev.id}_participant`;
      const partCode = generateCertificateCode(ev, member, false);
      const isPartRevoked = isRevoked(partKey, partCode) || att.revokedParticipantCert;
      if (isReleased && (isEligible || isPartRevoked)) {
        const hours = Number(ev.hours) || 0;
        const certItem: StudentCertificateItem = {
          id: partKey,
          key: partKey,
          title: ev.title || "Evento Acadêmico",
          type: "participant",
          event: ev,
          dateText,
          releaseDateText: releaseInfo.formattedDate,
          hours,
          certCode: partCode,
          formatText,
        };
        if (isPartRevoked) {
          revokedList.push(certItem);
        } else {
          list.push(certItem);
        }
      }

      // Certificado de Organização
      const orgKey = `${ev.id}_organizer`;
      const orgCode = generateCertificateCode(ev, member, true);
      const isOrgRevoked = isRevoked(orgKey, orgCode) || att.revokedOrgCert;
      if (isReleased && att.isOrganizer === true) {
        const hours =
          Number(ev.organizationHours) || Number(ev.hours) || 0;
        const orgItem: StudentCertificateItem = {
          id: orgKey,
          key: orgKey,
          title: ev.title || "Evento Acadêmico",
          type: "organizer",
          event: ev,
          dateText,
          releaseDateText: releaseInfo.formattedDate,
          hours,
          certCode: orgCode,
          formatText,
        };
        if (isOrgRevoked) {
          revokedList.push(orgItem);
        } else {
          list.push(orgItem);
        }
      }
    });

    // 2. Verificar se há registros na coleção de certificados não capturados acima
    certRecords.forEach((record) => {
      const recKey = `${record.eventId}_${record.isOrganizer ? "organizer" : "participant"}`;
      const isRecRevoked = isRevoked(recKey, record.code) || (record as any).revoked;

      const alreadyExists = list.some(
        (item) => item.certCode === record.code || (item.event && item.event.id === record.eventId && (item.type === "organizer") === record.isOrganizer)
      ) || revokedList.some(
        (item) => item.certCode === record.code || (item.event && item.event.id === record.eventId && (item.type === "organizer") === record.isOrganizer)
      );

      if (!alreadyExists) {
        const ev = eventMap.get(record.eventId);
        if (ev) {
          const startObj = new Date(ev.startDate);
          const endObj = ev.endDate ? new Date(ev.endDate) : startObj;
          const startStr = !isNaN(startObj.getTime())
            ? startObj.toLocaleDateString("pt-BR")
            : "";
          const endStr = !isNaN(endObj.getTime())
            ? endObj.toLocaleDateString("pt-BR")
            : startStr;
          const dateText = startStr === endStr ? startStr : `${startStr} a ${endStr}`;
          const releaseInfo = resolveCertificateReleaseDate(ev, undefined, member);

          const item: StudentCertificateItem = {
            id: `${ev.id}_${record.isOrganizer ? "organizer" : "participant"}_record`,
            key: recKey,
            title: record.eventTitle || ev.title || "Evento Acadêmico",
            type: record.isOrganizer ? "organizer" : "participant",
            event: ev,
            dateText,
            releaseDateText: releaseInfo.formattedDate,
            hours: record.hours || Number(ev.hours) || 0,
            certCode: record.code,
            formatText: ev.format,
          };

          if (isRecRevoked) {
            revokedList.push(item);
          } else {
            list.push(item);
          }
        }
      }
    });

    // 3. Incluir certificados externos anexados
    if (member.externalCertificates && Array.isArray(member.externalCertificates)) {
      member.externalCertificates.forEach((ext) => {
        const extKey = `ext_${ext.id}`;
        const isExtRevoked = isRevoked(extKey);

        const extItem: StudentCertificateItem = {
          id: extKey,
          key: extKey,
          title: ext.title || "Certificado Externo Anexado",
          type: "external",
          dateText: ext.uploadedAt
            ? new Date(ext.uploadedAt).toLocaleDateString("pt-BR")
            : "Anexo",
          releaseDateText: ext.uploadedAt
            ? new Date(ext.uploadedAt).toLocaleDateString("pt-BR")
            : "Anexo",
          hours: 0,
          certCode: `EXT-${ext.id.substring(0, 8).toUpperCase()}`,
          externalCert: ext,
        };

        if (isExtRevoked) {
          revokedList.push(extItem);
        } else {
          list.push(extItem);
        }
      });
    }

    return { allCertificates: list, revokedCertificates: revokedList };
  }, [events, attendances, certRecords, member, removedKeys]);

  // Atualizar contagem no componente pai
  useEffect(() => {
    onCountChange?.(allCertificates.length);
  }, [allCertificates.length, onCountChange]);

  // -------------------------------------------------------------
  // FILTRAGEM E BUSCA
  // -------------------------------------------------------------
  const filteredCertificates = useMemo(() => {
    return allCertificates.filter((cert) => {
      // Filtro de tipo
      if (selectedTypeFilter !== "all" && cert.type !== selectedTypeFilter) {
        return false;
      }
      // Busca textual
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = cert.title.toLowerCase().includes(query);
        const matchCode = cert.certCode.toLowerCase().includes(query);
        const matchDate = cert.dateText.toLowerCase().includes(query);
        return matchTitle || matchCode || matchDate;
      }
      return true;
    });
  }, [allCertificates, selectedTypeFilter, searchTerm]);

  // Carga horária total
  const totalHours = useMemo(() => {
    return allCertificates.reduce((acc, curr) => acc + (curr.hours || 0), 0);
  }, [allCertificates]);

  // -------------------------------------------------------------
  // UTILITÁRIO: CAPTURAR NÓ DO CERTIFICADO E GERAR CANVAS EM ALTA RESOLUÇÃO
  // -------------------------------------------------------------
  const renderCertificateToCanvas = async (nodeId: string): Promise<HTMLCanvasElement> => {
    const node = document.getElementById(nodeId);
    if (!node) {
      throw new Error(`Elemento de renderização do certificado não encontrado (#${nodeId})`);
    }

    // 1. Garantir que todas as imagens (logos, assinaturas, selos, molduras) estejam decodificadas
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

    // 2. Garantir renderização de fontes
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 160));

    // 3. Captura com toCanvas (ou html2canvas como fallback)
    try {
      const canvas = await toCanvas(node, {
        pixelRatio: 2.2,
        skipFonts: false,
        cacheBust: true,
      });
      return canvas;
    } catch (errCanvas) {
      console.warn("toCanvas falhou, usando html2canvas:", errCanvas);
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

  // -------------------------------------------------------------
  // UTILITÁRIO: GERAR PDF VIA jsPDF
  // -------------------------------------------------------------
  const generatePdfFromCanvas = (canvas: HTMLCanvasElement): jsPDF => {
    const imgData = canvas.toDataURL("image/jpeg", 0.96);
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    // A4 Paisagem: 297mm x 210mm
    pdf.addImage(imgData, "JPEG", 0, 0, 297, 210, undefined, "FAST");
    return pdf;
  };

  const sanitizeFilename = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60);
  };

  // -------------------------------------------------------------
  // BAIXAR UM POR UM (PDF OU ANEXO)
  // -------------------------------------------------------------
  const handleDownloadSingle = async (cert: StudentCertificateItem) => {
    if (downloadingKey) return;
    setDownloadingKey(cert.key);

    try {
      if (cert.type === "external" && cert.externalCert) {
        // Download de certificado externo anexado
        const fileUrl = cert.externalCert.fileUrl;
        if (!fileUrl) throw new Error("Link do certificado não disponível.");

        const cleanTitle = sanitizeFilename(cert.title);
        if (fileUrl.startsWith("data:")) {
          const a = document.createElement("a");
          a.href = fileUrl;
          a.download = `${cleanTitle}.pdf`;
          a.click();
        } else {
          // Busca o blob ou abre link direto
          try {
            const resp = await fetch(fileUrl);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${cleanTitle}.pdf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } catch {
            window.open(fileUrl, "_blank");
          }
        }
        return;
      }

      // Certificado oficial de evento
      const nodeId = `admin-cert-node-${cert.key}`;
      const canvas = await renderCertificateToCanvas(nodeId);
      const pdf = generatePdfFromCanvas(canvas);

      const typeStr = cert.type === "organizer" ? "Organizacao" : "Participacao";
      const studentStr = sanitizeFilename(member.name || "Aluno");
      const eventStr = sanitizeFilename(cert.title || "Evento");
      const fileName = `Certificado_${typeStr}_${studentStr}_${eventStr}.pdf`;

      pdf.save(fileName);
    } catch (err: any) {
      console.error("Erro ao descarregar certificado:", err);
      alert(`Falha ao gerar o certificado: ${err?.message || "Tente novamente."}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  // -------------------------------------------------------------
  // BAIXAR TODOS EM ZIP
  // -------------------------------------------------------------
  const handleDownloadAllZip = async () => {
    if (isExportingZip || allCertificates.length === 0) return;

    setIsExportingZip(true);
    setZipProgress({
      current: 0,
      total: allCertificates.length,
      statusText: "Iniciando empacotamento...",
      percentage: 0,
    });

    try {
      const zip = new JSZip();
      const studentStr = sanitizeFilename(member.name || "Aluno");
      const total = allCertificates.length;

      for (let i = 0; i < total; i++) {
        const cert = allCertificates[i];
        const stepNum = i + 1;
        const pct = Math.round(((stepNum - 0.5) / total) * 90);

        setZipProgress({
          current: stepNum,
          total,
          statusText: `Gerando certificado ${stepNum} de ${total}: "${cert.title}"...`,
          percentage: pct,
        });

        const typeStr =
          cert.type === "organizer"
            ? "Organizacao"
            : cert.type === "external"
            ? "Anexo"
            : "Participacao";
        const eventStr = sanitizeFilename(cert.title);
        const fileName = `${stepNum.toString().padStart(2, "0")}_Certificado_${typeStr}_${eventStr}.pdf`;

        if (cert.type === "external" && cert.externalCert) {
          // Processar anexo externo
          const fileUrl = cert.externalCert.fileUrl;
          if (fileUrl) {
            try {
              if (fileUrl.startsWith("data:")) {
                const base64Data = fileUrl.split(",")[1];
                zip.file(fileName, base64Data, { base64: true });
              } else {
                const resp = await fetch(fileUrl);
                const blob = await resp.blob();
                zip.file(fileName, blob);
              }
            } catch (extErr) {
              console.warn("Falha ao incluir anexo externo no zip:", extErr);
            }
          }
        } else {
          // Processar certificado oficial do evento
          const nodeId = `admin-cert-node-${cert.key}`;
          const canvas = await renderCertificateToCanvas(nodeId);
          const pdf = generatePdfFromCanvas(canvas);
          const pdfBlob = pdf.output("blob");
          zip.file(fileName, pdfBlob);
        }

        // Breve pausa para não travar a renderização do browser
        await new Promise((r) => setTimeout(r, 80));
      }

      setZipProgress({
        current: total,
        total,
        statusText: "Compactando arquivo ZIP final...",
        percentage: 95,
      });

      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          setZipProgress({
            current: total,
            total,
            statusText: `Comprimindo arquivos: ${metadata.percent.toFixed(0)}%...`,
            percentage: 90 + Math.round(metadata.percent * 0.1),
          });
        }
      );

      setZipProgress({
        current: total,
        total,
        statusText: "Download concluído!",
        percentage: 100,
      });

      // Baixar o arquivo ZIP
      const nowFormatted = new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-");
      const zipFileName = `Certificados_${studentStr}_${nowFormatted}.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 15000);
    } catch (err: any) {
      console.error("Erro ao gerar arquivo ZIP de certificados:", err);
      alert(
        `Erro durante a criação do arquivo ZIP: ${
          err?.message || "Ocorreu uma falha."
        }`
      );
    } finally {
      setTimeout(() => {
        setIsExportingZip(false);
        setZipProgress(null);
      }, 1200);
    }
  };

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Notificação de Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO DO PAINEL DE CERTIFICADOS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-8 -translate-y-4">
          <Award className="w-48 h-48 text-white" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md bg-white/20 text-sky-100 text-[10px] font-black uppercase tracking-wider">
              Gestão Acadêmica
            </span>
            <span className="text-xs text-sky-200/80 font-medium">
              {member.name}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Certificados do Aluno
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Visualize, descarregue individualmente em PDF ou baixe todos os
            documentos compactados em um arquivo ZIP.
          </p>
        </div>

        <div className="relative z-10 w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleDownloadAllZip}
            disabled={isExportingZip || loading || allCertificates.length === 0}
            className={`btn-modern py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              allCertificates.length === 0 || loading
                ? "bg-slate-700/60 text-slate-400 cursor-not-allowed"
                : isExportingZip
                ? "bg-amber-500 text-white animate-pulse"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-emerald-500/20 active:scale-95"
            }`}
            title="Gera todos os PDFs dos certificados e compacta em um único arquivo ZIP"
          >
            {isExportingZip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{zipProgress?.statusText || "Gerando ZIP..."}</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>Baixar Todos em ZIP ({allCertificates.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA DE PROGRESSO DO ZIP */}
      {/* ------------------------------------------------------------- */}
      {isExportingZip && zipProgress && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl shadow-sm space-y-2 animated-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>{zipProgress.statusText}</span>
            </div>
            <span className="font-mono text-xs">{zipProgress.percentage}%</span>
          </div>
          <div className="w-full bg-amber-200/60 dark:bg-amber-900/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${zipProgress.percentage}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
            Por favor, aguarde enquanto todos os certificados oficiais são
            gerados em alta definição e empacotados no arquivo .ZIP.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ESTATÍSTICAS E FILTROS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Total Disponível
          </p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
            {allCertificates.length}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Horas Acadêmicas
          </p>
          <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
            {totalHours}h
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Participações
          </p>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
            {allCertificates.filter((c) => c.type === "participant").length}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Organizações
          </p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {allCertificates.filter((c) => c.type === "organizer").length}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA DE FILTRO E PESQUISA */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por evento ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-modern w-full rounded-xl pl-9 pr-3 py-2 text-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedTypeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedTypeFilter === "all"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Todos ({allCertificates.length})
          </button>
          <button
            onClick={() => setSelectedTypeFilter("participant")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedTypeFilter === "participant"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Participante
          </button>
          <button
            onClick={() => setSelectedTypeFilter("organizer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedTypeFilter === "organizer"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Organizador
          </button>
          {allCertificates.some((c) => c.type === "external") && (
            <button
              onClick={() => setSelectedTypeFilter("external")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedTypeFilter === "external"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Anexados
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LISTA DE CERTIFICADOS */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="bg-slate-50 dark:bg-slate-900/30 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-xs font-bold uppercase tracking-wider">
            Localizando certificados acadêmicos...
          </p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/30 p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
          <Award className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum certificado encontrado
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedTypeFilter !== "all"
              ? "Nenhum certificado corresponde aos filtros aplicados."
              : "Este aluno ainda não possui certificados liberados em eventos encerrados ou anexados externamente."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCertificates.map((cert) => {
            const isOrganizer = cert.type === "organizer";
            const isExternal = cert.type === "external";
            const isDownloading = downloadingKey === cert.key;

            return (
              <div
                key={cert.key}
                className="bg-white dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                {/* Detalhes do Certificado */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isExternal ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        📎 Certificado Anexado
                      </span>
                    ) : isOrganizer ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        ⭐ Organizador
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        🎓 Participante
                      </span>
                    )}

                    {cert.hours > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {cert.hours} horas
                      </span>
                    )}

                    {cert.formatText && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                        {cert.formatText}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-snug">
                      {cert.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {cert.dateText}
                      </span>
                      {cert.releaseDateText && (
                        <span className="text-[11px] text-slate-400">
                          (Liberado: {cert.releaseDateText})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Código de Autenticidade */}
                  {cert.certCode && (
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{cert.certCode}</span>
                      <button
                        onClick={() => copyCode(cert.certCode, cert.key)}
                        className="ml-1 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Copiar Código"
                      >
                        {copiedCodeKey === cert.key ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Ações do Certificado */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/60">
                  {cert.event && (
                    <button
                      onClick={() => setPreviewCert(cert)}
                      className="btn-modern flex-1 sm:flex-none py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Visualizar documento"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadSingle(cert)}
                    disabled={isDownloading || isExportingZip}
                    className={`btn-modern flex-1 sm:flex-none py-2 px-3.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDownloading
                        ? "bg-sky-400 text-white cursor-wait"
                        : isOrganizer
                        ? "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20 active:scale-95"
                        : "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20 active:scale-95"
                    }`}
                    title={
                      isExternal
                        ? "Baixar arquivo do anexo"
                        : "Baixar este certificado em formato PDF"
                    }
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setCertToDelete(cert)}
                    className="btn-modern py-2 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    title="Remover este certificado do aluno (Revogação administrativa)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remover</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CERTIFICADOS REVOGADOS / REMOVIDOS */}
      {/* ------------------------------------------------------------- */}
      {revokedCertificates.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-500" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Certificados Removidos / Revogados ({revokedCertificates.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              O aluno não tem acesso no portal a estes certificados
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {revokedCertificates.map((cert) => (
              <div
                key={cert.key}
                className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> Revogado
                    </span>
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
                      {cert.title}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span>{cert.dateText}</span>
                    {cert.certCode && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{cert.certCode}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{cert.type === "organizer" ? "Organizador" : "Participante"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleRestoreCertificate(cert)}
                    className="btn-modern py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="Restaurar este certificado para o aluno"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Restaurar Certificado</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE CERTIFICADO */}
      {/* ------------------------------------------------------------- */}
      {certToDelete && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Remover Certificado?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ação administrativa de revogação
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Aluno:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Certificado:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{certToDelete.title}</p>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700/50">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Tipo:</span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {certToDelete.type === "participant" ? "Participante" : certToDelete.type === "organizer" ? "Organizador" : "Anexo Externo"}
                </span>
              </div>
              {certToDelete.certCode && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Código:</span>
                  <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{certToDelete.certCode}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tem certeza de que deseja remover este certificado de <strong>{member.name}</strong>? Ele deixará de aparecer no cadastro e não estará mais disponível para download no portal do aluno.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCertToDelete(null)}
                className="btn-modern flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCertificate}
                className="btn-modern flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Remover</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTAINER OCULTO DE RENDERIZAÇÃO (OFF-SCREEN) */}
      {/* ------------------------------------------------------------- */}
      <div
        aria-hidden="true"
        className="fixed -left-[99999px] top-0 pointer-events-none opacity-0 select-none overflow-hidden"
        style={{ width: "1122px", height: "auto" }}
      >
        {allCertificates.map((item) => {
          if (!item.event) return null;
          return (
            <div
              key={item.key}
              id={`admin-cert-node-${item.key}`}
              style={{ width: "1122px", height: "793px" }}
            >
              <AsyncAdminCertificateRenderer
                event={item.event}
                member={member}
                isOrganizer={item.type === "organizer"}
              />
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE PRÉ-VISUALIZAÇÃO COMPLETA DO CERTIFICADO */}
      {/* ------------------------------------------------------------- */}
      {previewCert && previewCert.event && (
        <CertificateAdminPreviewModal
          cert={previewCert}
          member={member}
          onClose={() => setPreviewCert(null)}
          onDownload={() => handleDownloadSingle(previewCert)}
          isDownloading={downloadingKey === previewCert.key}
        />
      )}
    </div>
  );
}

// =====================================================================
// SUB-COMPONENTE: MODAL DE PRÉVIA DO CERTIFICADO COM CONTROLES DE ZOOM/TELA
// =====================================================================
interface CertificateAdminPreviewModalProps {
  cert: StudentCertificateItem;
  member: Member;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

function CertificateAdminPreviewModal({
  cert,
  member,
  onClose,
  onDownload,
  isDownloading,
}: CertificateAdminPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(380);
  const [mode, setMode] = useState<"fit" | "zoom" | "rotate">("fit");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const CERT_W = 1122;
  const CERT_H = 793;

  const fitScale = useMemo(() => {
    const avail = Math.max(260, containerWidth - 24);
    return Math.min(0.95, Math.max(0.18, avail / CERT_W));
  }, [containerWidth]);

  const rotateScale = useMemo(() => {
    const avail = Math.max(260, containerWidth - 24);
    return Math.min(1.05, Math.max(0.24, avail / CERT_H));
  }, [containerWidth]);

  const activeScale = useMemo(() => {
    if (mode === "fit") return fitScale;
    if (mode === "rotate") return rotateScale;
    return Math.min(1.3, Math.max(0.55, fitScale * 2.2 * zoomLevel));
  }, [mode, fitScale, rotateScale, zoomLevel]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[96vh]">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight">
                Prévia do Certificado (
                {cert.type === "organizer" ? "Organização" : "Participação"})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px] sm:max-w-md">
                {cert.title} • {member.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-base cursor-pointer"
            title="Fechar Prévia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ferramentas de Visualização */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setMode("fit");
                setZoomLevel(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "fit"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ajustar à Tela
            </button>

            <button
              onClick={() => {
                setMode("rotate");
                setZoomLevel(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "rotate"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Girar Vertical
            </button>

            <button
              onClick={() => setMode("zoom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "zoom"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Zoom
            </button>
          </div>

          {mode === "zoom" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 text-slate-500">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Viewport do Certificado */}
        <div
          ref={containerRef}
          className="flex-1 w-full bg-slate-100 dark:bg-slate-950/80 rounded-2xl p-2 sm:p-4 overflow-auto flex items-center justify-center min-h-[300px] sm:min-h-[420px] max-h-[65vh] border border-slate-200/60 dark:border-slate-800"
        >
          {cert.event && (
            <div
              style={{
                width: mode === "rotate" ? `${CERT_H * activeScale}px` : `${CERT_W * activeScale}px`,
                height: mode === "rotate" ? `${CERT_W * activeScale}px` : `${CERT_H * activeScale}px`,
                transformOrigin: "top left",
              }}
              className="relative transition-transform duration-200 shadow-xl rounded-lg overflow-hidden bg-white"
            >
              <div
                style={{
                  transform:
                    mode === "rotate"
                      ? `scale(${activeScale}) rotate(90deg) translate(0px, -${CERT_H}px)`
                      : `scale(${activeScale})`,
                  transformOrigin: "top left",
                  width: `${CERT_W}px`,
                  height: `${CERT_H}px`,
                }}
              >
                <AsyncAdminCertificateRenderer
                  event={cert.event}
                  member={member}
                  isOrganizer={cert.type === "organizer"}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé da Prévia */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Código: {cert.certCode}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-modern px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
            >
              Fechar
            </button>
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="btn-modern px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 flex items-center gap-1.5"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar este Certificado (PDF)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
