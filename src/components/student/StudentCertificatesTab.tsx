import React from "react";
import { motion } from "motion/react";
import {
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Download,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Event, Member, Attendance } from "../../types";
import {
  isEventCertificateReleased,
  resolveCertificateReleaseDate,
} from "../../lib/certificateAuth";

export interface ExternalCertItem {
  id: string;
  title: string;
  fileUrl: string;
  uploadedAt: string;
}

interface StudentCertificatesTabProps {
  member: Member;
  settings: any;
  allEvents: Event[];
  myAttendances: Attendance[];
  certSearchTerm: string;
  setCertSearchTerm: (val: string) => void;
  certSemesterFilter: string;
  setCertSemesterFilter: (val: string) => void;
  certTypeFilter: string;
  setCertTypeFilter: (val: string) => void;
  downloadingCertKey: string | null;
  handleDownloadCertificate: (
    event: Event,
    type: "participant" | "organizer"
  ) => void;
  setPreviewCertEvent: (
    val: { event: Event; type: "participant" | "organizer" } | null
  ) => void;
  handleDownloadExternalCertificate: (cert: ExternalCertItem) => void;
  handleOpenExternalCertificate: (cert: ExternalCertItem) => void;
  handleDeleteExternalCertificate: (certId: string) => void;
  handleUploadExternalCertificate: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  isUploadingCert: boolean;
  formatDateTime: (dateStr: string | undefined) => string;
}

