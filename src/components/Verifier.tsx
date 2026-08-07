import { useState, useEffect, useRef } from "react";
import { Camera, XCircle, Search, ScanLine, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { collection, query, getDocs } from "firebase/firestore";
import {
  db,
  appId,
  updateAttendanceStatus,
  enrollStudent,
  auth,
  registerVisitor,
  findMemberByCPF,
} from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { Member, Event, Attendance } from "../types";
import VerificationResult from "./VerificationResult";
import PublicRequestModal from "./PublicRequestModal";
import SuggestEditModal from "./SuggestEditModal";
import Modal from "./Modal";
import RegistrationSuccessModal from "./RegistrationSuccessModal";
import { useDialog } from "../context/DialogContext";
import { playSound } from '../lib/sounds';

import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { useSettings } from "../context/SettingsContext";

interface VerifierProps {
  externalCode?: string | null;
  onExternalVerified?: () => void;
}

export default function Verifier({
  externalCode,
  onExternalVerified,
}: VerifierProps) {
  const { showAlert } = useDialog();
  const { settings } = useSettings();
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  const [membersCache, setMembersCache] = useState<Member[]>([]);
  const [eventsCache, setEventsCache] = useState<Event[]>([]);
  const [attendancesCache, setAttendancesCache] = useState<Attendance[]>([]);
  const [verifyMode, setVerifyMode] = useState<"STANDARD" | "EVENT" | "VISITOR" | "CERTIFICATE">(
    "STANDARD",
  );
  const [visitorName, setVisitorName] = useState("");
  const [visitorCPF, setVisitorCPF] = useState("");
  const [visitorSearching, setVisitorSearching] = useState(false);
  const [visitorRegistering, setVisitorRegistering] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [pendingCheckins, setPendingCheckins] = useState<
    { attendanceId: string }[]
  >([]);
  const [validationResult, setValidationResult] = useState<{
    member: Member | null;
    status:
      | "VALID"
      | "INACTIVE"
      | "EXPIRED"
      | "NOT_FOUND"
      | "NOT_ENROLLED"
      | "ALREADY_PRESENT";
  } | null>(null);

  const [showPublicReq, setShowPublicReq] = useState(false);
  const [showRegistrationSuccessModal, setShowRegistrationSuccessModal] = useState(false);
  const [showSuggestEdit, setShowSuggestEdit] = useState(false);
  const [showRegisterTypeSelection, setShowRegisterTypeSelection] = useState(false);
  const [showVisitorRegisterModal, setShowVisitorRegisterModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [initialVerifyChecked, setInitialVerifyChecked] = useState(false);
  const [lastScannedDebug, setLastScannedDebug] = useState("");
  const [isAdminLogged, setIsAdminLogged] = useState(false);
  const [scanSuccessAnim, setScanSuccessAnim] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const scanHandledRef = useRef(false);

  useEffect(() => {
    if (validationResult) {
      if (validationResult.status === "VALID" || validationResult.status === "JUST_CHECKED_IN") {
        playSound('success');
      } else {
        playSound('error');
      }
    }
  }, [validationResult]);

  useEffect(() => {
    const checkAdmin = () => {
      const isMasterLogged =
        sessionStorage.getItem("adminMasterLogged") === "true";
      if (isMasterLogged) {
        setIsAdminLogged(true);
      }
    };
    checkAdmin();

    const unsub = onAuthStateChanged(auth, (user) => {
      const isMasterLogged =
        sessionStorage.getItem("adminMasterLogged") === "true";
      if ((user && !user.isAnonymous) || isMasterLogged) {
        setIsAdminLogged(true);
      } else {
        setIsAdminLogged(false);
        setVerifyMode("STANDARD");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (cacheLoaded && externalCode) {
      runVerification(externalCode, false);
      if (onExternalVerified) onExternalVerified();
    }
  }, [cacheLoaded, externalCode]);

  // Initialize pending checkins
  useEffect(() => {
    const pending = localStorage.getItem("davveroId_pending_checkins");
    if (pending) {
      setPendingCheckins(JSON.parse(pending));
    }

    const handleOnline = async () => {
      const pendingJson = localStorage.getItem("davveroId_pending_checkins");
      if (!pendingJson) return;
      const p = JSON.parse(pendingJson) as { attendanceId: string; dateString?: string }[];
      if (p.length === 0) return;

      let successes = 0;
      const newPending = [];
      for (const ci of p) {
        try {
          console.log("Attempting to update attendance:", ci.attendanceId, "Ref path:", `artifacts/${appId}/public/data/attendances/${ci.attendanceId}`);
          await updateAttendanceStatus(ci.attendanceId, "presente", ci.dateString);
          successes++;
        } catch (e: any) {
          const msg = e.message || "";
          if (e.code === 'not-found' || msg.includes("No document to update") || e.code === 'permission-denied') {
            // Document missing, drop it
            console.error("Sync error - dropping record (code: " + e.code + ", path: " + ci.attendanceId + "):", e);
          } else {
            console.error("Sync error - keeping record (code: " + e.code + "):", e);
            newPending.push(ci);
          }
        }
      }
      
      if (successes > 0 || newPending.length < p.length) {
        localStorage.setItem(
          "davveroId_pending_checkins",
          JSON.stringify(newPending),
        );
        setPendingCheckins(newPending);
        if (successes > 0) {
          showAlert(
            `${successes} check-in(s) sincronizado(s) com sucesso com o servidor.`,
            { type: 'success' }
          );
        }
      }
    };
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    // Populate cache for "offline fallback" strategy
    const loadCache = async (retries = 3) => {
      try {
        const qStudents = query(
          collection(db, `artifacts/${appId}/public/data/students`),
        );
        const qEvents = query(collection(db, `artifacts/${appId}/public/data/events`));
        const qAttendances = query(collection(db, `artifacts/${appId}/public/data/attendances`));
        
        const [studentSnap, eventSnap, attSnap] = await Promise.all([
          getDocs(qStudents), getDocs(qEvents), getDocs(qAttendances)
        ]);

        const allDocs = studentSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any,
        );

        const mList = allDocs
          .filter((d: any) => !d.id.startsWith("_"))
          .map((m: any) => {
            // Strip sensitive PII per LGPD
            const { cpf, birthDate, phone, address, email, ...safeMember } = m;
            return safeMember as Member;
          });

        const eList = eventSnap.docs.map(d => {
          const e = d.data() as Event;
          const { imageUrl, certificateTemplate, ...safeEvent } = e;
          const eProcessed = safeEvent as Event;
          
          const now = new Date().getTime();
          if (eProcessed.status === "aberto") {
            const checkDate = eProcessed.endDate ? new Date(eProcessed.endDate).getTime() : new Date(eProcessed.startDate).getTime();
            const GRACE_PERIOD = 24 * 60 * 60 * 1000; // 1 day
            if (checkDate + GRACE_PERIOD < now) {
               return { ...eProcessed, status: "encerrado" as any };
            }
          }
          return eProcessed;
        });
        const aList = attSnap.docs.map(d => d.data() as Attendance);

        setMembersCache(mList);
        setEventsCache(eList);
        setAttendancesCache(aList);

        try {
          localStorage.setItem("davveroId_offline_members", JSON.stringify(mList));
          localStorage.setItem("davveroId_offline_events", JSON.stringify(eList));
          localStorage.setItem("davveroId_offline_attendances", JSON.stringify(aList));
        } catch (storageError) {
          console.warn("Storage quota exceeded, could not save offline cache:", storageError);
        }

        setCacheLoaded(true);
      } catch (e) {
        console.error("Cache load error", e);
        if (retries > 0) {
          console.log(`Retrying cache load in 3s... (${retries} left)`);
          setTimeout(() => loadCache(retries - 1), 3000);
        } else {
          const mCache = localStorage.getItem("davveroId_offline_members");
          if (mCache) setMembersCache(JSON.parse(mCache));
          const eCache = localStorage.getItem("davveroId_offline_events");
          if (eCache) setEventsCache(JSON.parse(eCache));
          const aCache = localStorage.getItem("davveroId_offline_attendances");
          if (aCache) setAttendancesCache(JSON.parse(aCache));
          setCacheLoaded(true); // Stop loading spinner even if failed to allow manual entry
        }
      }
    };
    loadCache();
  }, []);

  useEffect(() => {
    if (cacheLoaded && !initialVerifyChecked) {
      const params = new URLSearchParams(window.location.search);
      const verifyCode = params.get("verify");

      // Ignore URL parsing for verification if the query params are only internal system params
      if (verifyCode) {
        runVerification(verifyCode, false, window.location.href);
      } else if (
        window.location.pathname.length > 1 &&
        window.location.pathname !== "/index.html" &&
        !window.location.pathname.includes("admin")
      ) {
        // Fallback for native camera opening legacy URL formats redirected to this domain
        // Only run if there is a real path segment (e.g. /XYZ123)
        runVerification(window.location.href, false, window.location.href);
      }
      setInitialVerifyChecked(true);
    }
  }, [cacheLoaded, initialVerifyChecked, membersCache]);

  const startScanner = async () => {
    scanHandledRef.current = false;
    setScanSuccessAnim(false);
    setIsScanning(true);
    setValidationResult(null);
  };

  useEffect(() => {
    let isActive = true;
    // We use any here since we avoid importing the type explicitly to save bundle size, but any works
    let ht5Qrcode: any = null;
    if (isScanning) {
      // Give more time for React to render and the DOM to settle on mobile
      const timer = setTimeout(() => {
        import("html5-qrcode").then((qrcodeModule: any) => {
          const { Html5Qrcode } = qrcodeModule;
          if (!isActive) return;

          // Avoid experimental BarCodeDetector which can be unstable on Safari/PWA
          ht5Qrcode = new Html5Qrcode("reader", { verbose: false });

          const config = {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdgePercentage = 0.75;
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
              return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0,
            disableFlip: false,
            // Adding videoConstraints explicitly for Safari
            videoConstraints: {
              facingMode: "environment",
            },
          };

          Html5Qrcode.getCameras().then((devices: any[]) => {
            if (!isActive) return;
            
            let cameraIdOrConfig: any = { facingMode: "environment" };
            
            if (devices && devices.length > 0) {
              const backCameras = devices.filter((d: any) => {
                const label = (d.label || "").toLowerCase();
                return label.includes("back") || label.includes("rear") || label.includes("traseira") || label.includes("environment") || label.includes("0");
              });
              
              if (backCameras.length > 0) {
                 // Try to avoid ultra-wide, macro, or telephoto which are not the "main" camera
                 const mainCamera = backCameras.find((d: any) => {
                    const label = (d.label || "").toLowerCase();
                    return !label.includes("ultra") && !label.includes("wide") && !label.includes("macro") && !label.includes("tele");
                 });
                 
                 const selectedCamera = mainCamera || backCameras[0];
                 cameraIdOrConfig = selectedCamera.id;
              } else if (devices.length > 1) {
                 // No label matched, commonly the last camera is the back camera on many devices
                 cameraIdOrConfig = devices[devices.length - 1].id;
              }
            }

            ht5Qrcode
              .start(
                cameraIdOrConfig,
                config,
                (decodedText: string) => {
                  console.log("Scanner: Detected code:", decodedText);
                  // Process the result immediately for responsiveness
                  let memberId = decodedText;
                  try {
                    console.log("Scanner: Attempting parsing...");
                    // More robust URL parameter extraction
                    if (decodedText.includes("verify=")) {
                      const parts = decodedText.split("verify=");
                      if (parts.length > 1) {
                        memberId = parts[1].split("&")[0].split("#")[0];
                      }
                    } else if (decodedText.startsWith("http")) {
                      const url = new URL(decodedText);
                      memberId = url.searchParams.get("verify") || decodedText;
                    }
                    console.log("Scanner: Extracted ID:", memberId);
                  } catch (e) {
                    console.error("Scanner: Parsing error:", e);
                    // Fallback to raw text if parsing fails
                    memberId = decodedText;
                  }

                  if (scanHandledRef.current) return;
                  scanHandledRef.current = true;
                  
                  // Trigger animation
                  playSound('scan');
                  setScanSuccessAnim(true);
                  // Wait for animation before verifying
                  setTimeout(() => {
                    setIsScanning(false);
                    setScanSuccessAnim(false);
                    runVerification(memberId, false, decodedText);

                    // Stop camera as cleanup
                    ht5Qrcode
                      ?.stop()
                      .catch((e: any) =>
                        console.error("Scanner: Error stopping camera:", e),
                      );
                  }, 1200);
                },
                (errorMessage: string) => {
                  // Usually we do silent failure for scanning, but for debugging we can log
                  // console.log("Scanner: Scan error (common):", errorMessage);
                },
              )
              .catch((err: any) => {
                console.error("Scanner: Camera start error:", err);
                // Inform user on serious failure
                if (
                  err?.toString().includes("NotAllowedError") ||
                  err?.toString().includes("Permission")
                ) {
                  showAlert("Permissão de câmera negada. É necessário autorizar a câmera para escanear QR Codes.", { type: "error" });
                } else if (err?.toString().includes("NotFoundError")) {
                  showAlert("Nenhuma câmera encontrada neste dispositivo.", { type: "error" });
                }
                setIsScanning(false);
              });
          }).catch((err: any) => {
            console.error("Error getting cameras", err);
            // Fallback if getCameras fails
            ht5Qrcode
              .start(
                { facingMode: "environment" },
                config,
                (decodedText: string) => {
                  let memberId = decodedText;
                  if (decodedText.includes("verify=")) memberId = decodedText.split("verify=")[1].split("&")[0].split("#")[0];
                  
                  if (scanHandledRef.current) return;
                  scanHandledRef.current = true;
                  
                  playSound('scan');
                  setScanSuccessAnim(true);
                  setTimeout(() => {
                    setIsScanning(false);
                    setScanSuccessAnim(false);
                    runVerification(memberId, false, decodedText);
                    ht5Qrcode?.stop().catch();
                  }, 1200);
                },
                () => {}
              )
              .catch(() => setIsScanning(false));
          });
        });
      }, 500);

      return () => {
        isActive = false;
        clearTimeout(timer);
        if (ht5Qrcode) {
          try {
            if (ht5Qrcode.isScanning) {
              ht5Qrcode.stop().catch(() => {});
            }
          } catch (e) {}
        }
      };
    }
  }, [isScanning]);

  const handleVerifyManual = () => {
    if (!codeInput) return;
    runVerification(codeInput.toUpperCase(), true);
  };

  const runVerification = async (
    idOrCode: string,
    isAlphaCode: boolean,
    rawScannedText?: string,
  ) => {
    setIsProcessing(true);
    setSuccessMsg("");

    // Using a shorter delay for better responsiveness
    setTimeout(async () => {
      const targetId = idOrCode.toUpperCase().trim();
      const rawTextUpper = (rawScannedText || idOrCode).toUpperCase().trim();

      const foundMember = membersCache.find((m) => {
        if (m.deletedAt || m.isApproved === false) return false;
        const alphaUpper = m.alphaCode?.toUpperCase().trim();
        const raUpper = m.ra?.toUpperCase().trim();
        const legacyUpper = m.legacyQrCode?.toUpperCase().trim();

        // Remove all whitespace/symbols for aggressive matching
        const sanitize = (str?: string) =>
          (str || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const rawSanitized = sanitize(rawScannedText || idOrCode);
        const legacySanitized = sanitize(m.legacyQrCode);

        let legacyExtractedId = legacyUpper;
        if (m.legacyQrCode) {
          try {
            if (m.legacyQrCode.includes("verify=")) {
              const parts = m.legacyQrCode.split("verify=");
              if (parts.length > 1) {
                legacyExtractedId = parts[1]
                  .split("&")[0]
                  .split("#")[0]
                  .toUpperCase()
                  .trim();
              }
            } else if (m.legacyQrCode.startsWith("http")) {
              const lUrl = new URL(m.legacyQrCode);
              const v = lUrl.searchParams.get("verify");
              if (v) legacyExtractedId = v.toUpperCase().trim();
            }
          } catch (_) {}
        }

        if (isAlphaCode) return alphaUpper === targetId || raUpper === targetId;

        // Multi-level matching strategy
        return (
          m.id === targetId ||
          m.legacyId === targetId ||
          alphaUpper === targetId ||
          raUpper === targetId ||
          (legacyExtractedId && legacyExtractedId === targetId) ||
          (legacyUpper && rawTextUpper === legacyUpper) ||
          (legacyUpper && legacyUpper.includes(targetId)) ||
          (legacyUpper && rawTextUpper.includes(legacyUpper)) ||
          (targetId.length > 4 &&
            legacyUpper &&
            legacyUpper.includes(targetId)) ||
          (rawTextUpper.length > 4 &&
            legacyUpper &&
            rawTextUpper.includes(legacyUpper)) ||
          (legacySanitized.length > 4 &&
            rawSanitized.includes(legacySanitized)) ||
          (legacySanitized.length > 4 && legacySanitized === rawSanitized)
        );
      });

      let finalMember = foundMember;

      if (!finalMember) {
        const onlyNumbers = idOrCode.replace(/\D/g, "");
        if (onlyNumbers.length === 11) {
          try {
            const byCpf = await findMemberByCPF(onlyNumbers);
            if (byCpf) {
              const { cpf, birthDate, phone, address, email, ...safeMember } = byCpf as any;
              finalMember = safeMember as Member;
            }
          } catch (e) {
            console.error("Error finding by CPF fallback:", e);
          }
        }
      }

      if (!finalMember) {
        setValidationResult({ member: null, status: "NOT_FOUND" });
        setIsProcessing(false);
        return;
      }

      if (verifyMode === "EVENT") {
        if (!selectedEventId) {
          showAlert("Selecione um evento para fazer o check-in.", { type: 'warning' });
          setIsProcessing(false);
          return;
        }

        const attendance = attendancesCache.find(
          (a) =>
            a.studentId === finalMember?.id && a.eventId === selectedEventId,
        );

        if (!attendance) {
          setValidationResult({ member: finalMember, status: "NOT_ENROLLED" });
          setIsProcessing(false);
          return;
        }

        const todayStr = new Date().toISOString().split("T")[0];
        
        if (attendance.status === "presente" && (!attendance.checkInDates || attendance.checkInDates.includes(todayStr))) {
          setValidationResult({
            member: finalMember,
            status: "ALREADY_PRESENT",
          });
          setIsProcessing(false);
          return;
        }

        try {
          // Attempt online update
          updateAttendanceStatus(attendance.id, "presente", todayStr).catch(() => {});
          setSuccessMsg("Check-in realizado com sucesso!");
        } catch (e) {
          // Ignored here, we just save to pending
        }

        // Always save offline logic for reliability and immediate feedback
        const savedPendingText = localStorage.getItem(
          "davveroId_pending_checkins",
        );
        const pList = savedPendingText ? JSON.parse(savedPendingText) : [];
        if (!pList.find((p: any) => p.attendanceId === attendance.id && p.dateString === todayStr)) {
          pList.push({ attendanceId: attendance.id, dateString: todayStr });
          localStorage.setItem(
            "davveroId_pending_checkins",
            JSON.stringify(pList),
          );
          setPendingCheckins(pList);
        }

        if (!navigator.onLine) {
          setSuccessMsg("Check-in salvo OFFLINE. Será enviado ao reconectar.");
        }

        const updatedAttendances = attendancesCache.map((a) =>
          a.id === attendance.id ? { ...a, status: "presente" as const, checkInDates: [...(a.checkInDates || []), todayStr] } : a,
        );
        setAttendancesCache(updatedAttendances);
        localStorage.setItem(
          "davveroId_offline_attendances",
          JSON.stringify(updatedAttendances),
        );

        setValidationResult({ member: finalMember, status: "JUST_CHECKED_IN" });
        setIsProcessing(false);
        return;
      }

      // @ts-ignore - finalMember could be undefined via ts logic, but we checked it above
      if (finalMember.isActive === false) {
        setValidationResult({ member: finalMember, status: "INACTIVE" });
        setIsProcessing(false);
        return;
      }

      // @ts-ignore
      if (!finalMember.validityDate) {
        setValidationResult({ member: finalMember, status: "EXPIRED" });
        setIsProcessing(false);
        return;
      }

      const isValid =
        // @ts-ignore
        new Date(finalMember.validityDate + "T23:59:59") >= new Date();
      setValidationResult({
        member: finalMember,
        status: isValid ? "VALID" : "EXPIRED",
      });
      setIsProcessing(false);
    }, 600); // Reduced delay from 1500 to 600ms
  };

  const handleSearchVisitorCPF = async () => {
    if (!visitorCPF.trim()) {
      showAlert("Preencha o CPF para buscar.", { type: 'warning' });
      return;
    }
    setVisitorSearching(true);
    try {
      const found = await findMemberByCPF(visitorCPF.trim());
      if (found) {
        if (!found.roles?.includes("VISITANTE")) {
          showAlert(`Encontramos um membro (${found.name}) que já possui cadastro como Aluno/Colaborador. Sugerimos a verificação via QR Code padrão.`, { type: 'info' });
        } else {
          setValidationResult({ member: found, status: "VALID" });
          setSuccessMsg("Visitante encontrado.");
        }
      } else {
        showAlert("Visitante não encontrado com este CPF.", { type: 'warning' });
      }
    } catch (e: any) {
      showAlert("Erro ao buscar visitante: " + e.message, { type: 'error' });
    } finally {
      setVisitorSearching(false);
    }
  };

  const handleRegisterVisitor = async () => {
    if (!visitorName.trim() || !visitorCPF.trim()) {
      showAlert("Preencha o nome e o CPF.", { type: 'warning' });
      return;
    }
    setVisitorRegistering(true);
    try {
      const newMember = await registerVisitor(visitorName.trim(), visitorCPF.trim());
      setSuccessMsg("Visitante cadastrado com sucesso!");
      showAlert(`Visitante cadastrado com sucesso!\n\nCódigo de Uso (AlphaCode): ${newMember?.alphaCode}`, { type: 'success' });
      setValidationResult({ member: newMember || null, status: "VALID" });
      setVisitorName("");
      setVisitorCPF("");
      setShowVisitorRegisterModal(false);
    } catch (e: any) {
      showAlert("Erro ao cadastrar visitante: " + e.message, { type: 'error' });
    } finally {
      setVisitorRegistering(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 animated-fade-in relative overflow-hidden">
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Radar Ring 1 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 border-2 border-sky-400/30 rounded-full"
          />
          {/* Radar Ring 2 */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1,
            }}
            className="absolute inset-0 border-2 border-emerald-400/30 rounded-full"
          />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-t-4 border-l-4 border-sky-500 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-8 border-b-4 border-r-4 border-emerald-500 rounded-full"
          />

          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <ScanLine className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            {/* Scanning Beam */}
            <motion.div
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 w-full h-[2px] bg-sky-400 shadow-[0_0_10px_#38bdf8] z-20 opacity-70"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-8 relative"
        >
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-sm font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest"
          >
            A consultar base de dados...
          </motion.p>
          <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-[0.2em]">
            Verificando Assinatura Digital
          </p>

          {/* Subtle glow underneath */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-8 bg-sky-400/10 blur-3xl rounded-full"></div>
        </motion.div>
      </div>
    );
  }

  if (validationResult) {
    return (
      <div className="w-full flex flex-col items-center pt-1 pb-4 px-2">
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-200">
            {successMsg}
          </div>
        )}
        <VerificationResult
          member={validationResult.member}
          status={validationResult.status}
          isAdminLogged={isAdminLogged}
          onReset={() => {
            setValidationResult(null);
            setCodeInput("");
            setSuccessMsg("");
          }}
          onEnrollAndCheckIn={async () => {
            if (!validationResult.member || !selectedEventId) return;
            try {
              setIsProcessing(true);
              const todayStr = new Date().toISOString().split("T")[0];
              await enrollStudent({
                eventId: selectedEventId,
                studentId: validationResult.member.id,
                status: "presente",
                checkInDates: [todayStr],
                timestamp: new Date().toISOString(),
              });
              // Add to cache to prevent second time
              setAttendancesCache((prev) => [
                ...prev,
                {
                  id: "att_local_" + Date.now(),
                  eventId: selectedEventId,
                  studentId: validationResult.member!.id,
                  status: "presente",
                  checkInDates: [todayStr],
                  timestamp: new Date().toISOString(),
                },
              ]);
              setSuccessMsg("");
              setValidationResult({
                member: validationResult.member,
                status: "JUST_CHECKED_IN",
              });
            } catch (e: any) {
              showAlert("Erro ao realizar inscrição: " + e.message, { type: 'error' });
            } finally {
              setIsProcessing(false);
            }
          }}
          onScanNext={() => {
            setValidationResult(null);
            setCodeInput("");
            setSuccessMsg("");
            startScanner();
          }}
        />
        {validationResult.member && validationResult.status !== "NOT_FOUND" && (
          <div className="mt-4 w-full max-w-sm px-1 no-print">
            <button
              onClick={() => setShowSuggestEdit(true)}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Sugerir Alteração / Correção
            </button>
          </div>
        )}

        {showSuggestEdit && validationResult.member && (
          <SuggestEditModal
            member={validationResult.member}
            onClose={() => setShowSuggestEdit(false)}
            onSubmitSuccess={() => {
              setShowSuggestEdit(false);
              setSuccessMsg("Sugestão enviada com sucesso! Em análise.");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 flex flex-col items-center space-y-6">
      {successMsg && (
        <div className="w-full max-w-sm p-3 bg-emerald-50 text-emerald-600 text-center text-sm font-medium rounded-xl border border-emerald-200">
          {successMsg}
        </div>
      )}

      <div className="w-full text-center">
        {/* Verify Mode Selector */}
        {!isScanning && verifyMode !== "CERTIFICATE" && (
          <div className={`w-full max-w-[600px] mx-auto grid ${isAdminLogged ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 max-w-[300px]"} gap-2 no-print p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700`}>
            <button
              onClick={() => setVerifyMode("STANDARD")}
              className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center ${verifyMode === "STANDARD" ? "bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400 border border-slate-200/50 dark:border-slate-600" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"}`}
            >
              Identidade
            </button>
            {isAdminLogged && (
              <>
                <button
                  onClick={() => setVerifyMode("EVENT")}
                  className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center ${verifyMode === "EVENT" ? "bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400 border border-slate-200/50 dark:border-slate-600" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"}`}
                >
                  Check-in Evento
                </button>
                <button
                  onClick={() => setVerifyMode("VISITOR")}
                  className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center ${verifyMode === "VISITOR" ? "bg-white dark:bg-slate-700 shadow-sm text-sky-600 dark:text-sky-400 border border-slate-200/50 dark:border-slate-600" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"}`}
                >
                  Visitante
                </button>
              </>
            )}
            <button
              onClick={() => {
                setVerifyMode("CERTIFICATE");
                setIframeLoaded(false);
              }}
              className={`py-2.5 px-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center ${verifyMode === "CERTIFICATE" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-600/50" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"}`}
            >
              Certificados
            </button>
          </div>
        )}

        {verifyMode === "EVENT" && !isScanning && isAdminLogged && (
          <div className="w-full max-w-sm mx-auto mb-4 text-left">
            <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
              Selecione o Evento
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">-- Escolha um evento --</option>
              {eventsCache
                .filter((e) => e.status === "aberto")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
            </select>
          </div>
        )}

        {verifyMode !== "VISITOR" && verifyMode !== "CERTIFICATE" && (
          <>
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl shadow-lg shadow-sky-600/30 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-sky-500 via-teal-400 to-sky-500 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Camera className="w-5 h-5" />
                Escanear QR Code
              </button>
            ) : (
               <button
                onClick={() => {
                  scanHandledRef.current = true;
                  setIsScanning(false);
                }}
                className="btn-modern w-full md:w-3/4 mx-auto flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-rose-500 border border-rose-300 hover:bg-rose-500 hover:text-white transition-colors dark:bg-rose-500/10 dark:border-rose-500/30"
              >
                <XCircle className="w-5 h-5" />
                Cancelar Escaneamento
              </button>
            )}
          </>
        )}
      </div>

      {verifyMode !== "VISITOR" && verifyMode !== "CERTIFICATE" && (
        <>
          <div className={`relative w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border-2 border-sky-400 dark:border-sky-500/30 aspect-square bg-black ${!isScanning && !scanSuccessAnim && "hidden"}`}>
            <div id="reader" className="w-full h-full"></div>
            
            {/* Custom Scanning Overlay */}
            {isScanning && !scanSuccessAnim && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="w-full h-full relative">
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_15px_3px_rgba(34,197,94,0.8)] animate-scan-laser" />
                    <div className="absolute top-6 left-6 w-16 h-16 border-t-4 border-l-4 border-sky-400 rounded-tl-xl transition-all duration-300" />
                    <div className="absolute top-6 right-6 w-16 h-16 border-t-4 border-r-4 border-sky-400 rounded-tr-xl transition-all duration-300" />
                    <div className="absolute bottom-6 left-6 w-16 h-16 border-b-4 border-l-4 border-sky-400 rounded-bl-xl transition-all duration-300" />
                    <div className="absolute bottom-6 right-6 w-16 h-16 border-b-4 border-r-4 border-sky-400 rounded-br-xl transition-all duration-300" />
                    <div className="absolute inset-0 bg-sky-500/10 mix-blend-overlay pointer-events-none" />
                  </div>
                </div>
            )}

            {/* Success Checkmark Overlay */}
            {scanSuccessAnim && (
               <div className="absolute inset-0 z-20 flex items-center justify-center transition-all duration-500 overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-md animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/40 via-transparent to-emerald-500/40 animate-scan-laser"></div>
                  
                  <div className="relative z-30 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-6 transform animate-qr-success-pop shadow-[0_0_50px_10px_rgba(16,185,129,0.6)] border-4 border-white/20">
                    <svg className="w-20 h-20 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" className="animate-stroke [stroke-dasharray:100] [stroke-dashoffset:100]" />
                    </svg>
                  </div>
               </div>
            )}
          </div>
          {isScanning && lastScannedDebug && !scanSuccessAnim && (
            <div className="mt-2 text-[10px] text-yellow-600 bg-yellow-50 p-2 rounded max-w-xs break-all">
              Debug (Last Read): {lastScannedDebug}
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center">
              <p className="mt-2 text-[10px] text-slate-500 font-medium animate-pulse text-center">
                Dica: Aproxime ou afaste a câmera para focar no código.
              </p>
            </div>
          )}

          {/* Main Form Area */}
          <div className="w-full max-w-md space-y-4">
            <div className="relative flex items-center py-2 w-full max-w-md">
              <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
              <span className="mx-4 text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-widest">
                Ou valide manualmente
              </span>
              <div className="flex-grow border-t border-slate-300 dark:border-slate-700/80"></div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
              <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                Código de Identificação ou RA
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyManual()}
                  placeholder="EX: A1B2C3 OU 123456"
                  className="input-modern flex-grow rounded-xl py-2.5 px-4 text-center font-mono tracking-widest uppercase text-sm sm:text-lg"
                />
                <button
                  onClick={handleVerifyManual}
                  className="btn-modern py-2.5 px-6 rounded-xl text-white font-bold bg-slate-800 hover:bg-sky-600 flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 dark:shadow-none transition-all"
                >
                  <Search className="w-4 h-4" /> Verificar
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowRegisterTypeSelection(true)}
              className="w-full btn-modern py-3.5 rounded-xl border border-sky-300 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sm font-semibold transition-all"
            >
              Primeiro Acesso? Solicitar/Cadastrar
            </button>
          </div>
        </>
      )}

      {verifyMode === "VISITOR" && (
        <div className="w-full flex justify-center text-center max-w-md mx-auto space-y-6">
           <div className="w-full bg-white dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg text-left relative overflow-hidden flex flex-col gap-6">
              
              <div className="space-y-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="text-center">
                   <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Buscar Visitante</h3>
                   <p className="text-xs text-slate-500 mb-2">Busque por CPF se o visitante já foi cadastrado no sistema antes, para gerar o QR Code de acesso.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={visitorCPF}
                    onChange={(e) => setVisitorCPF(e.target.value)}
                    placeholder="CPF do visitante"
                    className="flex-grow rounded-xl py-2.5 px-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleSearchVisitorCPF}
                    disabled={visitorSearching}
                    className="py-2.5 px-6 rounded-xl text-white font-bold bg-slate-800 hover:bg-sky-600 transition-colors disabled:opacity-50"
                  >
                    {visitorSearching ? "Buscando..." : "Buscar CPF"}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className="text-center">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Novo Visitante</h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Nota: Visitantes não geram a carteirinha.</p>
                 </div>
                 
                 <div className="space-y-3">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Nome Completo</label>
                     <input
                        type="text"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        placeholder="Nome do Visitante"
                        className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                      />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">CPF</label>
                     <input
                        type="text"
                        value={visitorCPF}
                        onChange={(e) => setVisitorCPF(e.target.value)}
                        placeholder="000.000.000-00 (Apenas os 11 números)"
                        className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                      />
                   </div>
                   
                   <button
                    onClick={handleRegisterVisitor}
                    disabled={visitorRegistering}
                    className="w-full py-3.5 rounded-xl text-white font-bold bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                   >
                     {visitorRegistering ? "Cadastrando..." : "Cadastrar e Visualizar QR"}
                   </button>
                 </div>
              </div>
              
           </div>
        </div>
      )}

      {verifyMode === "CERTIFICATE" && (
        <div className="w-full flex-col justify-center text-center max-w-6xl mx-auto space-y-4 min-h-[500px]">
          {settings.useGoogleScriptCertificate && settings.googleScriptCertificateUrl ? (
            <>
              <div className="flex justify-between items-center no-print">
                 <button
                   onClick={() => setVerifyMode("STANDARD")}
                   className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                 >
                   <ArrowLeft className="w-4 h-4" /> Voltar
                 </button>
                 <a 
                   href={settings.googleScriptCertificateUrl} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors"
                 >
                   Abrir em nova aba ↗
                 </a>
              </div>
              <div className="relative w-full h-[75vh] min-h-[600px] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden bg-white dark:bg-slate-800">
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 animate-pulse">Carregando sistema de verificações...</p>
                  </div>
                )}
                <iframe 
                  src={settings.googleScriptCertificateUrl} 
                  className={`w-full h-full transition-opacity duration-500 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                  title="Validação de Certificados"
                  allow="clipboard-read; clipboard-write; display-capture"
                  onLoad={() => setIframeLoaded(true)}
                />
              </div>
            </>
          ) : (
            <div className="w-full bg-white dark:bg-slate-800/40 p-10 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg text-center flex flex-col items-center justify-center">
               <p className="text-slate-500 font-medium mb-6">A validação por Google Script não está ativada nas configurações ou o link não foi fornecido.</p>
               <button 
                  onClick={() => setVerifyMode("STANDARD")}
                  className="btn-modern px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl"
               >
                 Voltar para Verificar Identidade
               </button>
            </div>
          )}
        </div>
      )}

      {showPublicReq && (
        <PublicRequestModal
          onClose={() => setShowPublicReq(false)}
          onSubmitSuccess={() => {
            setShowPublicReq(false);
            setShowRegistrationSuccessModal(true);
            playSound('success'); // Play positive sound on registration
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#0ea5e9', '#10b981', '#6366f1'] // sky, emerald, indigo
            });
          }}
        />
      )}

      {showRegistrationSuccessModal && (
        <RegistrationSuccessModal
          isOpen={showRegistrationSuccessModal}
          onClose={() => setShowRegistrationSuccessModal(false)}
        />
      )}

      {showRegisterTypeSelection && (
        <Modal
          isOpen={showRegisterTypeSelection}
          onClose={() => setShowRegisterTypeSelection(false)}
          title="Tipo de Cadastro"
          hideFooter
        >
          <div className="flex flex-col gap-4 py-4">
            <button
              onClick={() => {
                setShowRegisterTypeSelection(false);
                setShowPublicReq(true);
              }}
              className="p-4 rounded-2xl border-2 border-sky-100 dark:border-sky-500/30 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-500/10 text-left transition-all group"
            >
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">Sou Aluno/Colaborador</h3>
              <p className="text-xs text-slate-500 mt-1">Solicitar identidade digital institucional e carteirinha da FAJOPA.</p>
            </button>
            <button
              onClick={() => {
                setShowRegisterTypeSelection(false);
                setShowVisitorRegisterModal(true);
              }}
              className="p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-500/30 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-left transition-all group"
            >
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Sou Visitante</h3>
              <p className="text-xs text-slate-500 mt-1">Cadastrar para entrada em eventos. (Não gera carteirinha física).</p>
            </button>
          </div>
        </Modal>
      )}

      {showVisitorRegisterModal && (
        <Modal
          isOpen={showVisitorRegisterModal}
          onClose={() => setShowVisitorRegisterModal(false)}
          title="Cadastro de Visitante"
          confirmLabel="Cadastrar e Visualizar QR"
          onConfirm={handleRegisterVisitor}
          isConfirmValid={!visitorRegistering}
        >
          <div className="space-y-4 py-4 w-full">
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-bold mb-4">Nota: Visitantes não geram a carteirinha.</p>
            <div className="w-full text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Nome Completo *</label>
              <input
                type="text"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Nome do Visitante"
                className="w-full rounded-xl py-3 px-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              />
            </div>
            <div className="w-full text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">CPF *</label>
              <input
                type="text"
                value={visitorCPF}
                onChange={(e) => setVisitorCPF(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full rounded-xl py-3 px-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              />
            </div>
            {visitorRegistering && <p className="text-sm text-sky-600 font-bold text-center">Cadastrando...</p>}
          </div>
        </Modal>
      )}

      <div className="mt-8 text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 max-w-sm px-4 space-y-4">
        <div>
          <p className="font-bold mb-1 uppercase tracking-widest">
            Proteção de Dados (LGPD)
          </p>
          <p className="leading-relaxed">
            Os dados processados por este sistema são estritamente para fins de
            validação institucional, em total conformidade com a Lei Geral de
            Proteção de Dados (Lei nº 13.709/2018). Todos os dados processados
            via QR Code trafegam de forma segura e não partilhada.
          </p>
        </div>
        <div>
          <p className="font-bold mb-1 uppercase tracking-widest text-sky-600 dark:text-sky-400">
            Garantia de Meia-Entrada
          </p>
          <p className="leading-relaxed italic text-[10px] sm:text-xs">
            Documento de identificação estudantil. Apresenta os dados requeridos
            pela Lei 12.933/2013 para comprovação de matrícula, sendo sua
            aceitação sujeita aos critérios dos organizadores de eventos.
          </p>
        </div>
      </div>
    </div>
  );
}
