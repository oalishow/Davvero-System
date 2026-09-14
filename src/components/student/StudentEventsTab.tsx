import React from "react";
import { motion } from "motion/react";
import {
  QrCode,
  ShieldCheck,
  Clock,
  LogOut,
  Loader2,
  Download,
  ExternalLink,
  Video,
  History,
  CheckCircle,
} from "lucide-react";
import type { Event, Attendance } from "../../types";

interface StudentEventsTabProps {
  eventsSubTab: "upcoming" | "past";
  setEventsSubTab: (tab: "upcoming" | "past") => void;
  availableEvents: Event[];
  pastEvents: Event[];
  myAttendances: Attendance[];
  expandedPortalEvents: Record<string, boolean>;
  setExpandedPortalEvents: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  handleEnroll: (eventId: string) => Promise<void>;
  isEnrollingInProgress: string | null;
}

export const StudentEventsTab: React.FC<StudentEventsTabProps> = ({
  eventsSubTab,
  setEventsSubTab,
  availableEvents,
  pastEvents,
  myAttendances,
  expandedPortalEvents,
  setExpandedPortalEvents,
  handleEnroll,
  isEnrollingInProgress,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* SUB-TABS for Events */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/30 rounded-2xl mb-6">
        <button
          onClick={() => setEventsSubTab("upcoming")}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            eventsSubTab === "upcoming"
              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setEventsSubTab("past")}
          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            eventsSubTab === "past"
              ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Histórico
        </button>
      </div>

      {eventsSubTab === "upcoming" ? (
        <>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-500" /> Próximos Eventos
            </h3>
          </div>

          {availableEvents.length > 0 ? (
            <div className="space-y-4">
              {availableEvents.map((event) => {
                const isEnrolled = myAttendances.some(
                  (a) => a.eventId === event.id
                );
                const isPastDeadline = event.registrationDeadline
                  ? new Date() > new Date(event.registrationDeadline)
                  : false;
                const isPaused = event.isRegistrationPaused === true;

                const canEnroll = !isPastDeadline && !isPaused;

                let cannotEnrollReason = "";
                if (isPaused) cannotEnrollReason = "Inscrições Pausadas";
                else if (isPastDeadline)
                  cannotEnrollReason = "Inscrições Encerradas";
                return (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                          event.format === "presencial"
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            : event.format === "hibrido"
                            ? "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400"
                            : "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400"
                        }`}
                      >
                        {event.format === "presencial"
                          ? "Presencial"
                          : event.format === "hibrido"
                          ? "Híbrido"
                          : "Online"}
                      </span>
                      {isEnrolled && (
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Inscrito
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1 leading-tight">
                      {event.title}
                    </h4>
                    <div className="mb-4">
                      <p
                        className={`text-xs text-slate-600 dark:text-slate-300 ${
                          expandedPortalEvents[event.id]
                            ? "whitespace-pre-wrap break-words leading-relaxed"
                            : "line-clamp-2"
                        } transition-all`}
                      >
                        {event.description
                          .split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g)
                          .map((part, i) => {
                            if (
                              part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/)
                            ) {
                              const href = part.startsWith("http")
                                ? part
                                : `https://${part}`;
                              return (
                                <a
                                  key={i}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sky-600 dark:text-sky-400 underline font-semibold hover:text-sky-700"
                                >
                                  {part}
                                </a>
                              );
                            }
                            return part;
                          })}
                      </p>
                      {event.description && event.description.length > 70 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPortalEvents((prev) => ({
                              ...prev,
                              [event.id]: !prev[event.id],
                            }));
                          }}
                          className="mt-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {expandedPortalEvents[event.id]
                            ? "Ver menos"
                            : "Ver descrição completa..."}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight mb-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(event.startDate).toLocaleDateString("pt-BR")}
                      </div>
                      {event.hours && (
                        <div className="flex items-center gap-1.5">
                          <LogOut className="w-3.5 h-3.5 rotate-180" />
                          {event.hours}H
                        </div>
                      )}
                    </div>
                    {!isEnrolled ? (
                      canEnroll ? (
                        <button
                          onClick={() => handleEnroll(event.id)}
                          disabled={isEnrollingInProgress === event.id}
                          className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                        >
                          {isEnrollingInProgress === event.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Inscrever-se Agora"
                          )}
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold border border-slate-200 dark:border-slate-700/50 text-center text-xs flex items-center justify-center gap-2">
                          {cannotEnrollReason}
                        </div>
                      )
                    ) : (
                      <div className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-500 rounded-2xl font-bold border border-emerald-100 dark:border-emerald-900/30 text-center text-xs">
                        Inscrição confirmada
                      </div>
                    )}

                    {/* Event Links Section */}
                    {(event.schedulePdfUrl ||
                      event.link ||
                      event.locationOrLink) && (
                      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 text-xs font-bold uppercase mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                        {event.schedulePdfUrl && (
                          <>
                            <a
                              href={
                                event.schedulePdfUrl.startsWith("http")
                                  ? event.schedulePdfUrl
                                  : `https://${event.schedulePdfUrl}`
                              }
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <Download className="w-4 h-4" /> Baixar conteúdo
                            </a>
                            <a
                              href={
                                event.schedulePdfUrl.startsWith("http")
                                  ? event.schedulePdfUrl
                                  : `https://${event.schedulePdfUrl}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <ExternalLink className="w-4 h-4" /> Abrir Link
                              Conteúdo
                            </a>
                          </>
                        )}
                        {(event.link ||
                          (event.locationOrLink &&
                            (event.locationOrLink.startsWith("http") ||
                              event.locationOrLink.startsWith("www.")))) && (
                          <a
                            href={
                              event.link
                                ? event.link.startsWith("http")
                                  ? event.link
                                  : `https://${event.link}`
                                : event.locationOrLink?.startsWith("http")
                                ? event.locationOrLink
                                : `https://${event.locationOrLink}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                          >
                            <Video className="w-4 h-4" />{" "}
                            {event.format === "presencial"
                              ? "Acessar Conteúdo (Formulário)"
                              : "Acessar Link do Evento"}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                Nenhum evento aberto
              </p>
              <p className="text-xs text-slate-500">
                No momento não há inscrições abertas para novos eventos.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" /> Eventos Encerrados
            </h3>
          </div>

          {pastEvents.filter((e) =>
            myAttendances.some((a) => a.eventId === e.id)
          ).length > 0 ? (
            <div className="space-y-4">
              {pastEvents
                .filter((e) => myAttendances.some((a) => a.eventId === e.id))
                .map((event) => (
                  <div
                    key={event.id}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-5 shadow-sm"
                  >
                    <h4 className="font-bold text-slate-700 dark:text-white text-sm mb-1 leading-tight">
                      {event.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 uppercase font-bold">
                      {new Date(event.startDate).toLocaleDateString("pt-BR")} •{" "}
                      {event.format === "presencial"
                        ? "Presencial"
                        : event.format === "hibrido"
                        ? "Híbrido"
                        : "Online"}
                    </p>
                    <div className="flex items-center gap-2">
                      {myAttendances.find((a) => a.eventId === event.id)
                        ?.status === "presente" ||
                      myAttendances.find((a) => a.eventId === event.id)
                        ?.status === "apto_para_certificado" ? (
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Presença
                          Confirmada
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 font-medium">
                          <LogOut className="w-3 h-3" /> Evento Finalizado
                        </span>
                      )}
                    </div>
                    {(() => {
                      const att = myAttendances.find(
                        (a) => a.eventId === event.id
                      );
                      if (att?.checkInDates && att.checkInDates.length > 0) {
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                              Assinaturas:
                            </span>
                            {att.checkInDates.map((dateStr) => {
                              const parts = dateStr.split("-");
                              const dFormatted =
                                parts.length === 3
                                  ? `${parts[2]}/${parts[1]}`
                                  : dateStr;
                              return (
                                <span
                                  key={dateStr}
                                  className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1"
                                >
                                  <CheckCircle className="w-2.5 h-2.5" /> Dia{" "}
                                  {dFormatted}
                                </span>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Event Links Section */}
                    {(event.schedulePdfUrl ||
                      event.link ||
                      event.locationOrLink) && (
                      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 text-xs font-bold uppercase mt-5 pt-4 border-t border-slate-200 dark:border-slate-700/80">
                        {event.schedulePdfUrl && (
                          <>
                            <a
                              href={
                                event.schedulePdfUrl.startsWith("http")
                                  ? event.schedulePdfUrl
                                  : `https://${event.schedulePdfUrl}`
                              }
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 hover:bg-sky-100 dark:hover:bg-sky-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <Download className="w-4 h-4" /> Baixar conteúdo
                            </a>
                            <a
                              href={
                                event.schedulePdfUrl.startsWith("http")
                                  ? event.schedulePdfUrl
                                  : `https://${event.schedulePdfUrl}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                              <ExternalLink className="w-4 h-4" /> Abrir Link
                              Conteúdo
                            </a>
                          </>
                        )}
                        {(event.link ||
                          (event.locationOrLink &&
                            (event.locationOrLink.startsWith("http") ||
                              event.locationOrLink.startsWith("www.")))) && (
                          <a
                            href={
                              event.link
                                ? event.link.startsWith("http")
                                  ? event.link
                                  : `https://${event.link}`
                                : event.locationOrLink?.startsWith("http")
                                ? event.locationOrLink
                                : `https://${event.locationOrLink}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-all shadow-sm"
                          >
                            <Video className="w-4 h-4" />{" "}
                            {event.format === "presencial"
                              ? "Acessar Conteúdo (Formulário)"
                              : "Acessar Link do Evento"}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/30 p-10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                Sem histórico
              </p>
              <p className="text-xs text-slate-500">
                Você ainda não participou ou não possui histórico em eventos
                encerrados.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default StudentEventsTab;
