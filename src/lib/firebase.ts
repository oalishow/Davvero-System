import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDoc,
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  updateDoc,
  setDoc,
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
      typeof window !== "undefined"
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : undefined,
  });
} catch (e: any) {
  if (e.message && e.message.includes('has already been called')) {
    dbInstance = getFirestore(app);
  } else {
    throw e;
  }
}
export const db = dbInstance;

export const auth = getAuth(app);
export const storage = getStorage(app);
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

export const updateEventStatus = async (eventId: string, status: string) => {
  try {
    const eventRef = doc(db, `artifacts/${appId}/public/data/events`, eventId);
    await updateDoc(eventRef, { status });
  } catch (e) {
    console.error("Error updating event status: ", e);
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

export const closeEvent = async (eventId: string) => {
  try {
    const { getDocs, query, where, collection, writeBatch } = await import("firebase/firestore");
    await updateEventStatus(eventId, "encerrado");

    const qAttendances = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("eventId", "==", eventId),
      where("status", "==", "presente")
    );
    const docSnap = await getDocs(qAttendances).catch(() => null);
    if (docSnap && !docSnap.empty) {
      const batch = writeBatch(db);
      docSnap.docs.forEach((d) => {
        batch.update(d.ref, { status: "apto_para_certificado" });
        const a: any = d.data();
        createNotification({
          recipientId: a.studentId,
          title: "Certificado Disponível",
          message: `Seu certificado está pronto para download.`,
          type: "certificado",
        }).catch(console.error);
      });
      await batch.commit();
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
): Promise<{ name: string; photoUrl: string | null; roles?: string[] }[]> => {
  try {
    const { collection, query, where, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(db, `artifacts/${appId}/public/data/attendances`),
      where("eventId", "==", eventId)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return [];
    
    const validStatuses = ["inscrito", "presente", "apto_para_certificado"];
    const validDocs = snap.docs.filter(d => validStatuses.includes(d.data().status));
    
    if (validDocs.length === 0) return [];
    
    const studentIds = validDocs.map(d => d.data().studentId);

    const membersSnap = await getDocs(
      query(collection(db, `artifacts/${appId}/public/data/students`)),
    );

    const subscribers: { name: string; photoUrl: string | null; roles?: string[] }[] = [];
    membersSnap.docs.forEach((d) => {
      if (studentIds.includes(d.id)) {
        const data = d.data();
        subscribers.push({
          name: data.name,
          photoUrl: data.photoUrl || null,
          roles: data.roles || [],
        });
      }
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