export const StudentCertificatesTab: React.FC<StudentCertificatesTabProps> = ({
  member,
  settings,
  allEvents,
  myAttendances,
  certSearchTerm,
  setCertSearchTerm,
  certSemesterFilter,
  setCertSemesterFilter,
  certTypeFilter,
  setCertTypeFilter,
  downloadingCertKey,
  handleDownloadCertificate,
  setPreviewCertEvent,
  handleDownloadExternalCertificate,
  handleOpenExternalCertificate,
  handleDeleteExternalCertificate,
  handleUploadExternalCertificate,
  isUploadingCert,
  formatDateTime,
}) => {
  const eligibleEvents = allEvents.filter((e) => {
    const attendance = myAttendances.find((a) => a.eventId === e.id);
    if (!attendance) return false;
    const isReleased =
      e.status === "encerrado" ||
      isEventCertificateReleased(e) ||
      e.isCertificateReleased === true;
    const isEligible =
      attendance.status === "presente" ||
      attendance.status === "apto_para_certificado" ||
      e.allowAllRegisteredCertificates;
    const isPartRevoked =
      attendance.revokedParticipantCert === true ||
      (member as any).revokedCertKeys?.includes(`${e.id}_participant`);
    const isOrgRevoked =
      attendance.revokedOrgCert === true ||
      (member as any).revokedCertKeys?.includes(`${e.id}_organizer`);
    const hasPartCert = isReleased && isEligible && !isPartRevoked;
    const hasOrgCert =
      isReleased && attendance.isOrganizer === true && !isOrgRevoked;
    return hasPartCert || hasOrgCert;
  });

  const getSemesterInfo = (ev: Event) => {
    const dateStr = ev.startDate || ev.createdAt;
    const d = dateStr ? new Date(dateStr) : new Date();
    const year = isNaN(d.getFullYear())
      ? new Date().getFullYear()
      : d.getFullYear();
    const month = isNaN(d.getMonth()) ? 1 : d.getMonth() + 1;
    const semNum = month <= 6 ? 1 : 2;
    return {
      key: `${year}.${semNum}`,
      label: `${year}.${semNum} (${semNum}º Semestre de ${year})`,
      year,
      semNum,
    };
  };

  // Obter lista única de semestres disponíveis
  const semesterMap = new Map<
    string,
    { key: string; label: string; year: number; semNum: number; count: number }
  >();
  eligibleEvents.forEach((e) => {
    const info = getSemesterInfo(e);
    const existing = semesterMap.get(info.key);
    if (existing) {
      existing.count++;
    } else {
      semesterMap.set(info.key, { ...info, count: 1 });
    }
  });

  const availableSemesters = Array.from(semesterMap.values()).sort((a, b) =>
    b.key.localeCompare(a.key)
  );

  // Filtrar por busca, tipo e semestre
  const filteredEvents = eligibleEvents.filter((e) => {
    const semInfo = getSemesterInfo(e);
    if (certSemesterFilter !== "all" && semInfo.key !== certSemesterFilter) {
      return false;
    }

    const attendance = myAttendances.find((a) => a.eventId === e.id);
    const isReleased =
      e.status === "encerrado" ||
      isEventCertificateReleased(e) ||
      e.isCertificateReleased === true;
    const isEligible =
      attendance?.status === "presente" ||
      attendance?.status === "apto_para_certificado" ||
      e.allowAllRegisteredCertificates;
    const isPartRevoked =
      attendance?.revokedParticipantCert === true ||
      (member as any).revokedCertKeys?.includes(`${e.id}_participant`);
    const isOrgRevoked =
      attendance?.revokedOrgCert === true ||
      (member as any).revokedCertKeys?.includes(`${e.id}_organizer`);
    const hasPart = isReleased && isEligible && !isPartRevoked;
    const hasOrg =
      isReleased && attendance?.isOrganizer === true && !isOrgRevoked;

    if (certTypeFilter === "participant" && !hasPart) return false;
    if (certTypeFilter === "organizer" && !hasOrg) return false;

    if (certSearchTerm.trim()) {
      const term = certSearchTerm.toLowerCase();
      const matchTitle = e.title?.toLowerCase().includes(term);
      const matchHours = (e.hours?.toString() || "").includes(term);
      const matchFormat = e.format?.toLowerCase().includes(term);
      const matchSem =
        semInfo.label.toLowerCase().includes(term) ||
        semInfo.key.includes(term);
      return matchTitle || matchHours || matchFormat || matchSem;
    }

    return true;
  });

  // Agrupar eventos filtrados por semestre
  const groupedBySemester = new Map<
    string,
    {
      info: { key: string; label: string; year: number; semNum: number };
      events: Event[];
    }
  >();
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const da = new Date(a.startDate || 0).getTime();
    const db = new Date(b.startDate || 0).getTime();
    return db - da;
  });

  sortedEvents.forEach((e) => {
    const info = getSemesterInfo(e);
    const group = groupedBySemester.get(info.key) || { info, events: [] };
    group.events.push(e);
    groupedBySemester.set(info.key, group);
  });

  const semesterGroups = Array.from(groupedBySemester.values());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* FAJOPA Plus & Davvero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl shadow-lg flex flex-col justify-between items-start text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 opacity-10">
            <ShieldCheck className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-3">
              Validação de Certificados
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" /> FAJOPA Plus
            </h3>
            <p className="text-xs text-emerald-50 max-w-sm mb-6 leading-relaxed">
              Acesse a validação e autenticidade oficial de certificados da rede
              FAJOPA Plus.
            </p>
          </div>
          <button
            onClick={() => {
              const targetUrl =
                settings.certificateValidationUrl ||
                "https://plus.fajopa.org/validar";
              window.open(targetUrl, "_blank");
            }}
            className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-xs shadow-md flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Validar no FAJOPA Plus
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between items-start relative overflow-hidden">
          <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05]">
            <ShieldCheck className="w-32 h-32 text-slate-900 dark:text-white" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-black uppercase tracking-widest mb-3">
              Nativo & Verificável
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <ShieldCheck className="w-5 h-5 text-sky-500" /> DAVVERO System
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
              Seus certificados oficiais gerados diretamente pela plataforma,
              com código QR e validação digital instantânea.
            </p>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById("davvero-certificates-list");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 w-full sm:w-auto text-xs flex items-center justify-center gap-2"
          >
            Ver Certificados Oficiais Abaixo
          </button>
        </div>
      </div>

      <div id="davvero-certificates-list">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Certificados
            de Eventos Concluídos
          </h3>
        </div>

        {/* Aviso de Armazenamento Temporário de Certificados */}
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1">
            <p className="font-bold">
              Aviso Importante sobre Armazenamento:
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Os certificados ficam temporariamente no painel, por isso é
              responsabilidade do aluno baixar e armazenar em seu dispositivo.
              O Davvero não se responsabilizará em emitir uma segunda via,
              ficando sob responsabilidade da instituição se fará ou não a
              produção da segunda via.
            </p>
          </div>
        </div>

        {/* Filtros e Barra de Pesquisa de Certificados */}
        {eligibleEvents.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
              Nenhum certificado disponível
            </p>
            <p className="text-xs text-slate-500">
              Os certificados aparecem aqui após a confirmação da sua
              participação e aprovação do modelo pelo administrador.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de Busca e Filtros de Semestre */}
            <div className="bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Campo de Pesquisa */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar certificado por nome do evento, carga horária..."
                    value={certSearchTerm}
                    onChange={(e) => setCertSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {certSearchTerm && (
                    <button
                      onClick={() => setCertSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filtro de Semestre Dropdown */}
                <div className="flex items-center gap-2">
                  <div className="relative min-w-[170px] sm:w-56">
                    <select
                      value={certSemesterFilter}
                      onChange={(e) => setCertSemesterFilter(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="all">
                        Todos os Semestres ({eligibleEvents.length})
                      </option>
                      {availableSemesters.map((sem) => (
                        <option key={sem.key} value={sem.key}>
                          Semestre {sem.key} ({sem.count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Filtro por Tipo de Certificado */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Tipo:
                  </span>
                  <button
                    onClick={() => setCertTypeFilter("all")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      certTypeFilter === "all"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setCertTypeFilter("participant")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      certTypeFilter === "participant"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Participante
                  </button>
                  <button
                    onClick={() => setCertTypeFilter("organizer")}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      certTypeFilter === "organizer"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Organização
                  </button>
                </div>

                <span className="text-[10px] font-medium text-slate-500">
                  Exibindo <strong>{filteredEvents.length}</strong> de{" "}
                  {eligibleEvents.length} certificados
                </span>
              </div>
            </div>

            {/* Lista de Certificados Agrupados por Semestre */}
            {semesterGroups.length > 0 ? (
              <div className="space-y-6">
                {semesterGroups.map(({ info, events }) => {
                  const totalHours = events.reduce(
                    (acc, ev) => acc + (Number(ev.hours) || 0),
                    0
                  );

                  return (
                    <div key={info.key} className="space-y-3">
                      {/* Cabeçalho do Semestre */}
                      <div className="flex items-center justify-between px-2 py-1.5 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 rounded-2xl border border-sky-100 dark:border-sky-900/40">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                              Semestre {info.key}{" "}
                              <span className="font-medium text-[11px] text-slate-500 dark:text-slate-400">
                                ({info.semNum}º Semestre de {info.year})
                              </span>
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-lg">
                            {events.length}{" "}
                            {events.length === 1
                              ? "Certificado"
                              : "Certificados"}
                          </span>
                          {totalHours > 0 && (
                            <span className="text-[10px] font-extrabold uppercase bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-lg">
                              {totalHours} horas
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cards de Certificados deste Semestre */}
                      <div className="space-y-3">
                        {events.map((event) => {
                          const startStr = new Date(
                            event.startDate
                          ).toLocaleDateString("pt-BR");
                          const endStr = event.endDate
                            ? new Date(event.endDate).toLocaleDateString(
                                "pt-BR"
                              )
                            : startStr;
                          const periodText =
                            startStr === endStr
                              ? startStr
                              : `${startStr} a ${endStr}`;
                          const formatText =
                            event.format === "online"
                              ? "Online"
                              : event.format === "hibrido"
                              ? "Híbrido"
                              : "Presencial";
                          const attendance = myAttendances.find(
                            (a) => a.eventId === event.id
                          );
                          const isReleased =
                            event.status === "encerrado" ||
                            isEventCertificateReleased(event) ||
                            event.isCertificateReleased === true;
                          const isEligible =
                            attendance?.status === "presente" ||
                            attendance?.status === "apto_para_certificado" ||
                            event.allowAllRegisteredCertificates;
                          const isPartRevoked =
                            attendance?.revokedParticipantCert === true ||
                            (member as any).revokedCertKeys?.includes(
                              `${event.id}_participant`
                            );
                          const isOrgRevoked =
                            attendance?.revokedOrgCert === true ||
                            (member as any).revokedCertKeys?.includes(
                              `${event.id}_organizer`
                            );
                          const hasPartCert =
                            isReleased && isEligible && !isPartRevoked;
                          const hasOrgCert =
                            isReleased &&
                            attendance?.isOrganizer === true &&
                            !isOrgRevoked;
                          const releaseInfo = resolveCertificateReleaseDate(
                            event,
                            undefined,
                            member
                          );

                          return (
                            <div
                              key={event.id}
                              className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 text-left shadow-sm flex flex-col gap-3 hover:border-sky-300 dark:hover:border-sky-600 transition-colors"
                            >
                              <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
                                    {event.title}
                                  </h4>
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md self-start sm:self-auto">
                                    Semestre {info.key}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                                    {formatText}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                                    {periodText}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">
                                    {event.hours || 0} horas
                                  </span>
                                  <span className="text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
                                    Liberado em {releaseInfo.formattedDate}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row gap-2">
                                {hasPartCert && (
                                  <div className="flex-1 flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (downloadingCertKey) return;
                                        handleDownloadCertificate(
                                          event,
                                          "participant"
                                        );
                                      }}
                                      disabled={
                                        downloadingCertKey ===
                                        `${event.id}_participant`
                                      }
                                      className={`flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                                        downloadingCertKey ===
                                        `${event.id}_participant`
                                          ? "opacity-75 pointer-events-none"
                                          : ""
                                      }`}
                                    >
                                      {downloadingCertKey ===
                                      `${event.id}_participant` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Download className="w-4 h-4" />{" "}
                                          Baixar Certificado (PDF)
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() =>
                                        setPreviewCertEvent({
                                          event,
                                          type: "participant",
                                        })
                                      }
                                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                      title="Visualizar Certificado"
                                    >
                                      <Eye className="w-4 h-4" /> Visualizar
                                    </button>
                                  </div>
                                )}
                                {hasOrgCert && (
                                  <div className="flex-1 flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (downloadingCertKey) return;
                                        handleDownloadCertificate(
                                          event,
                                          "organizer"
                                        );
                                      }}
                                      disabled={
                                        downloadingCertKey ===
                                        `${event.id}_organizer`
                                      }
                                      className={`flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                                        downloadingCertKey ===
                                        `${event.id}_organizer`
                                          ? "opacity-75 pointer-events-none"
                                          : ""
                                      }`}
                                    >
                                      {downloadingCertKey ===
                                      `${event.id}_organizer` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Download className="w-4 h-4" />{" "}
                                          Baixar Organização (PDF)
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() =>
                                        setPreviewCertEvent({
                                          event,
                                          type: "organizer",
                                        })
                                      }
                                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                      title="Visualizar Certificado de Organização"
                                    >
                                      <Eye className="w-4 h-4" /> Visualizar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nenhum certificado encontrado para os filtros selecionados
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Tente alterar o termo da busca ou o semestre selecionado.
                </p>
                <button
                  onClick={() => {
                    setCertSearchTerm("");
                    setCertSemesterFilter("all");
                    setCertTypeFilter("all");
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              Certificados Anexados
            </h3>
          </div>
          <div className="space-y-4">
            {member?.externalCertificates &&
            member.externalCertificates.length > 0 ? (
              <div className="space-y-3">
                {member.externalCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate mb-1">
                        {cert.title}
                      </h4>
                      <p className="text-[9px] text-slate-500 uppercase">
                        {formatDateTime(cert.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleDownloadExternalCertificate(cert)
                        }
                        className="p-2 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                        title="Baixar Certificado"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenExternalCertificate(cert)}
                        className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                        title="Visualizar Certificado"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteExternalCertificate(cert.id)
                        }
                        className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                        title="Excluir Certificado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/30 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">
                  Nenhum certificado anexado
                </p>
              </div>
            )}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-dashed border-sky-300 dark:border-sky-700 text-center">
              <label className="cursor-pointer text-xs font-bold text-sky-600 dark:text-sky-400 flex flex-col items-center justify-center gap-2 hover:text-sky-500 transition-colors py-2">
                {isUploadingCert ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
                <span>
                  {isUploadingCert
                    ? "Anexando..."
                    : "Anexar Novo Certificado (PDF ou Imagem)"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={handleUploadExternalCertificate}
                  disabled={isUploadingCert}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StudentCertificatesTab;
