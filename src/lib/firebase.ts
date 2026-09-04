import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import {
  Event,
  Attendance,
  Member,
  Availability,
  Appointment,
  Notification,
} from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAldUSOslWbr9sTvg0ePP-8K0A2eBOuHOg",
  authDomain: "banco-de-dados-fajopa.firebaseapp.com",
  projectId: "banco-de-dados-fajopa",
  storageBucket: "banco-de-dados-fajopa.appspot.com",
  messagingSenderId: "477906925599",
  appId: "1:477906925599:web:4cdd41bb61493c1b65bd2a",
  measurementId: "G-L236SXBHC4",
};

export const app = initializeApp(firebaseConfig);

// Modern DB initialization with persistent local cache
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache:
      typeof window !== "undefined" && typeof indexedDB !== "undefined"
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : undefined,
  });
} catch (e: any) {
  try {
    dbInstance = getFirestore(app);
  } catch (fallbackErr) {
    console.warn("Fallback to basic getFirestore:", fallbackErr);
    dbInstance = getFirestore(app);
  }
}
export const db = dbInstance;

export const auth = getAuth(app);
export const storage = getStorage(app);

// Safe messaging initialization
let messagingInstance = null;
if (typeof window !== "undefined") {
  try {
    if ("Notification" in window && "serviceWorker" in navigator) {
      messagingInstance = getMessaging(app);
    }
  } catch (e) {
    console.warn("[Firebase] Messaging não suportado ou desabilitado no ambiente atual:", e);
  }
}
export const messaging = messagingInstance;
setLogLevel("error");

export const appId = firebaseConfig.projectId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Helper to recursively remove undefined properties from an object/array
 * so Firestore array updates do not fail with "invalid nested entity".
 */
const removeUndefined = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Ensures a reliable anonymous login, checking if already authenticated
 */
export const loginAnon = async () => {
  return new Promise((resolve) => {
    // Use a timeout to avoid hanging forever if Firebase is stuck
    const timeout = setTimeout(() => {
      console.warn("Firebase Auth timeout");
      resolve(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        resolve(true);
      } else {
        try {
          await signInAnonymously(auth);
          resolve(true);
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          resolve(false);
        }
      }
    });
  });
};

/**
 * Tests the connection strictly with the server to ensure we are online
 */
export const testConnection = async () => {
  try {
    // Try to fetch a dummy doc strictly from server to verify link
    await getDocFromServer(doc(db, "artifacts", appId));
    return true;
  } catch (error: any) {
    // Missing permissions means we successfully reached the server!
    if (
      error?.code === "permission-denied" ||
      error?.message?.includes("Missing or insufficient permissions")
    ) {
      return true;
    }
    if (error?.message?.includes("offline") || error?.code === "unavailable") {
      console.warn("Firestore appears to be offline or unavailable.");
      return false;
    }
    // Other errors we can assume true for now to not block the app
    return true;
  }
};

export const updateEventStatus = async (eventId: string, status: string, extraFields: Record<string, any> = {}) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await updateDoc(eventRef, { status, ...extraFields });
  } catch (e) {
    console.error("Error updating event status: ", e);
    throw e;
  }
};

export const reopenEvent = async (eventId: string) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await updateDoc(eventRef, {
      status: "aberto",
      manuallyReopened: true,
      reopenedAt: new Date().toISOString()
    });
    console.log(`Event ${eventId} manually reopened.`);
  } catch (e) {
    console.error("Error reopening event: ", e);
    throw e;
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await updateDoc(eventRef, {
      status: "deleted",
      deletedAt: new Date().toISOString()
    });
    console.log(`Event ${eventId} soft-deleted successfully.`);
  } catch (e) {
    console.error("Error deleting event: ", e);
    throw e;
  }
};

export const restoreEvent = async (eventId: string) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    const { deleteField } = await import("firebase/firestore");
    await updateDoc(eventRef, {
      status: "aberto",
      deletedAt: deleteField()
    });
  } catch (e) {
    console.error("Error restoring event: ", e);
    throw e;
  }
};

export const permanentDeleteEvent = async (eventId: string) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    const { deleteDoc, getDocs, query, where, collection, writeBatch } = await import("firebase/firestore");
    await deleteDoc(eventRef);

    // Also delete all attendances for this event
    const qAttendances = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("eventId", "==", eventId)
    );
    const snap = await getDocs(qAttendances);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.error("Error permanently deleting event: ", e);
    throw e;
  }
};

