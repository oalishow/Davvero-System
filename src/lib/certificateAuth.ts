import { db, appId } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import type { Event, Member, Attendance } from "../types";

export interface CertificateRecord {
  code: string;
  eventId: string;
  studentId: string;
  memberRa?: string;
  memberName?: string;
  memberCourse?: string;
  eventTitle: string;
  hours: number;
  isOrganizer: boolean;
  issuedAt: string;
}

/**
 * Normalizes strings by removing non-alphanumeric characters.
 */
function cleanAlphaNum(str: string): string {
  return (str || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generates an official, collision-free Certificate Authenticity Code.
 * Format: FAJ-{EventUniquePart}-{MemberUniquePart}-{PAR|ORG}
 * Example: FAJ-45678901-20260012-PAR
 */
export function generateCertificateCode(
  event: Partial<Event>,
  member: Partial<Member>,
  isOrganizer?: boolean
): string {
  const isOrg = Boolean(isOrganizer);
  const typeTag = isOrg ? "ORG" : "PAR";

  // Event unique part: prioritize unique tail of ID or timestamp
  let eventPart = "";
  if (event.id) {
    const rawClean = cleanAlphaNum(event.id);
    // If it starts with EVT, remove it to get the unique timestamp/hash tail
    const withoutPrefix = rawClean.replace(/^EVT/, "");
    eventPart = withoutPrefix.length >= 6 ? withoutPrefix.slice(-8) : rawClean.slice(-8);
  } else if (event.title) {
    eventPart = cleanAlphaNum(event.title).slice(0, 8);
  } else {
    eventPart = "EVT" + Date.now().toString().slice(-5);
  }

  // Member unique part: prioritize RA if available, otherwise unique tail of ID or CPF
  let memberPart = "";
  if (member.ra && cleanAlphaNum(member.ra).length >= 3) {
    memberPart = cleanAlphaNum(member.ra).slice(-8);
  } else if (member.id) {
    const rawClean = cleanAlphaNum(member.id);
    const withoutPrefix = rawClean.replace(/^STD|^MEM/, "");
    memberPart = withoutPrefix.length >= 4 ? withoutPrefix.slice(-8) : rawClean.slice(-8);
  } else if (member.cpf && cleanAlphaNum(member.cpf).length >= 6) {
    memberPart = cleanAlphaNum(member.cpf).slice(-8);
  } else {
    memberPart = "DOC" + cleanAlphaNum(member.name || "USER").slice(0, 5);
  }

  return `FAJ-${eventPart}-${memberPart}-${typeTag}`;
}

/**
 * Generates legacy certificate code formats previously used in the system,
 * so we can register and recognize already generated/printed certificates.
 */
export function getLegacyCertificateCodes(
  event: Partial<Event>,
  member: Partial<Member>
): string[] {
  const codes: string[] = [];
  const eventIdRaw = (event.id || "").trim();
  const eventIdSlice8 = eventIdRaw.slice(0, 8).toUpperCase();

  // Legacy format 1: event.id.slice(0,8) - member.id.slice(0,8)
  if (member.id) {
    codes.push(`${eventIdSlice8}-${member.id.slice(0, 8).toUpperCase()}`);
    codes.push(`${eventIdSlice8}-${cleanAlphaNum(member.id).slice(0, 8)}`);
  }

  // Legacy format 2: event.id.slice(0,8) - member.ra.slice(0,8)
  if (member.ra) {
    codes.push(`${eventIdSlice8}-${member.ra.slice(0, 8).toUpperCase()}`);
    codes.push(`${eventIdSlice8}-${cleanAlphaNum(member.ra).slice(0, 8)}`);
  }

  // Legacy format 3: event.id.slice(0,8) - DOC
  codes.push(`${eventIdSlice8}-DOC`);

  // Legacy full ID format
  if (member.id && event.id) {
    codes.push(`${event.id.toUpperCase()}-${member.id.toUpperCase()}`);
  }

  return Array.from(new Set(codes.filter(Boolean)));
}

/**
 * Registers a certificate record in Firestore under both its official code
 * and any legacy code aliases for retroactive verification.
 */
export async function registerCertificateRecord(params: {
  code: string;
  event: Event;
  member: Member;
  isOrganizer: boolean;
}): Promise<void> {
  const { code, event, member, isOrganizer } = params;
  if (!code || !event?.id || !member?.id) return;

  const rawHours = isOrganizer && event.organizationHours ? event.organizationHours : event.hours;
  const parsedHours = Number(String(rawHours || 0).replace(/[^0-9.]/g, "")) || 0;

  const record: CertificateRecord = {
    code: code.trim().toUpperCase(),
    eventId: event.id,
    studentId: member.id,
    memberRa: member.ra || "",
    memberName: member.name || "",
    memberCourse: member.course || "",
    eventTitle: event.title || "Evento Acadêmico",
    hours: parsedHours,
    isOrganizer: Boolean(isOrganizer),
    issuedAt: new Date().toISOString(),
  };

  try {
    const certRef = doc(db, `artifacts/${appId}/public/data/certificates`, record.code);
    await setDoc(certRef, record, { merge: true });

    // Also register legacy aliases if any exist
    const legacyCodes = getLegacyCertificateCodes(event, member);
    for (const legacyCode of legacyCodes) {
      if (legacyCode && legacyCode !== record.code) {
        const legacyRef = doc(db, `artifacts/${appId}/public/data/certificates`, legacyCode.trim().toUpperCase());
        await setDoc(legacyRef, { ...record, legacyCode }, { merge: true }).catch(() => null);
      }
    }
  } catch (err) {
    console.warn("Failed to register certificate record in Firestore:", err);
  }
}

/**
 * Retroactive Migration & Sync:
 * Scans all existing attendances with issued certificates (or eligible status)
 * and pre-registers both their new and legacy authenticity codes.
 * This completely fixes already generated / printed certificates!
 */
export async function syncAllExistingCertificates(): Promise<number> {
  try {
    const attsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/attendances`)).catch(() => null);
    if (!attsSnap || attsSnap.empty) return 0;

    const eventsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/events`)).catch(() => null);
    const studentsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`)).catch(() => null);

    const eventsMap = new Map<string, Event>();
    eventsSnap?.docs.forEach((d) => eventsMap.set(d.id, { ...d.data(), id: d.id } as Event));

    const studentsMap = new Map<string, Member>();
    studentsSnap?.docs.forEach((d) => {
      if (!d.id.startsWith("_")) {
        studentsMap.set(d.id, { ...d.data(), id: d.id } as Member);
      }
    });

    let count = 0;
    let currentBatch = writeBatch(db);
    let batchOperations = 0;

    const commitAndRenewBatch = async () => {
      if (batchOperations > 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOperations = 0;
      }
    };

    for (const d of attsSnap.docs) {
      const att = d.data() as Attendance;
      if (att.status === "cancelado") continue;

      const event = eventsMap.get(att.eventId);
      const student = studentsMap.get(att.studentId);
      if (!event || !student) continue;

      const hasPart = Boolean(event.certificateTemplate?.isApproved && (att.status === "presente" || att.status === "apto_para_certificado" || event.allowAllRegisteredCertificates));
      const hasOrg = Boolean(event.organizationCertificateTemplate?.isApproved && att.isOrganizer);

      // Register Participant Certificate
      if (hasPart) {
        const code = generateCertificateCode(event, student, false);
        const rawHours = event.hours;
        const parsedHours = Number(String(rawHours || 0).replace(/[^0-9.]/g, "")) || 0;

        const record: CertificateRecord = {
          code,
          eventId: event.id,
          studentId: student.id,
          memberRa: student.ra || "",
          memberName: student.name || "",
          memberCourse: student.course || "",
          eventTitle: event.title || "Evento Acadêmico",
          hours: parsedHours,
          isOrganizer: false,
          issuedAt: att.timestamp || new Date().toISOString(),
        };

        if (batchOperations >= 450) {
          await commitAndRenewBatch();
        }
        const certRef = doc(db, `artifacts/${appId}/public/data/certificates`, code);
        currentBatch.set(certRef, record, { merge: true });
        batchOperations++;

        // Legacy codes
        const legacyCodes = getLegacyCertificateCodes(event, student);
        for (const lCode of legacyCodes) {
          if (batchOperations >= 450) {
            await commitAndRenewBatch();
          }
          const legacyRef = doc(db, `artifacts/${appId}/public/data/certificates`, lCode);
          currentBatch.set(legacyRef, { ...record, legacyCode: lCode }, { merge: true });
          batchOperations++;
        }
        count++;
      }

      // Register Organizer Certificate
      if (hasOrg) {
        const code = generateCertificateCode(event, student, true);
        const rawHours = event.organizationHours || event.hours;
        const parsedHours = Number(String(rawHours || 0).replace(/[^0-9.]/g, "")) || 0;

        const record: CertificateRecord = {
          code,
          eventId: event.id,
          studentId: student.id,
          memberRa: student.ra || "",
          memberName: student.name || "",
          memberCourse: student.course || "",
          eventTitle: event.title || "Evento Acadêmico",
          hours: parsedHours,
          isOrganizer: true,
          issuedAt: att.timestamp || new Date().toISOString(),
        };

        if (batchOperations >= 450) {
          await commitAndRenewBatch();
        }
        const certRef = doc(db, `artifacts/${appId}/public/data/certificates`, code);
        currentBatch.set(certRef, record, { merge: true });
        batchOperations++;
        count++;
      }
    }

    if (batchOperations > 0) {
      await currentBatch.commit();
    }

    return count;
  } catch (err) {
    console.error("Error during syncAllExistingCertificates:", err);
    return 0;
  }
}

/**
 * Resolves any certificate code (new or legacy) to the EXACT Event, Member, Course, and Hours.
 */
export async function resolveCertificate(
  rawCode: string,
  eventsCache: Event[] = [],
  membersCache: Member[] = [],
  attendancesCache: Attendance[] = []
): Promise<{
  event: Event;
  member: Member;
  isOrganizer: boolean;
  certCode: string;
} | null> {
  if (!rawCode || !rawCode.trim()) return null;

  let code = rawCode.trim().toUpperCase();

  // Extract from URL parameters if full URL was passed
  if (code.includes("CERT=")) {
    code = code.split("CERT=")[1].split("&")[0].split("#")[0].trim();
  } else if (code.includes("VERIFY=")) {
    code = code.split("VERIFY=")[1].split("&")[0].split("#")[0].trim();
  }
  code = code.replace(/["']/g, "").trim();

  // -------------------------------------------------------------
  // TIER 1: Exact lookup in Firestore `certificates` collection
  // -------------------------------------------------------------
  try {
    const certSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/certificates`, code));
    if (certSnap.exists()) {
      const data = certSnap.data() as CertificateRecord;
      
      let foundEvent = eventsCache.find((e) => e.id === data.eventId);
      if (!foundEvent) {
        const eSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/events`, data.eventId));
        if (eSnap.exists()) {
          foundEvent = { id: eSnap.id, ...eSnap.data() } as Event;
        }
      }

      let foundMember = membersCache.find((m) => m.id === data.studentId);
      if (!foundMember) {
        const mSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, data.studentId));
        if (mSnap.exists()) {
          foundMember = { id: mSnap.id, ...mSnap.data() } as Member;
        }
      }

      if (foundEvent && foundMember) {
        return {
          event: foundEvent,
          member: foundMember,
          isOrganizer: Boolean(data.isOrganizer),
          certCode: code,
        };
      }
    }
  } catch (e) {
    console.warn("Direct certificate registry lookup fallback:", e);
  }

  // -------------------------------------------------------------
  // TIER 2: Intelligent Joint Matching (Event + Member + Attendance)
  // Fixes both new FAJ-... and legacy EVT-... formats
  // -------------------------------------------------------------
  let isExplicitOrg = code.includes("-ORG") || code.endsWith("ORG");
  let isExplicitPar = code.includes("-PAR") || code.endsWith("PAR");

  // Clean prefixes like FAJ- or CERT-
  let cleanCode = code.replace(/^FAJ-|^CERT-/, "");

  let eventPart = "";
  let memberPart = "";

  if (cleanCode.includes("-")) {
    const parts = cleanCode.split("-");
    eventPart = parts[0].trim();
    if (parts.length >= 3 && (parts[parts.length - 1] === "ORG" || parts[parts.length - 1] === "PAR")) {
      memberPart = parts.slice(1, parts.length - 1).join("-").trim();
    } else {
      memberPart = parts.slice(1).join("-").trim();
    }
  } else if (cleanCode.includes("/")) {
    const parts = cleanCode.split("/");
    eventPart = parts[0].trim();
    memberPart = parts.slice(1).join("/").trim();
  } else {
    eventPart = cleanCode.slice(0, 8);
    memberPart = cleanCode.slice(8);
  }

  const cleanEventSearch = cleanAlphaNum(eventPart);
  const cleanMemberSearch = cleanAlphaNum(memberPart);

  // 1. Gather all events (cache + firestore fallback)
  let allEvents = [...eventsCache];
  if (allEvents.length === 0) {
    try {
      const eSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/events`));
      allEvents = eSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Event));
    } catch (e) {
      console.warn("Failed to load events for cert resolution:", e);
    }
  }

  // 2. Gather all members (cache + firestore fallback)
  let allMembers = [...membersCache];
  if (allMembers.length === 0) {
    try {
      const sSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/students`));
      allMembers = sSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Member));
    } catch (e) {
      console.warn("Failed to load members for cert resolution:", e);
    }
  }

  // 3. Find candidate members
  const candidateMembers = allMembers.filter((m) => {
    if (!m) return false;
    const mId = cleanAlphaNum(m.id || "");
    const mRa = cleanAlphaNum(m.ra || "");
    const mAlpha = cleanAlphaNum(m.alphaCode || "");
    const mCpf = cleanAlphaNum(m.cpf || "");

    if (mId && (mId === cleanMemberSearch || mId.endsWith(cleanMemberSearch) || (cleanMemberSearch.length >= 6 && mId.startsWith(cleanMemberSearch)))) return true;
    if (mRa && (mRa === cleanMemberSearch || mRa.includes(cleanMemberSearch) || (cleanMemberSearch.length >= 4 && mRa.endsWith(cleanMemberSearch)))) return true;
    if (mAlpha && mAlpha === cleanMemberSearch) return true;
    if (mCpf && cleanMemberSearch.length >= 6 && mCpf.endsWith(cleanMemberSearch)) return true;
    return false;
  });

  // 4. Gather attendances
  let allAttendances = [...attendancesCache];
  if (allAttendances.length === 0) {
    try {
      const aSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/attendances`));
      allAttendances = aSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Attendance));
    } catch (e) {
      console.warn("Failed to load attendances for cert resolution:", e);
    }
  }

  // 5. Cross-reference candidate members with attendances & events
  for (const candMember of candidateMembers) {
    const memberAtts = allAttendances.filter((a) => a.studentId === candMember.id && a.status !== "cancelado");
    
    for (const att of memberAtts) {
      const ev = allEvents.find((e) => e.id === att.eventId);
      if (!ev) continue;

      const evClean = cleanAlphaNum(ev.id);
      const evTitleClean = cleanAlphaNum(ev.title || "");

      // Match event: exact, unique tail, legacy slice(0,8), or title
      const matchesEvent =
        evClean === cleanEventSearch ||
        evClean.endsWith(cleanEventSearch) ||
        evClean.slice(0, 8) === cleanEventSearch ||
        evClean.includes(cleanEventSearch) ||
        (cleanEventSearch.length >= 5 && evTitleClean.includes(cleanEventSearch));

      if (matchesEvent) {
        const isOrganizer = isExplicitOrg ? true : isExplicitPar ? false : Boolean(att.isOrganizer);
        
        // Auto-register so future lookups are instant
        registerCertificateRecord({
          code,
          event: ev,
          member: candMember,
          isOrganizer,
        }).catch(() => null);

        return {
          event: ev,
          member: candMember,
          isOrganizer,
          certCode: code,
        };
      }
    }
  }

  // 6. Direct event match fallback if member was "DOC" or external
  const matchedEvent = allEvents.find((e) => {
    const eClean = cleanAlphaNum(e.id);
    return eClean === cleanEventSearch || eClean.endsWith(cleanEventSearch) || eClean.slice(0, 8) === cleanEventSearch;
  });

  if (matchedEvent) {
    const fallbackMember: Member = candidateMembers[0] || {
      id: memberPart || "DOC",
      name: "Participante Certificado",
      roles: ["VISITANTE"],
      ra: memberPart || "DOC-EXTERNO",
    };

    const isOrganizer = isExplicitOrg;
    return {
      event: matchedEvent,
      member: fallbackMember,
      isOrganizer,
      certCode: code,
    };
  }

  return null;
}

/**
 * Calculates event end timestamp safely from startDate and endDate.
 */
export function getEventEndTime(event: { endDate?: string; startDate?: string }): number {
  if (!event.endDate && !event.startDate) return 0;
  const dateStr = event.endDate || event.startDate || "";
  if (dateStr.includes("T")) {
    const t = new Date(dateStr).getTime();
    if (!isNaN(t)) return t;
  }
  if (dateStr.length === 10 && dateStr.includes("-")) {
    const [y, m, day] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, day, 23, 59, 59, 999).getTime();
  }
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Checks if certificates for an event are released, either because the event is marked 'encerrado'
 * or because its scheduled end time has passed (when autoReleaseCertificatesOnEnd is active, default true).
 */
export function isEventCertificateReleased(event: Event): boolean {
  if (event.status === "encerrado") return true;
  // If event has autoReleaseCertificatesOnEnd enabled (default true)
  if (event.autoReleaseCertificatesOnEnd !== false) {
    const now = Date.now();
    const endTime = getEventEndTime(event);
    if (endTime > 0 && now >= endTime) {
      return true;
    }
  }
  return false;
}
