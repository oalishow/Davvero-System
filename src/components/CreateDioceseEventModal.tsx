import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Video,
  User,
  Image as ImageIcon,
  Church,
  DollarSign,
  Award,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Globe,
  ShieldCheck,
  FileText,
  Loader2
} from "lucide-react";
import Modal from "./Modal";
import ImageCropperModal from "./ImageCropperModal";
import { createEvent, updateEvent, createNotification } from "../lib/firebase";
import { AVAILABLE_DIOCESES, Member, Event } from "../types";
import { useSettings } from "../context/SettingsContext";
import { compressOriginalImage } from "../lib/cropUtils";

interface CreateDioceseEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (eventId: string) => void;
  member?: Member | null;
  defaultDiocese?: string;
  eventToEdit?: Event | null;
}

export default function CreateDioceseEventModal({
  isOpen,
  onClose,
  onSuccess,
  member,
  defaultDiocese,
  eventToEdit
}: CreateDioceseEventModalProps) {
  const { settings, updateSettings } = useSettings();

  const allDioceses = Array.from(
    new Set([...AVAILABLE_DIOCESES, ...(settings.customDioceses || [])])
  );

  const initialDiocese =
    eventToEdit?.dioceseId ||
    defaultDiocese ||
    member?.diocese ||
    (allDioceses.length > 0 ? allDioceses[0] : "MARÍLIA");

  const [selectedDiocese, setSelectedDiocese] = useState(initialDiocese);
  const [newDioceseInput, setNewDioceseInput] = useState("");
  const [title, setTitle] = useState(eventToEdit?.title || "");
  const [speaker, setSpeaker] = useState(eventToEdit?.speaker || "");
  const [startDate, setStartDate] = useState(eventToEdit?.startDate || "");
  const [endDate, setEndDate] = useState(eventToEdit?.endDate || "");
  const [format, setFormat] = useState<"presencial" | "online" | "hibrido">(
    eventToEdit?.format || "presencial"
  );
  const [location, setLocation] = useState(eventToEdit?.location || "");
  const [link, setLink] = useState(eventToEdit?.link || "");
  const [description, setDescription] = useState(eventToEdit?.description || "");
  const [imageUrl, setImageUrl] = useState(eventToEdit?.imageUrl || "");
  const [hours, setHours] = useState(eventToEdit?.hours ? String(eventToEdit.hours) : "");
  const [maxParticipants, setMaxParticipants] = useState(
    eventToEdit?.maxParticipants ? String(eventToEdit.maxParticipants) : ""
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    eventToEdit?.registrationDeadline || ""
  );
  const [isPublic, setIsPublic] = useState(eventToEdit?.isPublic || false);
  const [isPaid, setIsPaid] = useState(eventToEdit?.isPaid || false);
  const [price, setPrice] = useState(eventToEdit?.price ? String(eventToEdit.price) : "");
  const [hotmartLink, setHotmartLink] = useState(eventToEdit?.hotmartLink || "");
  const [googleFormsLink, setGoogleFormsLink] = useState(eventToEdit?.googleFormsLink || "");

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setSpeaker(eventToEdit.speaker || "");
      setStartDate(eventToEdit.startDate || "");
      setEndDate(eventToEdit.endDate || "");
      setFormat(eventToEdit.format || "presencial");
      setLocation(eventToEdit.location || "");
      setLink(eventToEdit.link || "");
      setDescription(eventToEdit.description || "");
      setImageUrl(eventToEdit.imageUrl || "");
      setHours(eventToEdit.hours ? String(eventToEdit.hours) : "");
      setMaxParticipants(eventToEdit.maxParticipants ? String(eventToEdit.maxParticipants) : "");
      setRegistrationDeadline(eventToEdit.registrationDeadline || "");
      setIsPublic(eventToEdit.isPublic || false);
      setIsPaid(eventToEdit.isPaid || false);
      setPrice(eventToEdit.price ? String(eventToEdit.price) : "");
      setHotmartLink(eventToEdit.hotmartLink || "");
      setGoogleFormsLink(eventToEdit.googleFormsLink || "");
      if (eventToEdit.dioceseId) {
        setSelectedDiocese(eventToEdit.dioceseId);
      }
    }
  }, [eventToEdit]);

  if (!isOpen) return null;

  const handleAddCustomDiocese = async () => {
    const trimmed = newDioceseInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!allDioceses.includes(trimmed)) {
      await updateSettings({
        customDioceses: [...(settings.customDioceses || []), trimmed]
      });
    }
    setSelectedDiocese(trimmed);
    setNewDioceseInput("");
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Use createObjectURL for instant load in the cropper without FileReader lag
      setCropImageSrc(URL.createObjectURL(file));
      // Reset input value so same file can be selected again if needed
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Por favor, informe o título do evento.");
      return;
    }
    if (!selectedDiocese.trim()) {
      setError("Por favor, selecione a Diocese correspondente.");
      return;
    }
    if (!startDate) {
      setError("Por favor, informe a data e hora de início.");
      return;
    }

    setLoading(true);

    try {
      let finalImageUrl = imageUrl.trim() || undefined;
      // If it's a raw base64 or heavy image, ensure it is compressed (<250KB) to ensure sub-second save
      if (finalImageUrl && finalImageUrl.startsWith("data:image/")) {
        try {
          finalImageUrl = await compressOriginalImage(finalImageUrl, 1200, 0.82);
        } catch (compErr) {
          console.warn("Image pre-save compression fallback:", compErr);
        }
      }

      const payload: Omit<Event, "id"> = {
        title: title.trim(),
        startDate,
        endDate: endDate || startDate,
        format,
        location: format !== "online" ? location.trim() : "",
        link: format !== "presencial" ? link.trim() : "",
        description: description.trim(),
        imageUrl: finalImageUrl,
        hours: hours ? Number(hours) : undefined,
        maxParticipants: maxParticipants ? Number(maxParticipants) : 0,
        speaker: speaker.trim() || undefined,
        registrationDeadline: registrationDeadline || undefined,
        status: eventToEdit?.status || "aberto",
        isDiocese: true,
        dioceseId: selectedDiocese.trim().toUpperCase(),
        isPublic: Boolean(isPublic),
        isPaid,
        price: isPaid && price ? Number(price) : undefined,
        hotmartLink: isPaid && hotmartLink ? hotmartLink.trim() : undefined,
        googleFormsLink: googleFormsLink ? googleFormsLink.trim() : undefined,
        // Preserve or assign creator details
        createdBy: eventToEdit?.createdBy || member?.id || member?.ra || member?.email || "user",
        creatorName: eventToEdit?.creatorName || member?.name || "Organizador Diocesano",
        creatorEmail: eventToEdit?.creatorEmail || member?.email || "",
        creatorRa: eventToEdit?.creatorRa || member?.ra || "",
      };

      let resultId = "";
      if (eventToEdit) {
        await updateEvent(eventToEdit.id, payload);
        resultId = eventToEdit.id;
      } else {
        resultId = await createEvent(payload);

        // Trigger notification asynchronously (non-blocking)
        createNotification({
          recipientId: "todos",
          title: `Novo Evento: Diocese de ${selectedDiocese}`,
          message: `${title} foi publicado na aba Dioceses${isPublic ? " e no mural geral" : ""}. Participe e confira os detalhes!`,
          type: "evento"
        }).catch(console.error);
      }

      onSuccess(resultId);
    } catch (err: any) {
      console.error("Erro ao salvar evento diocesano:", err);
      setError("Ocorreu um erro ao salvar o evento. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={eventToEdit ? "Editar Evento da Diocese" : "Novo Evento da Diocese"}
        hideFooter={true}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Admin badge / Creator notice */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <p className="font-black text-purple-900 dark:text-purple-200">
                {eventToEdit ? "Modo de Edição pelo Administrador" : "Administração Automática do Evento"}
              </p>
              <p className="text-purple-700 dark:text-purple-300 mt-0.5 leading-relaxed">
                {eventToEdit
                  ? `Você está editando este evento (${eventToEdit.creatorName ? `Criado por: ${eventToEdit.creatorName}` : "Administrador"}).`
                  : `Como criador (${member?.name || "Organizador"}), você se tornará o Administrador deste evento, podendo gerenciar inscritos, presença, certificados e configurações.`}
              </p>
            </div>
          </div>

          {/* Diocese Selection */}
          <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-purple-900 dark:text-purple-300 uppercase tracking-wider">
              <Church className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Diocese Responsável
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Selecione a Diocese
                </label>
                <select
                  value={selectedDiocese}
                  onChange={(e) => setSelectedDiocese(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 font-semibold"
                >
                  {allDioceses.map((d) => (
                    <option key={d} value={d}>
                      Diocese de {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ou Cadastrar Nova Diocese
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome da Diocese..."
                    value={newDioceseInput}
                    onChange={(e) => setNewDioceseInput(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDiocese}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Visibility Option - Public / Visible to All Toggle */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-sky-50/70 dark:from-indigo-950/30 dark:to-sky-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-indigo-600 focus:ring-indigo-500 rounded border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 focus:ring-2 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Tornar evento público (Visível para todos)
                  </span>
                  {isPublic ? (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Público
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Apenas Diocese
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {isPublic
                    ? "✨ Este evento ficará visível tanto no mural geral da faculdade/seminário para todos os alunos e visitantes, quanto na aba da Diocese."
                    : "🔒 Este evento ficará visível prioritariamente na aba Dioceses, sob a Diocese de " + selectedDiocese + "."}
                </p>
              </div>
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Título do Evento *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Encontro Diocesano da Juventude, Formação de Ministros..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-semibold"
            />
          </div>

          {/* Speaker / Convidado */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Palestrante / Pregador / Bispo / Convidado
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: Dom Luiz Antonio, Pe. Carlos..."
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Data e Hora de Início *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Data e Hora de Término
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Formato do Evento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "presencial", label: "Presencial", icon: MapPin },
                { id: "online", label: "Online", icon: Video },
                { id: "hibrido", label: "Híbrido", icon: Sparkles }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id as any)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-md scale-100"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {format !== "online" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Local / Endereço Presencial
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ex: Catedral São Bento, Salão Paroquial..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
            )}

            {format !== "presencial" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Link da Transmissão (YouTube / Zoom / Meet)
                </label>
                <div className="relative">
                  <Video className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    placeholder="Ex: https://youtube.com/live/..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Banner Photo / Image */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Cartaz / Foto de Divulgação (Opcional)
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex-1 w-full">
                <input
                  type="url"
                  placeholder="Cole o link da imagem (HTTPS) ou use o botão ao lado..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                />
              </div>
              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 shrink-0">
                <Upload className="w-4 h-4" />
                <span>Upload Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />
              </label>
            </div>

            {imageUrl && (
              <div className="relative mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center max-h-48 overflow-hidden group">
                <img
                  src={imageUrl}
                  alt="Pré-visualização do Cartaz"
                  className="max-h-44 object-contain rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Descrição e Detalhes
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o objetivo do evento, público-alvo, cronograma, informações para inscrição e orientações..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
            />
          </div>

          {/* Links de Inscrição Externa (Google Forms) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Link Externo para Inscrição / Google Forms (Opcional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="url"
                placeholder="Ex: https://forms.gle/..."
                value={googleFormsLink}
                onChange={(e) => setGoogleFormsLink(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Additional Options (Hours, Max Participants) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Carga Horária (Certificado)
              </label>
              <div className="relative">
                <Award className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="Ex: 4"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Limite de Vagas (0 = Ilimitado)
              </label>
              <input
                type="number"
                placeholder="Ex: 100"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{eventToEdit ? "Salvar Alterações" : "Criar Evento"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Image Cropper Modal */}
      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          cropShape="rect"
          allowUseOriginal={true}
          onCropComplete={(croppedBase64) => {
            setImageUrl(croppedBase64);
            setCropImageSrc(null);
          }}
          onClose={() => setCropImageSrc(null)}
        />
      )}
    </>
  );
}