export interface CloseEventOptions {
  releaseToAllRegistered?: boolean;
  sendNotifications?: boolean;
  settings?: any;
}

export const closeEvent = async (eventId: string, options: CloseEventOptions = { releaseToAllRegistered: false, sendNotifications: true }) => {
  try {
    const { getDoc, getDocs, query, where, collection, writeBatch } = await import("firebase/firestore");
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    
    // Obter dados do evento
    const eventSnap = await getDoc(eventRef).catch(() => null);
    const eventData = eventSnap?.data() as Event | undefined;

    const shouldReleaseToAll = options.releaseToAllRegistered ?? Boolean(eventData?.allowAllRegisteredCertificates || eventData?.certificateReleaseMode === "all_registered");
    const shouldNotify = options.sendNotifications ?? (eventData?.autoSendCertificatesOnClose !== false);

    await updateDoc(eventRef, {
      status: "encerrado",
      manuallyReopened: false,
      ...(options.releaseToAllRegistered !== undefined ? { allowAllRegisteredCertificates: options.releaseToAllRegistered } : {})
    });

    let qAttendances;
    if (shouldReleaseToAll) {
      qAttendances = query(
        collection(db, `artifacts/${appId}/public/data/attendances`),
        where("eventId", "==", eventId)
      );
    } else {
      qAttendances = query(
        collection(db, `artifacts/${appId}/public/data/attendances`),
        where("eventId", "==", eventId),
        where("status", "==", "presente")
      );
    }

    const docSnap = await getDocs(qAttendances).catch(() => null);
    if (docSnap && !docSnap.empty) {
      let currentBatch = writeBatch(db);
      let batchOps = 0;
      const eligibleStudentIds: string[] = [];

      for (const d of docSnap.docs) {
        const a: any = d.data();
        if (a.status !== "cancelado") {
          if (batchOps >= 450) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            batchOps = 0;
          }
          currentBatch.update(d.ref, { status: "apto_para_certificado" });
          batchOps++;
          if (a.studentId) {
            eligibleStudentIds.push(a.studentId);
          }
          if (shouldNotify) {
            createNotification({
              recipientId: a.studentId,
              title: "Certificado Disponível",
              message: `Seu certificado do evento "${eventData?.title || 'Acadêmico'}" está pronto para download.`,
              type: "certificado",
            }).catch(console.error);
          }
        }
      }
      if (batchOps > 0) {
        await currentBatch.commit();
      }

      // Disparar notificações Push e E-mails em massa se habilitado
      if (shouldNotify && eligibleStudentIds.length > 0) {
        (async () => {
          try {
            // 1. WebPush Notifications
            const targetSubscriptions: any[] = [];
            try {
              const subsSnap = await getDocs(collection(db, "push_subscriptions")).catch(() => null);
              if (subsSnap && !subsSnap.empty) {
                subsSnap.docs.forEach((d) => {
                  const data = d.data();
                  if (data?.subscription?.endpoint && eligibleStudentIds.includes(data.userId)) {
                    targetSubscriptions.push(data.subscription);
                  }
                });
              }

              const fcmSnap = await getDocs(collection(db, "fcm_tokens")).catch(() => null);
              if (fcmSnap && !fcmSnap.empty) {
                fcmSnap.docs.forEach((d) => {
                  const data = d.data();
                  if (data?.subscription?.endpoint && eligibleStudentIds.includes(data.userId)) {
                    if (!targetSubscriptions.some((s) => s.endpoint === data.subscription.endpoint)) {
                      targetSubscriptions.push(data.subscription);
                    }
                  }
                });
              }
            } catch (pErr) {
              console.warn("[closeEvent] Erro ao carregar subscrições de push:", pErr);
            }

            if (targetSubscriptions.length > 0) {
              fetch("/api/push/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: "Certificado Disponível 📜",
                  message: `Seu certificado do evento "${eventData?.title || 'Acadêmico'}" já está liberado para emissão no sistema!`,
                  url: "/?view=student&tab=certificates",
                  subscriptions: targetSubscriptions,
                }),
              }).catch((e) => console.warn("[closeEvent] Falha ao enviar WebPush:", e));
            }

            // 2. Disparo de E-mails aos participantes
            const { getCompiledEmail, sendEmailNotification } = await import("./emailService");
            const studentsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`)).catch(() => null);
            if (studentsSnap && !studentsSnap.empty) {
              const studentsMap = new Map<string, any>();
              studentsSnap.docs.forEach((doc) => {
                if (!doc.id.startsWith("_")) {
                  studentsMap.set(doc.id, doc.data());
                }
              });

              const originUrl = typeof window !== "undefined" ? window.location.origin : "https://davvero.netlify.app";
              const certHours = eventData?.hours ? `${eventData.hours}h` : "conforme regulamento";

              for (const studentId of eligibleStudentIds) {
                const student = studentsMap.get(studentId);
                if (student?.email && student.email.includes("@")) {
                  const compiled = getCompiledEmail({
                    templateKey: "certificateAvailableAttendee",
                    customTemplates: options.settings?.emailTemplates,
                    vars: {
                      name: student.name || "Participante",
                      eventTitle: eventData?.title || "Evento Acadêmico",
                      eventDate: eventData?.startDate ? new Date(eventData.startDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data do Evento",
                      hours: certHours,
                      email: student.email,
                      ra: student.ra || "",
                    },
                    settings: options.settings,
                    buttonUrl: `${originUrl}/?view=student&tab=certificates&eventId=${eventId}`,
                  });

                  await sendEmailNotification(
                    {
                      to: student.email,
                      subject: compiled.subject,
                      html: compiled.fullHtml,
                    },
                    options.settings?.smtpConfig
                  ).catch((emailErr) => console.warn(`[closeEvent] Falha ao enviar email para ${student.email}:`, emailErr));
                }
              }
            }
          } catch (notifErr) {
            console.error("[closeEvent] Erro no processamento de notificações de encerramento:", notifErr);
          }
        })();
      }
    }
  } catch (e) {
    console.error("Error closing event: ", e);
    throw e;
  }
};

export const createEvent = async (eventData: Omit<Event, "id">) => {
  try {
    const { collection, setDoc, doc } = await import("firebase/firestore");
    const eventId = "evt_" + Date.now().toString();
    const cleanData = Object.fromEntries(
      Object.entries(eventData).filter(([_, v]) => v !== undefined),
    );
    const eventItem = { ...cleanData, id: eventId } as Event;

    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await setDoc(eventRef, eventItem);

    return eventId;
  } catch (e) {
    console.error("Error adding event: ", e);
    throw e;
  }
};

export const updateEvent = async (
  eventId: string,
  eventData: Partial<Omit<Event, "id">>,
) => {
  try {
    console.log(`Attempting to update event ${eventId}...`);
    const { doc, updateDoc } = await import("firebase/firestore");
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await updateDoc(eventRef, removeUndefined(eventData));
    console.log("Event updated successfully.");
  } catch (e) {
    console.error("Error updating event: ", e);
    throw e;
  }
};

export const enrollStudent = async (attendanceData: Omit<Attendance, "id">) => {
  try {
    const { doc, setDoc, collection, getDoc } = await import("firebase/firestore");
    const attendanceId = "att_" + Date.now().toString();
    const attendanceRef = doc(collection(db, `artifacts/${appId}/public/data/attendances`), attendanceId);

    const cleanData = Object.fromEntries(
      Object.entries(attendanceData).filter(([_, v]) => v !== undefined),
    );
    const attendanceItem = { ...cleanData, id: attendanceId } as Attendance;

    // Optional constraint check, but not blocking offline local save.
    // If offline, getDoc will serve from cache or fail fast. we can just setDoc directly.
    try {
      const eventRef = doc(db, `artifacts/${appId}/public/data/events`, attendanceData.eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const eventInfo = eventDoc.data() as Event;
        // Verify constraint quickly 
        if (eventInfo.status === "deleted") throw new Error("EVENTO_EXCLUIDO");
      }
    } catch(err) {
       // if offline, proceed
    }

    await setDoc(attendanceRef, attendanceItem);

    // Notificar o aluno
    await createNotification({
      recipientId: attendanceData.studentId,
      title: "Inscrição Confirmada",
      message: `Sua inscrição no evento foi confirmada com sucesso!`,
      type: "inscricao",
    });

    return attendanceId;
  } catch (e) {
    console.error("Error adding attendance: ", e);
    throw e;
  }
};

export const updateAttendanceStatus = async (
  attendanceId: string,
  status: "inscrito" | "presente",
  dateString?: string,
) => {
  try {
    const { doc, updateDoc, arrayUnion } = await import("firebase/firestore");
    const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, attendanceId);
    
    if (status === "presente" && dateString) {
      await updateDoc(attRef, { 
        status, 
        checkInDates: arrayUnion(dateString) 
      });
    } else {
      await updateDoc(attRef, { status });
    }
  } catch (e: any) {
    if (e.code !== 'not-found' && !e.message?.includes('No document to update')) {
      console.error("Error updating attendance status: ", e);
    }
    throw e;
  }
};

export const removeAttendancePresence = async (
  attendanceId: string,
  dateString?: string,
) => {
  try {
    const { doc, updateDoc, arrayRemove, getDoc } = await import("firebase/firestore");
    const attRef = doc(db, `artifacts/${appId}/public/data/attendances`, attendanceId);
    
    if (dateString) {
      // Remover a data específica
      await updateDoc(attRef, {
        checkInDates: arrayRemove(dateString),
      });
      // Verificar se ainda existem datas, se não, voltar status para "inscrito"
      const snap = await getDoc(attRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.checkInDates || data.checkInDates.length === 0) {
          await updateDoc(attRef, { status: "inscrito" });
        }
      }
    } else {
      // Fallback antigo
      await updateDoc(attRef, { 
        status: "inscrito",
        checkInDates: [] 
      });
    }
  } catch (e: any) {
    if (e.code !== 'not-found' && !e.message?.includes('No document to update')) {
      console.error("Error removing attendance presence: ", e);
    }
    throw e;
  }
};

export const updateAttendanceDetails = async (
  eventId: string,
  studentId: string,
  updates: Partial<Attendance>,
) => {
  try {
    const { collection, query, where, getDocs, updateDoc, setDoc, doc } = await import("firebase/firestore");
    const attsRef = collection(db, `artifacts/${appId}/public/data/attendances`);
    const q = query(attsRef, where("eventId", "==", eventId), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, removeUndefined(updates));
      return true;
    } else {
      const attendanceId = "att_" + Date.now().toString() + "_" + Math.floor(Math.random() * 1000);
      const newAttendance: Attendance = {
        id: attendanceId,
        eventId,
        studentId,
        status: "inscrito",
        timestamp: new Date().toISOString(),
        ...updates,
      };
      await setDoc(doc(attsRef, attendanceId), removeUndefined(newAttendance));
      return true;
    }
  } catch (e) {
    console.error("Error updating attendance details: ", e);
    throw e;
  }
};

export const unsubscribeFromEvent = async (
  eventId: string,
  studentId: string,
) => {
  try {
    const { collection, query, where, getDocs, deleteDoc } = await import("firebase/firestore");
    const attsRef = collection(db, `artifacts/${appId}/public/data/attendances`);
    const q = query(attsRef, where("eventId", "==", eventId), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      await deleteDoc(snap.docs[0].ref);
      return true;
    } else {
      console.warn("Inscrição não encontrada para cancelamento.");
      return false;
    }
  } catch (error) {
    console.error("Erro ao cancelar inscrição no Firebase:", error);
    throw error;
  }
};

export const getEventSubscribers = async (
  eventId: string,
): Promise<{ name: string; photoUrl: string | null; roles?: string[]; status?: string }[]> => {
  try {
    const { collection, query, where, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("eventId", "==", eventId)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return [];
    
    // Filter out canceled attendances
    const validDocs = snap.docs.filter(d => {
      const st = String(d.data().status || "inscrito").toLowerCase().trim();
      return st !== "cancelado";
    });
    
    if (validDocs.length === 0) return [];
    
    // Fetch students list for full profile details
    let membersDict: Record<string, any> = {};
    try {
      const membersSnap = await getDocs(
        query(collection(db, `artifacts/${appId}/public/data/students`)),
      );
      membersSnap.docs.forEach((d) => {
        membersDict[d.id] = d.data();
      });
    } catch (errMembers) {
      console.warn("Could not fetch students collection for subscribers:", errMembers);
    }

    const subscribers: { name: string; photoUrl: string | null; roles?: string[]; status?: string }[] = [];
    const seenStudentIds = new Set<string>();

    validDocs.forEach((d) => {
      const attData = d.data();
      const sId = attData.studentId || d.id;
      if (seenStudentIds.has(sId)) return;
      seenStudentIds.add(sId);

      const member = membersDict[sId];
      const name = (
        member?.name ||
        attData.studentName ||
        attData.memberName ||
        attData.name ||
        attData.guestName ||
        "Participante"
      ).trim();

      subscribers.push({
        name,
        photoUrl: member?.photoUrl || attData.photoUrl || null,
        roles: member?.roles || attData.roles || (attData.isVisitor ? ["VISITANTE"] : []),
        status: attData.status || "inscrito",
      });
    });

    return subscribers;
  } catch (e) {
    console.error("Error fetching event subscribers: ", e);
    return [];
  }
};

export const registerVisitor = async (name: string, cpf?: string) => {
  try {
    const cleanCPF = cpf ? cpf.replace(/\D/g, "") : "";
    if (cleanCPF) {
      const existingMember = await getMemberByCPF(cleanCPF);
      if (existingMember) {
        throw new Error("Membro ou visitante já cadastrado com este CPF.");
      }
    }

    const newVisitor: Omit<Member, "id"> = {
      name,
      cpf: cleanCPF,
      roles: ["VISITANTE"],
      isActive: true,
      status: "VALID",
      alphaCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    // We add and get the document
    const { addDoc, collection } = await import("firebase/firestore");
    const docRef = await addDoc(
      collection(db, `artifacts/${appId}/public/data/students`),
      newVisitor,
    );

    // Notify admins
    await createNotification({
      recipientId: "admin",
      title: "Novo Visitante",
      message: `O visitante ${name} foi cadastrado.`,
      type: "visitante",
    });

    return { ...newVisitor, id: docRef.id } as Member;
  } catch (error) {
    console.error("Erro ao registrar visitante:", error);
    throw error;
  }
};

export const getMemberByCPF = async (cpf: string): Promise<Member | null> => {
  if (!cpf) return null;
  const cleanCPF = cpf.replace(/\D/g, "");
  if (!cleanCPF) return null;
  const formattedCPF = cleanCPF.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4",
  );

  try {
    const { getDocs, query, collection, where } =
      await import("firebase/firestore");

    const searchValues = Array.from(new Set([cpf, cleanCPF, formattedCPF])).filter(Boolean);
    // First try standard CPF and RA concurrently
    const qCpf = query(
      collection(db, `artifacts/${appId}/public/data/students`),
      where("cpf", "in", searchValues),
    );

    // Fallback: Check if they stored CPF in the RA field
    const qRa = query(
      collection(db, `artifacts/${appId}/public/data/students`),
      where("ra", "in", searchValues),
    );

    const [snapCpf, snapRa] = await Promise.all([getDocs(qCpf), getDocs(qRa)]);

    if (!snapCpf.empty) {
      const doc = snapCpf.docs[0];
      return { ...doc.data(), id: doc.id } as Member;
    }
    
    if (!snapRa.empty) {
      const doc = snapRa.docs[0];
      return { ...doc.data(), id: doc.id } as Member;
    }

    return null;
  } catch (error) {
    console.error("Erro ao buscar visitante por CPF:", error);
    return null;
  }
};

export const findMemberByCPF = getMemberByCPF;

export const createNotification = async (
  notification: Omit<Notification, "id" | "createdAt" | "read">,
) => {
  try {
    const { collection, addDoc, serverTimestamp } =
      await import("firebase/firestore");
    const notificationsRef = collection(
      db,
      `artifacts/${appId}/public/data/notifications`,
    );

    await addDoc(notificationsRef, {
      ...notification,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (
      error?.code !== "permission-denied" &&
      !error?.message?.includes("Missing or insufficient permissions")
    ) {
      console.error("Erro ao criar notificação:", error);
    }
  }
};

export const markNotificationAsRead = async (notificationId: string, isBroadcast: boolean = false) => {
  try {
    if (isBroadcast) {
      const localReads = JSON.parse(localStorage.getItem('davveroId_broadcast_reads') || '[]');
      if (!localReads.includes(notificationId)) {
        localReads.push(notificationId);
        localStorage.setItem('davveroId_broadcast_reads', JSON.stringify(localReads));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new globalThis.Event('davveroId_notifs_local_update'));
        }
      }
      return;
    }

    const { doc, updateDoc } = await import("firebase/firestore");
    const notificationRef = doc(
      db,
      `artifacts/${appId}/public/data/notifications`,
      notificationId,
    );
    await updateDoc(notificationRef, { read: true });
  } catch (error: any) {
    if (
      error?.code !== "permission-denied" &&
      !error?.message?.includes("Missing or insufficient permissions")
    ) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  }
};

export const clearNotification = async (notificationId: string, isBroadcast: boolean = false) => {
  try {
    if (isBroadcast) {
      const localCleared = JSON.parse(localStorage.getItem('davveroId_cleared_notifs') || '[]');
      if (!localCleared.includes(notificationId)) {
        localCleared.push(notificationId);
        localStorage.setItem('davveroId_cleared_notifs', JSON.stringify(localCleared));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new globalThis.Event('davveroId_notifs_local_update'));
        }
      }
      return;
    }
    const { doc, deleteDoc } = await import("firebase/firestore");
    const notificationRef = doc(
      db,
      `artifacts/${appId}/public/data/notifications`,
      notificationId,
    );
    await deleteDoc(notificationRef);
  } catch (error: any) {
    if (
      error?.code !== "permission-denied" &&
      !error?.message?.includes("Missing or insufficient permissions")
    ) {
      console.error("Erro ao limpar notificação:", error);
    }
  }
};

export const clearAllNotifications = async (recipientId: string) => {
  try {
    const { collection, query, where, getDocs, writeBatch } =
      await import("firebase/firestore");
    const notificationsRef = collection(
      db,
      `artifacts/${appId}/public/data/notifications`,
    );
    // Handle specific user notifications
    const qUser = query(
      notificationsRef,
      where("recipientId", "==", recipientId)
    );
    const snapUser = await getDocs(qUser);
    if (!snapUser.empty) {
      const batch = writeBatch(db);
      snapUser.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    
    // Also mark ALL broadcasts as cleared locally for this browser
    const qTodos = query(
      notificationsRef,
      where("recipientId", "==", "todos")
    );
    const snapTodos = await getDocs(qTodos);
    if (!snapTodos.empty) {
      const localCleared = JSON.parse(localStorage.getItem('davveroId_cleared_notifs') || '[]');
      let changed = false;
      snapTodos.docs.forEach(d => {
        if (!localCleared.includes(d.id)) {
          localCleared.push(d.id);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('davveroId_cleared_notifs', JSON.stringify(localCleared));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new globalThis.Event('davveroId_notifs_local_update'));
        }
      }
    }
  } catch (error: any) {
    if (
      error?.code !== "permission-denied" &&
      !error?.message?.includes("Missing or insufficient permissions")
    ) {
      console.error("Erro ao limpar todas notificações:", error);
    }
  }
};

export const markAllNotificationsAsRead = async (recipientId: string) => {
  try {
    const { collection, query, where, getDocs, writeBatch } =
      await import("firebase/firestore");
    const notificationsRef = collection(
      db,
      `artifacts/${appId}/public/data/notifications`,
    );
    const q = query(
      notificationsRef,
      where("recipientId", "==", recipientId),
      where("read", "==", false),
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  } catch (error: any) {
    if (
      error?.code !== "permission-denied" &&
      !error?.message?.includes("Missing or insufficient permissions")
    ) {
      console.error("Erro ao marcar todas notificações como lidas:", error);
    }
  }
};
export const bookAppointment = async (
  availabilityId: string,
  memberId: string,
  notes?: string,
): Promise<Appointment> => {
  const availabilityRef = doc(
    db,
    `artifacts/${appId}/public/data/availabilities`,
    availabilityId,
  );
  const appointmentsRef = collection(
    db,
    `artifacts/${appId}/public/data/appointments`,
  );

  return await runTransaction(db, async (transaction) => {
    // 1. Ler a disponibilidade
    const availabilityDoc = await transaction.get(availabilityRef);
    if (!availabilityDoc.exists()) {
      throw new Error("Disponibilidade não encontrada.");
    }

    const availability = availabilityDoc.data() as Availability;

    // 2. Verificar se está LIVRE
    if (availability.status !== "LIVRE") {
      throw new Error("Este horário já não está mais disponível.");
    }

    // 3. Marcar disponibilidade como OCUPADA
    transaction.update(availabilityRef, {
      status: "OCUPADO",
      updatedAt: new Date().toISOString(),
    });

    // 4. Criar o agendamento (Appointment)
    const appointmentDocRef = doc(appointmentsRef); // Gera um novo UUID
    const newAppointment: Appointment = {
      id: appointmentDocRef.id,
      availabilityId: availabilityId,
      memberId: memberId,
      professionalId: availability.professionalId,
      date: availability.date,
      startTime: availability.startTime,
      status: "CONFIRMADO",
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    transaction.set(appointmentDocRef, newAppointment);

    return newAppointment;
  });
};
