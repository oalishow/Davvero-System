import { useState } from "react";
import { Printer, CheckCircle, QrCode, Keyboard } from "lucide-react";
import type { Member } from "../types";
import { QRCodeSVG } from "qrcode.react";
import { URL_STORAGE_KEY, DEFAULT_PUBLIC_URL } from "../lib/constants";
import FajopaIDCard from "./FajopaIDCard";
import Modal from "./Modal";
import { motion } from "motion/react";
import { useDialog } from "../context/DialogContext";

interface VerificationResultProps {
  member: Member | null;
  status:
    | "VALID"
    | "INACTIVE"
    | "EXPIRED"
    | "NOT_FOUND"
    | "NOT_ENROLLED"
    | "ALREADY_PRESENT"
    | "JUST_CHECKED_IN"
    | "PENDING";
  onReset: () => void;
  onScanNext?: () => void;
  isMyID?: boolean;
  isAdminLogged?: boolean;
  onEnrollAndCheckIn?: () => void;
}

export default function VerificationResult({
  member,
  status,
  onReset,
  onScanNext,
  isMyID = false,
  isAdminLogged = false,
  onEnrollAndCheckIn,
}: VerificationResultProps) {
  const { showAlert } = useDialog();
  const [exporting, setExporting] = useState(false);
  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const now = new Date();
  const timestampStr = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

  const baseUrl = localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL;
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  let themeClass, titleText, subtitleText, descHtml, dotColor, badgeText;

  switch (status) {
    case "VALID":
      themeClass = "emerald";
      titleText = "Verificado com Sucesso";
      subtitleText = "Documento Estudantil Digital";
      descHtml =
        "Acesso Concedido. Membro da comunidade devidamente matriculado.";
      dotColor = "bg-emerald-500 animate-pulse";
      badgeText = "Ativo";
      break;
    case "INACTIVE":
      themeClass = "amber";
      titleText = "Acesso Suspenso";
      subtitleText = "Identidade Desativada";
      descHtml =
        "A identidade deste membro encontra-se inativa ou suspensa. O acesso físico e os benefícios associados estão temporariamente indisponíveis.";
      dotColor = "bg-amber-500";
      badgeText = "Desativado / Suspenso";
      break;
    case "EXPIRED":
      themeClass = "rose";
      titleText = "Identidade Expirada";
      subtitleText = "Acesso Negado";
      descHtml =
        "A validade deste documento terminou na data referida. Por favor, regularize a sua situação institucional.";
      dotColor = "bg-rose-500";
      badgeText = "Expirado";
      break;
    case "NOT_ENROLLED":
      themeClass = "rose";
      titleText = "Não Inscrito no Evento";
      subtitleText = "Acesso ao Evento Negado";
      descHtml =
        "Este aluno não realizou a inscrição para o evento selecionado.";
      dotColor = "bg-rose-500";
      badgeText = "Não Inscrito";
      break;
    case "ALREADY_PRESENT":
      themeClass = "amber";
      titleText = "Check-in Já Realizado";
      subtitleText = "Aviso de Duplicidade";
      descHtml = "Este aluno já registrou presença neste evento anteriormente.";
      dotColor = "bg-amber-500";
      badgeText = "Já Presente";
      break;
    case "JUST_CHECKED_IN":
      themeClass = "emerald";
      titleText = "Inscrição e Check-in Concluídos!";
      subtitleText = "Acesso Limitado/Evento";
      descHtml = "O aluno foi inscrito no evento e o check-in realizado com sucesso.";
      dotColor = "bg-emerald-500";
      badgeText = "Sucesso";
      break;
    case "PENDING":
      themeClass = "amber";
      titleText = "Aguardando Aprovação";
      subtitleText = "Acesso Pendente";
      descHtml = "Seu pedido de primeiro acesso está sob análise da secretaria. Sua carteirinha ficará disponível assim que for validado e você será notificado.";
      dotColor = "bg-amber-500 animate-[pulse_1.5s_infinite]";
      badgeText = "Em Análise";
      break;
    default:
      themeClass = "rose";
      titleText = "Registro Não Encontrado";
      subtitleText = "Acesso Negado";
      descHtml =
        "O código lido não consta na base de dados oficial. Poderá ter sido invalidado, excluído ou nunca existiu.";
      dotColor = "bg-rose-500";
      badgeText = "Não Encontrado";
      break;
  }

  const safeName = member?.name || "Desconhecido";
  const safeCode = member?.alphaCode || "N/A";
  const safeDate = member?.validityDate
    ? new Date(member.validityDate + "T23:59:59").toLocaleDateString("pt-BR")
    : "N/D";

  const avatarUrl =
    member?.photoUrl ||
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';

  const [showLargeQR, setShowLargeQR] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const htmlToImage = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      let targetNodeId = "validation-card-capture";
      if (isMyID && status === "VALID") {
        targetNodeId = "export-card-node-internal";
      }

      const card = document.getElementById(targetNodeId);
      if (!card) return;

      const isDarkMode = document.documentElement.classList.contains("dark");

      // Allow browser engine to render the container before capture
      await new Promise((r) => setTimeout(r, 1200));

      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent,
      );
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const captureOptions = {
        backgroundColor:
          isMyID && status === "VALID"
            ? "transparent"
            : isDarkMode
              ? "#0f172a"
              : "#ffffff",
        pixelRatio: isSafari || isMobile ? 2 : 3, // Lower for mobile/Safari to avoid memory/blank issues
        cacheBust: true,
        skipFonts: false,
        style: {
          transform: "none",
          animation: "none",
        },
      };

      if (isMyID && status === "VALID") {
        // Optimization for Safari: sometimes it needs to be called twice or with a delay
        if (isSafari) await htmlToImage.toPng(card, captureOptions);

        const imgData = await htmlToImage.toPng(card, captureOptions);

        if (!imgData || imgData === "data:,") {
          throw new Error("Falha ao gerar imagem do cartão (vazia)");
        }

        // Exporting the exact cards (front and back) to A4 PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4", // 210 x 297 mm
        });

        const pdfWidth = 210;
        const imgProps = pdf.getImageProperties(imgData);

        const printWidth = 95;
        const printHeight = (imgProps.height * printWidth) / imgProps.width;

        const x = (pdfWidth - printWidth) / 2;
        const y = 30;

        pdf.setFontSize(14);
        pdf.text("IDENTIFICAÇÃO ESTUDANTIL - FAJOPA", pdfWidth / 2, 20, {
          align: "center",
        });

        pdf.addImage(imgData, "PNG", x, y, printWidth, printHeight);

        const fileName = `Carteirinha_FAJOPA_${safeName.replace(/\s+/g, "_")}.pdf`;
        pdf.save(fileName);
        setShowExportSuccess(true);
      } else {
        // Safari optimization for Jpeg capture
        if (isSafari) await htmlToImage.toJpeg(card, captureOptions);
        const imgData = await htmlToImage.toJpeg(card, captureOptions);

        if (!imgData || imgData === "data:,") {
          throw new Error("Falha ao gerar imagem (vazia)");
        }

        // Just downloading regular result snapshot
        const link = document.createElement("a");
        link.href = imgData;
        link.download = `VerifyID_${status === "VALID" ? "Validacao" : "Recusa"}_${safeName.replace(/\s+/g, "_")}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportSuccess(true);
      }
    } catch (err) {
      console.error("Export erro:", err);
      showAlert("Falha ao gerar o PDF. Verifique sua conexão e tente novamente.", { type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full mt-2 print:mt-1 animated-fade-in flex flex-col items-center">
      {onScanNext && (
        <div className="w-full max-w-sm mb-4 flex gap-2">
          <motion.button
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            onClick={onScanNext}
            className="flex-1 py-4 px-2 rounded-2xl text-sm sm:text-base font-black text-white bg-sky-600 hover:bg-sky-500 transition-all shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2"
          >
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" />
            Escanear
          </motion.button>
          <motion.button
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
            onClick={onReset}
            className="flex-1 py-4 px-2 rounded-2xl text-sm sm:text-base font-black text-slate-600 dark:text-slate-300 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all shadow-xl flex items-center justify-center gap-2"
          >
            <Keyboard className="w-5 h-5 sm:w-6 sm:h-6" />
            Digitar Cód.
          </motion.button>
        </div>
      )}

      {status === 'JUST_CHECKED_IN' && (
        <motion.div 
           initial={{ scale: 0.8, opacity: 0, rotateX: 15 }}
           animate={{ scale: 1, opacity: 1, rotateX: 0 }}
           transition={{ type: "spring", stiffness: 200, damping: 15 }}
           className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-emerald-50 dark:from-slate-900 dark:to-emerald-950/20 rounded-3xl shadow-2xl border border-emerald-400/50 mb-6 relative overflow-hidden"
        >
           {/* Beautiful background glow */}
           <div className="absolute inset-0 bg-emerald-400/10 blur-3xl rounded-full scale-150 animate-pulse"></div>
           
           <motion.div 
             initial={{ rotate: -180, scale: 0 }}
             animate={{ rotate: 0, scale: 1 }}
             transition={{ type: "spring", delay: 0.2, duration: 0.7, bounce: 0.5 }}
             className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)] mb-6 z-10 border-4 border-white dark:border-slate-800"
           >
              <CheckCircle className="w-12 h-12 text-white" />
           </motion.div>
           <motion.h2 
             initial={{ y: 10, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.4 }}
             className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white text-center z-10 tracking-tight"
           >
             Tudo Certo!
           </motion.h2>
           <motion.p 
             initial={{ y: 10, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.5 }}
             className="text-sm sm:text-base font-medium text-emerald-700 dark:text-emerald-400 mt-2 z-10 bg-emerald-100 dark:bg-emerald-900/40 px-4 py-2 rounded-xl text-center"
           >
             Acesso VIP Concedido
           </motion.p>
           <motion.p 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.6 }}
             className="text-sm text-slate-500 dark:text-slate-400 text-center mt-4 z-10 font-bold"
           >
             {member?.name}
           </motion.p>
        </motion.div>
      )}

      {status === "VALID" && member?.roles?.includes("VISITANTE") && !member?.roles?.some(r => r !== "VISITANTE") && !isAdminLogged && !isMyID ? (
        <div id="validation-card-capture" className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-8 border-2 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center animate-success-pop text-center space-y-6">
          <div>
            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Passe Visitante</h3>
            <p className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">{safeName}</p>
          </div>
          
          <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm">
            <QRCodeSVG
              value={`${cleanBaseUrl}?verify=${member.alphaCode}`}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>
          
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Código de Uso</p>
            <p className="text-xl font-black text-slate-700 dark:text-slate-300 tracking-[0.2em]">{member?.alphaCode}</p>
          </div>
        </div>
      ) : isMyID && status === "VALID" && member ? (
        <div
          id="validation-card-capture"
          className="w-full mb-4 max-w-[320px] sm:max-w-[600px] pointer-events-auto @container"
        >
          <div className="animate-success-pop flex flex-col items-center justify-center w-full">
            <div className="w-full aspect-[1.586/1] relative">
              <FajopaIDCard member={member} />
            </div>
            {/* Hidden node specifically optimized for exporting without 3D perspective issues */}
            <div id="export-card-node" style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none' }} className="print:static print:left-auto print:pointer-events-auto">
              <FajopaIDCard member={member} exportMode={true} />
            </div>

            <p className="text-[10px] text-slate-500 mt-5 font-semibold uppercase tracking-widest bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>{" "}
              Documento Estudantil Válido
            </p>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">
              Toque no cartão para girar e ver o verso.
            </p>
          </div>
        </div>
      ) : (
        <div
          id={!isMyID ? "validation-card-capture" : undefined}
          className={`result-card w-full max-w-sm ${status === "VALID" || status === "JUST_CHECKED_IN" || status === "PENDING" ? "animate-success-pop" : "animate-error-wobble"} bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 p-3 sm:p-8 rounded-2xl sm:rounded-[2rem] text-center relative overflow-hidden shadow-xl print:shadow-none print:bg-white print:text-black print:border-slate-300 ${
            status === "VALID" || status === "JUST_CHECKED_IN"
              ? "border-emerald-100 dark:border-emerald-500/50 shadow-emerald-500/10"
              : status === "INACTIVE" || status === "ALREADY_PRESENT" || status === "PENDING"
                ? "border-amber-100 dark:border-amber-500/50 shadow-amber-500/10"
                : "border-rose-100 dark:border-rose-500/50 shadow-rose-500/10"
          }`}
        >
          <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden mb-2 sm:mb-4 relative z-10 bg-slate-50 shadow-inner">
            <img
              src={avatarUrl}
              crossOrigin="anonymous"
              alt="Foto"
              className={`w-full h-full object-cover ${(status !== "VALID" && status !== "JUST_CHECKED_IN") && "grayscale"}`}
            />
          </div>

          <h2
            className={`text-base sm:text-xl font-black mb-0.5 sm:mb-1 uppercase tracking-widest flex items-center justify-center gap-1.5 ${status === "VALID" || status === "JUST_CHECKED_IN" ? "text-emerald-600 dark:text-emerald-400" : status === "INACTIVE" || status === "ALREADY_PRESENT" || status === "PENDING" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {(status === "VALID" || status === "JUST_CHECKED_IN") && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
              >
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
              </motion.div>
            )}
            {titleText}
          </h2>
          <p
            className={`text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-3 sm:mb-5 ${status === "VALID" || status === "JUST_CHECKED_IN" ? "text-emerald-500" : status === "INACTIVE" || status === "ALREADY_PRESENT" || status === "PENDING" ? "text-amber-500" : "text-rose-500"}`}
          >
            {subtitleText}
          </p>

          <div className="space-y-2 sm:space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 text-left">
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1 font-semibold">
                {status === "NOT_FOUND"
                  ? "Tentativa de Acesso"
                  : "Nome Completo"}
              </p>
              <p className="text-base sm:text-xl font-bold text-slate-800 dark:text-white leading-tight">
                {safeName}
              </p>
              {member?.ra && (
                <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                  RA: {member.ra}
                </p>
              )}
              {(isMyID || isAdminLogged) && member?.cpf && (
                <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                  CPF: {member.cpf}
                </p>
              )}
              {(isMyID || isAdminLogged) && member?.birthdate && (
                <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                  Nasc: {new Date(member.birthdate + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              )}
              {(isMyID || isAdminLogged) && member?.email && (
                <p className="text-[9px] font-medium text-slate-500 mt-0.5">
                  {member.email}
                </p>
              )}

              {member?.roles && member.roles.length > 0 && (
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {member.roles.map((r) => (
                    <span
                      key={r}
                      className="px-1.5 py-0.5 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 rounded text-[8px] uppercase border border-sky-200"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {member?.course && (
                <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">
                    Curso Matriculado
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-sky-600 dark:text-sky-400 uppercase mt-0.5">
                    {member.course}
                  </p>
                </div>
              )}
              {member?.seminary && (
                <div className="mt-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest font-semibold">
                    Seminário
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mt-0.5">
                    {member.seminary}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
              <div>
                <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest mb-0.5 font-semibold">
                  Status
                </p>
                <p
                  className={`text-[10px] sm:text-xs font-bold flex items-center gap-1 ${status === "VALID" || status === "JUST_CHECKED_IN" ? "text-emerald-600 dark:text-emerald-400" : status === "INACTIVE" || status === "ALREADY_PRESENT" || status === "PENDING" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                  ></span>{" "}
                  {badgeText}
                </p>
                {status !== "NOT_FOUND" && status !== "PENDING" && (
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {status === "EXPIRED" ? "Venceu a:" : "Vence a:"}{" "}
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {safeDate}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest mb-0.5 font-semibold">
                  Cód. Uso
                </p>
                <p className="text-[10px] font-mono text-slate-700 dark:text-slate-200 flex flex-col">
                  <span>{safeCode}</span>
                  {member?.diocese && (
                    <span className="text-[9px] text-sky-600 dark:text-sky-400 mt-1 font-sans font-bold">
                      DIOCESE: {member.diocese}
                    </span>
                  )}
                  {member && (
                    <span className="text-[7px] text-slate-400 mt-1 font-sans font-semibold">
                      FAJOPA
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`mt-3 p-2 rounded-xl border text-left ${
              status === "VALID" || status === "JUST_CHECKED_IN"
                ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-500/30"
                : status === "INACTIVE" || status === "ALREADY_PRESENT"
                  ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-500/30"
                  : "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-500/30"
            }`}
          >
            <p className="text-[9px] uppercase tracking-widest mb-0.5 font-semibold opacity-70">
              Detalhes
            </p>
            <p className="text-[10px] font-medium leading-tight">{descHtml}</p>
          </div>

          {status === "VALID" && (
            <div className="mt-3 px-2 py-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-500/20 rounded-xl text-left">
              <p className="text-[8px] uppercase tracking-widest mb-0.5 font-bold text-sky-600 dark:text-sky-400">
                Garantia Legal
              </p>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 font-medium leading-tight italic">
                Documento de identificação estudantil. Apresenta os dados
                requeridos pela Lei 12.933/2013 para comprovação de matrícula,
                sendo sua aceitação sujeita aos critérios dos organizadores de
                eventos.
              </p>
            </div>
          )}

          <div className="mt-3 inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400 text-[9px] font-mono">
              Processado em:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {timestampStr}
              </strong>
            </span>
          </div>

          {(status === "VALID" || status === "JUST_CHECKED_IN" || status === "PENDING") && member?.alphaCode && (
            <div
              className={`mt-3 flex flex-col items-center gap-1 bg-white p-2 rounded-xl w-fit mx-auto border-2 border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform active:scale-95`}
              onClick={() => setShowLargeQR(true)}
              title="Clique para ampliar o QR Code"
            >
              <QRCodeSVG
                value={`${cleanBaseUrl}?verify=${member.alphaCode}`}
                size={60}
                level="H"
                includeMargin={true}
              />
              <span className={`text-[8px] font-black text-slate-400 uppercase tracking-widest`}>
                {member.alphaCode}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full max-w-sm no-print print:hidden">
        <Modal
          isOpen={modalResetOpen}
          onClose={() => setModalResetOpen(false)}
          title="Nova Consulta"
          confirmLabel="Sim, Iniciar"
          onConfirm={onReset}
        >
          Deseja limpar os dados atuais e realizar uma nova leitura de QR Code
          ou consulta?
        </Modal>

        <Modal
          isOpen={showExportSuccess}
          onClose={() => setShowExportSuccess(false)}
          title="Download Concluído!"
          confirmLabel="Entendido"
          onConfirm={() => setShowExportSuccess(false)}
        >
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <Printer className="w-8 h-8" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Seu documento foi gerado com sucesso!
            </p>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Por favor, verifique a sua pasta de <strong>Downloads</strong> e
              abra o arquivo para visualizar ou imprimir.
            </p>
            {isMyID && (
              <p className="text-[10px] text-sky-500 mt-4 bg-sky-50 dark:bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-500/30">
                Dica: Em dispositivos móveis, o arquivo costuma aparecer nas
                notificações ou no app "Arquivos".
              </p>
            )}
          </div>
        </Modal>

        {member?.alphaCode && (
          <Modal
            isOpen={showLargeQR}
            onClose={() => setShowLargeQR(false)}
            title="QR Code de Validação"
          >
            <div className="flex flex-col items-center justify-center p-4">
              <div className="bg-white p-4 rounded-3xl shadow-lg border-2 border-slate-200">
                <QRCodeSVG
                  value={`${cleanBaseUrl}?verify=${member.alphaCode}`}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="mt-6 text-sm font-bold text-slate-600 dark:text-slate-300 tracking-widest">
                {member.alphaCode}
              </p>
              <p className="mt-2 text-[10px] text-slate-400 text-center max-w-[200px]">
                Apresente este código para verificação de sua identidade.
              </p>
            </div>
          </Modal>
        )}
      </div>
      <div className="flex flex-col w-full max-w-sm mt-2 no-print print:hidden space-y-2">
        {isMyID && member?.alphaCode && (
           <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border-2 border-slate-200 dark:border-slate-800 mb-2 mt-2">
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">
                Escaneie-me
              </h3>
              <div className="bg-white p-2 rounded-xl border-2 border-slate-200">
                  <QRCodeSVG
                    value={`${cleanBaseUrl}?verify=${member.alphaCode}`}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
              </div>
              <span className="mt-3 text-xs font-black text-slate-400 uppercase tracking-widest break-all text-center">
                {member.alphaCode}
              </span>
           </div>
        )}
        {status === "NOT_ENROLLED" && onEnrollAndCheckIn && (
          <button
            onClick={onEnrollAndCheckIn}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Inscrever e Fazer Check-in
          </button>
        )}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <button
            onClick={() => setModalResetOpen(true)}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            Nova Consulta
          </button>
          <div className="flex gap-2 flex-1">
            {!isMyID && (
              <button
                onClick={handlePrint}
                className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                title="Imprimir"
              >
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className={`flex-1 flex justify-center items-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-colors ${
                status === "VALID" || status === "JUST_CHECKED_IN"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : status === "INACTIVE" || status === "ALREADY_PRESENT"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {exporting
                ? "..."
                : isMyID && status === "VALID"
                  ? "Baixar PDF"
                  : "Baixar Imagem"}
            </button>
          </div>
        </div>
      </div>

      {/* Print Footer - Hidden on screen, visible on print only */}
      {!isMyID && (
        <div
          className="hidden print:block w-full mt-6 opacity-80 text-center"
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
        >
          <div
            className="inline-flex flex-col items-center justify-center w-16 h-16 bg-white border-2 border-slate-800 rounded-xl mb-3 relative overflow-hidden align-middle"
            style={{ borderColor: "#000" }}
          >
            <svg viewBox="0 0 100 100" className="w-[60%] h-[60%] text-black">
              <path
                d="M50,5 L90,20 C90,60 75,85 50,95 C25,85 10,60 10,20 L50,5 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinejoin="round"
              />
              <path d="M50,32 L82,46 L50,60 L18,46 Z" fill="currentColor" />
              <path
                d="M30,52 L30,65 C40,75 60,75 70,65 L70,52 L50,60 Z"
                fill="currentColor"
                opacity="0.85"
              />
            </svg>
            <div className="absolute bottom-0.5 font-black text-[6px] tracking-widest text-black w-full text-center">
              DAVVERO System
            </div>
          </div>
          <p
            className="text-[10px] font-medium text-slate-800 font-mono text-center mx-auto max-w-[300px]"
            style={{ color: "#000" }}
          >
            ©2025 - Alison Fernando Rodrigues dos Santos
            <br />
            DAVVERO System. Todos os direitos reservados.
          </p>
        </div>
      )}
    </div>
  );
}
