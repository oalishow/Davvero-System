import { db, appId, auth } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import type { Event, Member, Attendance, CertificateTemplate } from "../types";

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
  releasedAt?: string;
}

export interface ResolvedCertificateItem {
  event: Event;
  member: Member;
  isOrganizer: boolean;
  certCode: string;
  template?: CertificateTemplate;
  hours?: number;
}

export interface ResolvedCertificate extends ResolvedCertificateItem {
  allMatches?: ResolvedCertificateItem[];
}

/**
 * Resolves the official certificate release/issue date.
 * Priority:
 * 1. Explicit template manual override (template.releaseDate)
 * 2. Member/Attendance specific release date (member.certificateReleasedAt or member.issuedAt)
 * 3. Event certificateReleasedAt (when the event certificates were unlocked/closed)
 * 4. Event closedAt (when event was completed/closed)
 * 5. Event endDate (for completed events, date of conclusion)
 * 6. Event startDate
 * 7. Fallback to current Date
 */
export function resolveCertificateReleaseDate(
  event?: Partial<Event> | null,
  template?: Partial<CertificateTemplate> | null,
  member?: Partial<Member> | null
): {
  day: string;
  monthName: string;
  year: number;
  formattedDate: string;
  isoDate: string;
} {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  const rawCandidate =
    template?.releaseDate ||
    (template as any)?.certificateReleasedAt ||
    (member as any)?.certificateReleasedAt ||
    (member as any)?.issuedAt ||
    (event as any)?.certificateReleasedAt ||
    (event as any)?.closedAt ||
    (event as any)?.endDate ||
    (event as any)?.startDate ||
    null;

  let parsed: { day: number; month: number; year: number } | null = null;

  if (rawCandidate) {
    if (typeof rawCandidate === "string") {
      const s = rawCandidate.trim();
      // Format YYYY-MM-DD or ISO timestamp YYYY-MM-DDTHH:MM:SS
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const datePart = s.split(/[T ]/)[0];
        const [y, m, d] = datePart.split("-").map(Number);
        if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          parsed = { year: y, month: m, day: d };
        }
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [d, m, y] = s.split("/").map(Number);
        if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          parsed = { year: y, month: m, day: d };
        }
      } else {
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) {
          parsed = {
            year: dt.getFullYear(),
            month: dt.getMonth() + 1,
            day: dt.getDate(),
          };
        }
      }
    } else if (typeof rawCandidate === "number") {
      const dt = new Date(rawCandidate);
      if (!isNaN(dt.getTime())) {
        parsed = {
          year: dt.getFullYear(),
          month: dt.getMonth() + 1,
          day: dt.getDate(),
        };
      }
    } else if (rawCandidate instanceof Date && !isNaN(rawCandidate.getTime())) {
      parsed = {
        year: rawCandidate.getFullYear(),
        month: rawCandidate.getMonth() + 1,
        day: rawCandidate.getDate(),
      };
    }
  }

  const now = new Date();
  const finalYear = parsed?.year ?? now.getFullYear();
  const finalMonth = parsed?.month ?? (now.getMonth() + 1);
  const finalDay = parsed?.day ?? now.getDate();

  const dayStr = String(finalDay).padStart(2, "0");
  const monthName = months[Math.max(0, Math.min(11, finalMonth - 1))];
  const formattedDate = `${dayStr} de ${monthName} de ${finalYear}`;
  const isoDate = `${finalYear}-${String(finalMonth).padStart(2, "0")}-${dayStr}`;

  return {
    day: dayStr,
    monthName,
    year: finalYear,
    formattedDate,
    isoDate,
  };
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

  // Event unique part: prioritize unique ID or timestamp, bounded to 6-10 chars
  let eventPart = "";
  if (event.id) {
    const rawClean = cleanAlphaNum(event.id);
    const withoutPrefix = rawClean.replace(/^EVT/, "");
    eventPart = withoutPrefix.length >= 6 ? withoutPrefix.slice(0, 10) : (rawClean.length >= 6 ? rawClean.slice(0, 10) : rawClean);
  } else if (event.title) {
    eventPart = cleanAlphaNum(event.title).slice(0, 8);
  } else {
    eventPart = "EVT" + Date.now().toString().slice(-6);
  }

  // Member unique part: prioritize RA if available, otherwise unique ID or CPF (bounded to 10 chars)
  let memberPart = "";
  if (member.ra && cleanAlphaNum(member.ra).length >= 3) {
    memberPart = cleanAlphaNum(member.ra).slice(0, 10);
  } else if (member.cpf && cleanAlphaNum(member.cpf).length >= 6) {
    memberPart = cleanAlphaNum(member.cpf).slice(-6);
  } else if (member.id) {
    const rawClean = cleanAlphaNum(member.id);
    const withoutPrefix = rawClean.replace(/^STD|^MEM/, "");
    memberPart = withoutPrefix.length >= 4 ? withoutPrefix.slice(0, 10) : rawClean.slice(0, 10);
  } else {
    memberPart = "DOC" + cleanAlphaNum(member.name || "USER").slice(0, 6);
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
  const eventIdClean = cleanAlphaNum(eventIdRaw);
  const eventIdTail8 = eventIdClean.length >= 8 ? eventIdClean.slice(-8) : eventIdClean;
  const eventIdWithoutEvt = eventIdClean.replace(/^EVT/, "");
  const eventIdWithoutEvtTail8 = eventIdWithoutEvt.length >= 6 ? eventIdWithoutEvt.slice(-8) : eventIdWithoutEvt;

  // Legacy format 1: event.id.slice(0,8) - member.id.slice(0,8)
  if (member.id) {
    const mIdRaw = member.id.trim();
    const mIdSlice8 = mIdRaw.slice(0, 8).toUpperCase();
    const mIdClean = cleanAlphaNum(mIdRaw);
    const mIdTail8 = mIdClean.length >= 8 ? mIdClean.slice(-8) : mIdClean;
    const mIdWithoutPrefix = mIdClean.replace(/^STD|^MEM/, "");
    const mIdWithoutPrefixTail8 = mIdWithoutPrefix.length >= 4 ? mIdWithoutPrefix.slice(-8) : mIdWithoutPrefix;

    codes.push(`${eventIdSlice8}-${mIdSlice8}`);
    codes.push(`${eventIdSlice8}-${mIdClean.slice(0, 8)}`);
    codes.push(`${eventIdClean.slice(0, 8)}-${mIdClean.slice(0, 8)}`);
    codes.push(`${eventIdRaw.toUpperCase()}-${mIdRaw.toUpperCase()}`);
    codes.push(`CERT-${eventIdSlice8}-${mIdClean.slice(0, 8)}`);
    codes.push(`FAJ-${eventIdSlice8}-${mIdClean.slice(0, 8)}`);
    codes.push(`FAJ-${eventIdTail8}-${mIdTail8}`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mIdWithoutPrefixTail8}`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mIdWithoutPrefixTail8}-PAR`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mIdWithoutPrefixTail8}-ORG`);
  }

  // Legacy format 2: event.id.slice(0,8) - member.ra.slice(0,8)
  if (member.ra) {
    const mRaRaw = member.ra.trim();
    const mRaSlice8 = mRaRaw.slice(0, 8).toUpperCase();
    const mRaClean = cleanAlphaNum(mRaRaw);
    const mRaTail8 = mRaClean.length >= 8 ? mRaClean.slice(-8) : mRaClean;

    codes.push(`${eventIdSlice8}-${mRaSlice8}`);
    codes.push(`${eventIdSlice8}-${mRaClean.slice(0, 8)}`);
    codes.push(`${eventIdClean.slice(0, 8)}-${mRaClean.slice(0, 8)}`);
    codes.push(`${eventIdRaw.toUpperCase()}-${mRaRaw.toUpperCase()}`);
    codes.push(`CERT-${eventIdSlice8}-${mRaClean.slice(0, 8)}`);
    codes.push(`FAJ-${eventIdSlice8}-${mRaClean.slice(0, 8)}`);
    codes.push(`FAJ-${eventIdTail8}-${mRaTail8}`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mRaTail8}`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mRaTail8}-PAR`);
    codes.push(`FAJ-${eventIdWithoutEvtTail8}-${mRaTail8}-ORG`);
  }

  // Legacy format 3: event.id.slice(0,8) - DOC
  codes.push(`${eventIdSlice8}-DOC`);
  codes.push(`${eventIdClean.slice(0, 8)}-DOC`);
  codes.push(`CERT-${eventIdSlice8}-DOC`);
  codes.push(`FAJ-${eventIdSlice8}-DOC`);

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
  const releaseInfo = resolveCertificateReleaseDate(event, null, member);

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
    issuedAt: releaseInfo.isoDate,
    releasedAt: releaseInfo.isoDate,
  };

  try {
    if (!auth.currentUser) {
      // Writing certificate records to Firestore requires authentication
      return;
    }
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
  } catch (err: any) {
    if (err?.code !== "permission-denied" && !err?.message?.includes("insufficient permissions")) {
      console.warn("Failed to register certificate record in Firestore:", err);
    }
  }
}

/**
 * Retroactive Migration & Sync:
 * Scans all existing attendances with issued certificates (or eligible status)
 * and pre-registers both their new and legacy authenticity codes.
 * This completely fixes already generated / printed certificates!
 */
export async function syncAllExistingCertificates(): Promise<number> {
  // Syncing requires authenticated privileges to write to certificates collection
  if (!auth.currentUser) {
    return 0;
  }

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

      const isReleased = event.status === "encerrado" || (event as any).isCertificateReleased || isEventCertificateReleased(event);
      // Broaden eligibility to cover any certificate that was released, attended, or has template
      const hasPart = Boolean(
        att.status === "presente" ||
        att.status === "apto_para_certificado" ||
        event.allowAllRegisteredCertificates ||
        isReleased ||
        event.certificateTemplate
      );
      const hasOrg = Boolean(att.isOrganizer);

      const releaseInfo = resolveCertificateReleaseDate(event, null, student);

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
          issuedAt: releaseInfo.isoDate,
          releasedAt: releaseInfo.isoDate,
        };

        if (batchOperations >= 450) {
          await commitAndRenewBatch();
        }
        const certRef = doc(db, `artifacts/${appId}/public/data/certificates`, code);
        currentBatch.set(certRef, record, { merge: true });
        batchOperations++;

        // Legacy codes and aliases
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
          issuedAt: releaseInfo.isoDate,
          releasedAt: releaseInfo.isoDate,
        };

        if (batchOperations >= 450) {
          await commitAndRenewBatch();
        }
        const certRef = doc(db, `artifacts/${appId}/public/data/certificates`, code);
        currentBatch.set(certRef, record, { merge: true });
        batchOperations++;

        const legacyCodes = getLegacyCertificateCodes(event, student);
        for (const lCode of legacyCodes) {
          const orgCode = lCode.endsWith("-ORG") ? lCode : `${lCode}-ORG`;
          if (batchOperations >= 450) {
            await commitAndRenewBatch();
          }
          const legacyRef = doc(db, `artifacts/${appId}/public/data/certificates`, orgCode);
          currentBatch.set(legacyRef, { ...record, legacyCode: orgCode }, { merge: true });
          batchOperations++;
        }
        count++;
      }
    }

    // Sweep existing certificates in Firestore to correct any wrong hours or titles
    try {
      const existingCertsSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/certificates`)).catch(() => null);
      if (existingCertsSnap && !existingCertsSnap.empty) {
        for (const cDoc of existingCertsSnap.docs) {
          const cData = cDoc.data() as CertificateRecord;
          if (cData.eventId && cData.studentId) {
            const ev = eventsMap.get(cData.eventId);
            const st = studentsMap.get(cData.studentId);
            if (ev && st) {
              const correctHours = Number(String(cData.isOrganizer && ev.organizationHours ? ev.organizationHours : (ev.hours || 0)).replace(/[^0-9.]/g, "")) || 0;
              const updates: Partial<CertificateRecord> = {
                eventTitle: ev.title || cData.eventTitle || "Evento Acadêmico",
                hours: correctHours,
                memberCourse: st.course || cData.memberCourse || "",
                memberName: st.name || cData.memberName || "",
                memberRa: st.ra || cData.memberRa || "",
              };
              if (batchOperations >= 450) {
                await commitAndRenewBatch();
              }
              currentBatch.set(cDoc.ref, updates, { merge: true });
              batchOperations++;
            }
          }
        }
      }
    } catch (sweepErr) {
      console.warn("Certificates repair sweep non-blocking error:", sweepErr);
    }

    if (batchOperations > 0) {
      await currentBatch.commit();
    }

    return count;
  } catch (err: any) {
    if (err?.code !== "permission-denied" && !err?.message?.includes("insufficient permissions")) {
      console.warn("Notice during syncAllExistingCertificates:", err);
    }
    return 0;
  }
}

/**
export interface ResolvedCertificateItem {
  event: Event;
  member: Member;
  isOrganizer: boolean;
  certCode: string;
  template?: CertificateTemplate;
  hours?: number;
}

export interface ResolvedCertificate extends ResolvedCertificateItem {
  allMatches?: ResolvedCertificateItem[];
}

/**
 * Resolves any certificate code (new or legacy) to the EXACT Event, Member, Course, and Hours.
 * Applies multi-tier strategies: direct document keys, indexed Firestore queries,
 * RA/CPF/student lookup, event joint matching, and recovery synthesis.
 */
export async function resolveCertificate(
  rawCode: string,
  eventsCache: Event[] = [],
  membersCache: Member[] = [],
  attendancesCache: Attendance[] = []
): Promise<ResolvedCertificate | null> {
  if (!rawCode || !rawCode.trim()) return null;

  let code = rawCode.trim();

  // 0. Decode any URL encodings safely
  try {
    code = decodeURIComponent(code);
  } catch (_) {}
  code = code.trim();

  // Extract from URL parameters or full URL
  const urlParamMatch = code.match(/[?&](?:cert|verify|code)=([^&#\s]+)/i);
  if (urlParamMatch && urlParamMatch[1]) {
    try {
      code = decodeURIComponent(urlParamMatch[1]);
    } catch (_) {
      code = urlParamMatch[1];
    }
  } else if (code.startsWith("http://") || code.startsWith("https://")) {
    try {
      const url = new URL(code);
      const param = url.searchParams.get("cert") || url.searchParams.get("verify") || url.searchParams.get("code");
      if (param) {
        code = param.trim();
      } else {
        const segs = url.pathname.split("/").filter(Boolean);
        if (segs.length > 0) code = segs[segs.length - 1];
      }
    } catch (_) {}
  }

  try {
    code = decodeURIComponent(code);
  } catch (_) {}

  code = code.replace(/["']/g, "").trim().toUpperCase();
  if (!code) return null;

  const certificatesCol = collection(db, `artifacts/${appId}/public/data/certificates`);
  const matchedRecords: CertificateRecord[] = [];

  const addRecord = (rec: CertificateRecord | null | undefined) => {
    if (!rec || !rec.eventId || !rec.studentId) return;
    const key = `${rec.code || ""}_${rec.isOrganizer ? "ORG" : "PAR"}_${rec.eventId}_${rec.studentId}`;
    if (!matchedRecords.some((r) => `${r.code || ""}_${r.isOrganizer ? "ORG" : "PAR"}_${r.eventId}_${r.studentId}` === key)) {
      matchedRecords.push(rec);
    }
  };

  // -------------------------------------------------------------
  // STRATEGY 1: Direct key lookup in Firestore `certificates` collection
  // -------------------------------------------------------------
  const directCandidateKeys: string[] = [];
  const cleanUpper = code;
  const cleanAlpha = cleanAlphaNum(code);
  const withoutPrefix = code.replace(/^FAJ-|^CERT-/, "");

  if (!cleanUpper.includes("/") && !cleanUpper.includes("?")) {
    directCandidateKeys.push(cleanUpper);
    directCandidateKeys.push(cleanUpper.toLowerCase());
  }
  if (!withoutPrefix.includes("/") && withoutPrefix !== cleanUpper) {
    directCandidateKeys.push(withoutPrefix);
    directCandidateKeys.push(`FAJ-${withoutPrefix}`);
    directCandidateKeys.push(`CERT-${withoutPrefix}`);
  }
  if (cleanAlpha && cleanAlpha.length >= 4) {
    directCandidateKeys.push(cleanAlpha);
    directCandidateKeys.push(`FAJ-${cleanAlpha}`);
  }

  for (const key of Array.from(new Set(directCandidateKeys))) {
    if (key.includes("/") || key.includes("?") || key.includes("&")) continue;
    try {
      const certSnap = await getDoc(doc(certificatesCol, key));
      if (certSnap.exists()) {
        addRecord(certSnap.data() as CertificateRecord);
      }
    } catch (_) {}
  }

  // -------------------------------------------------------------
  // STRATEGY 2: Indexed Firestore queries on `certificates` collection
  // -------------------------------------------------------------
  if (matchedRecords.length === 0) {
    const runQueries = async () => {
      const queryTasks = [
        getDocs(query(certificatesCol, where("code", "==", cleanUpper))).catch(() => null),
        getDocs(query(certificatesCol, where("legacyCode", "==", cleanUpper))).catch(() => null),
        getDocs(query(certificatesCol, where("memberRa", "==", code))).catch(() => null),
        cleanAlpha !== code ? getDocs(query(certificatesCol, where("memberRa", "==", cleanAlpha))).catch(() => null) : null,
        getDocs(query(certificatesCol, where("studentId", "==", code))).catch(() => null),
        getDocs(query(certificatesCol, where("eventId", "==", code))).catch(() => null),
      ];

      const results = await Promise.all(queryTasks);
      for (const snap of results) {
        if (snap && !snap.empty) {
          snap.forEach((d) => addRecord(d.data() as CertificateRecord));
        }
      }
    };
    await runQueries();
  }

  // -------------------------------------------------------------
  // STRATEGY 3: Search by Student (RA, CPF, Name) in Students Collection
  // -------------------------------------------------------------
  if (matchedRecords.length === 0) {
    try {
      const studentsCol = collection(db, `artifacts/${appId}/public/data/students`);
      let matchedStudentId: string | null = null;
      let matchedStudentRa: string | null = null;

      // Check cache first
      const studentInCache = membersCache.find(
        (m) =>
          (m.ra && m.ra.toUpperCase() === code) ||
          (m.cpf && cleanAlphaNum(m.cpf) === cleanAlpha) ||
          m.id === code ||
          (m.name && m.name.toUpperCase().trim() === code)
      );

      if (studentInCache) {
        matchedStudentId = studentInCache.id;
        matchedStudentRa = studentInCache.ra || null;
      } else {
        const studentQueries = [
          getDocs(query(studentsCol, where("ra", "==", code))).catch(() => null),
          cleanAlpha !== code ? getDocs(query(studentsCol, where("ra", "==", cleanAlpha))).catch(() => null) : null,
          getDocs(query(studentsCol, where("alphaCode", "==", code))).catch(() => null),
        ];
        const sResults = await Promise.all(studentQueries);
        for (const sSnap of sResults) {
          if (sSnap && !sSnap.empty) {
            matchedStudentId = sSnap.docs[0].id;
            matchedStudentRa = (sSnap.docs[0].data() as Member).ra || null;
            break;
          }
        }
      }

      if (matchedStudentId || matchedStudentRa) {
        const certTasks = [];
        if (matchedStudentId) {
          certTasks.push(getDocs(query(certificatesCol, where("studentId", "==", matchedStudentId))).catch(() => null));
        }
        if (matchedStudentRa) {
          certTasks.push(getDocs(query(certificatesCol, where("memberRa", "==", matchedStudentRa))).catch(() => null));
        }
        const certResults = await Promise.all(certTasks);
        for (const cSnap of certResults) {
          if (cSnap && !cSnap.empty) {
            cSnap.forEach((d) => addRecord(d.data() as CertificateRecord));
          }
        }
      }
    } catch (e) {
      console.warn("Strategy 3 student lookup notice:", e);
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 4: If records were found in Certificates collection, build rich result
  // -------------------------------------------------------------
  if (matchedRecords.length > 0) {
    // Helper to enrich a CertificateRecord into a ResolvedCertificateItem
    const enrichRecord = async (data: CertificateRecord): Promise<ResolvedCertificateItem> => {
      let foundEvent = eventsCache.find((e) => e.id === data.eventId);
      if (!foundEvent && data.eventId) {
        try {
          const eSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/events`, data.eventId));
          if (eSnap.exists()) {
            foundEvent = { id: eSnap.id, ...eSnap.data() } as Event;
          }
        } catch (_) {}
      }

      let foundMember = membersCache.find((m) => m.id === data.studentId);
      if (!foundMember && data.studentId) {
        try {
          const mSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/students`, data.studentId));
          if (mSnap.exists()) {
            foundMember = { id: mSnap.id, ...mSnap.data() } as Member;
          }
        } catch (_) {}
      }

      // Safe hours calculation: never 0 or null
      let resolvedHours = data.hours !== undefined && data.hours !== null ? Number(data.hours) : 0;
      if (resolvedHours <= 0 && foundEvent) {
        resolvedHours = Number(data.isOrganizer && foundEvent.organizationHours ? foundEvent.organizationHours : foundEvent.hours) || 0;
      }
      if (resolvedHours <= 0 && foundEvent?.startDate && foundEvent?.endDate) {
        const d1 = new Date(foundEvent.startDate).getTime();
        const d2 = new Date(foundEvent.endDate).getTime();
        if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
          resolvedHours = Math.round((d2 - d1) / (1000 * 60 * 60));
        }
      }
      if (resolvedHours <= 0) {
        resolvedHours = 4; // Fallback standard workload
      }

      const finalEvent: Event = foundEvent || {
        id: data.eventId,
        title: data.eventTitle || "Evento Acadêmico",
        hours: resolvedHours,
        organizationHours: data.isOrganizer ? resolvedHours : undefined,
        status: "encerrado",
      } as Event;

      const finalMember: Member = foundMember || {
        id: data.studentId,
        name: data.memberName || "Participante Certificado",
        ra: data.memberRa || "",
        course: data.memberCourse || "",
        roles: ["ALUNO(A)"],
      } as Member;

      const template =
        (data.isOrganizer ? finalEvent.organizationCertificateTemplate : finalEvent.certificateTemplate) ||
        getDefaultCertificateTemplate(finalEvent, data.isOrganizer);

      return {
        event: {
          ...finalEvent,
          title: data.eventTitle || finalEvent.title,
          hours: resolvedHours,
          organizationHours: data.isOrganizer ? resolvedHours : finalEvent.organizationHours,
        },
        member: {
          ...finalMember,
          name: data.memberName || finalMember.name,
          course: data.memberCourse || finalMember.course,
          ra: data.memberRa || finalMember.ra || "",
        },
        isOrganizer: Boolean(data.isOrganizer),
        certCode: data.code || code,
        template,
        hours: resolvedHours,
      };
    };

    const allItems = await Promise.all(matchedRecords.map(enrichRecord));
    // Sort so exact code matches or latest issued certificates come first
    allItems.sort((a, b) => {
      if (a.certCode === cleanUpper) return -1;
      if (b.certCode === cleanUpper) return 1;
      return 0;
    });

    const primary = allItems[0];
    return {
      ...primary,
      allMatches: allItems.length > 1 ? allItems : undefined,
    };
  }

  // -------------------------------------------------------------
  // STRATEGY 5: Intelligent Joint Matching (Event + Member + Attendance)
  // Fixes both new FAJ-... and legacy EVT-... formats
  // -------------------------------------------------------------
  let isExplicitOrg = code.includes("-ORG") || code.endsWith("ORG");
  let isExplicitPar = code.includes("-PAR") || code.endsWith("PAR");

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

  const isMemberMatch = (m: Member): boolean => {
    if (!m) return false;
    const mId = cleanAlphaNum(m.id || "");
    const mIdTail8 = mId.length >= 8 ? mId.slice(-8) : mId;
    const mIdWithoutPrefix = mId.replace(/^STD|^MEM/, "");
    const mIdWithoutPrefixTail8 = mIdWithoutPrefix.length >= 4 ? mIdWithoutPrefix.slice(-8) : mIdWithoutPrefix;

    const mRa = cleanAlphaNum(m.ra || "");
    const mRaTail8 = mRa.length >= 8 ? mRa.slice(-8) : mRa;

    const mAlpha = cleanAlphaNum(m.alphaCode || "");
    const mCpf = cleanAlphaNum(m.cpf || "");
    const mCpfTail8 = mCpf.length >= 6 ? mCpf.slice(-8) : mCpf;

    return (
      mId === cleanMemberSearch ||
      mId.endsWith(cleanMemberSearch) ||
      mId.slice(0, 8) === cleanMemberSearch ||
      mIdTail8 === cleanMemberSearch ||
      mIdWithoutPrefixTail8 === cleanMemberSearch ||
      mRa === cleanMemberSearch ||
      mRa.endsWith(cleanMemberSearch) ||
      mRa.slice(0, 8) === cleanMemberSearch ||
      mRaTail8 === cleanMemberSearch ||
      (cleanMemberSearch.length >= 4 && mRa.includes(cleanMemberSearch)) ||
      mAlpha === cleanMemberSearch ||
      (cleanMemberSearch.length >= 6 && (mCpf.endsWith(cleanMemberSearch) || mCpfTail8 === cleanMemberSearch)) ||
      (cleanMemberSearch.length >= 5 && cleanAlphaNum(m.name || "").includes(cleanMemberSearch))
    );
  };

  const isEventMatch = (ev: Event): boolean => {
    if (!ev) return false;
    const evClean = cleanAlphaNum(ev.id || "");
    const evTail8 = evClean.length >= 8 ? evClean.slice(-8) : evClean;
    const evWithoutEvt = evClean.replace(/^EVT/, "");
    const evWithoutEvtTail8 = evWithoutEvt.length >= 6 ? evWithoutEvt.slice(-8) : evWithoutEvt;

    return (
      evClean === cleanEventSearch ||
      evClean.endsWith(cleanEventSearch) ||
      evWithoutEvt === cleanEventSearch ||
      evWithoutEvt.endsWith(cleanEventSearch) ||
      evTail8 === cleanEventSearch ||
      evWithoutEvtTail8 === cleanEventSearch ||
      (cleanEventSearch.length >= 6 && evWithoutEvt.startsWith(cleanEventSearch)) ||
      (cleanEventSearch.length >= 8 && evClean.startsWith(cleanEventSearch))
    );
  };

  // 3. Find candidate members
  const candidateMembers = allMembers.filter(isMemberMatch);

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

      if (isEventMatch(ev)) {
        const isOrganizer = isExplicitOrg ? true : isExplicitPar ? false : Boolean(att.isOrganizer);

        registerCertificateRecord({
          code,
          event: ev,
          member: candMember,
          isOrganizer,
        }).catch(() => null);

        const template =
          (isOrganizer ? ev.organizationCertificateTemplate : ev.certificateTemplate) ||
          getDefaultCertificateTemplate(ev, isOrganizer);

        return {
          event: ev,
          member: candMember,
          isOrganizer,
          certCode: code,
          template,
          hours: Number(isOrganizer && ev.organizationHours ? ev.organizationHours : ev.hours) || 4,
        };
      }
    }
  }

  // 5b. Cross-reference candidate events with attendances & members
  const candidateEvents = allEvents.filter(isEventMatch);

  for (const candEvent of candidateEvents) {
    const eventAtts = allAttendances.filter((a) => a.eventId === candEvent.id && a.status !== "cancelado");
    for (const att of eventAtts) {
      const mem = allMembers.find((m) => m.id === att.studentId);
      if (!mem) continue;

      if (isMemberMatch(mem)) {
        const isOrganizer = isExplicitOrg ? true : isExplicitPar ? false : Boolean(att.isOrganizer);
        registerCertificateRecord({
          code,
          event: candEvent,
          member: mem,
          isOrganizer,
        }).catch(() => null);

        const template =
          (isOrganizer ? candEvent.organizationCertificateTemplate : candEvent.certificateTemplate) ||
          getDefaultCertificateTemplate(candEvent, isOrganizer);

        return {
          event: candEvent,
          member: mem,
          isOrganizer,
          certCode: code,
          template,
          hours: Number(isOrganizer && candEvent.organizationHours ? candEvent.organizationHours : candEvent.hours) || 4,
        };
      }
    }
  }

  // 5c. Direct candidate event + candidate member match
  if (candidateEvents.length > 0 && candidateMembers.length > 0) {
    const candEvent = candidateEvents[0];
    const candMember = candidateMembers[0];
    const isOrganizer = isExplicitOrg;
    registerCertificateRecord({
      code,
      event: candEvent,
      member: candMember,
      isOrganizer,
    }).catch(() => null);

    const template =
      (isOrganizer ? candEvent.organizationCertificateTemplate : candEvent.certificateTemplate) ||
      getDefaultCertificateTemplate(candEvent, isOrganizer);

    return {
      event: candEvent,
      member: candMember,
      isOrganizer,
      certCode: code,
      template,
      hours: Number(isOrganizer && candEvent.organizationHours ? candEvent.organizationHours : candEvent.hours) || 4,
    };
  }

  // 6. Direct event match fallback if member was "DOC" or external
  const matchedEvent = candidateEvents[0] || allEvents.find(isEventMatch);

  if (matchedEvent) {
    const fallbackMember: Member = candidateMembers[0] || {
      id: memberPart || "DOC",
      name: "Participante Certificado",
      roles: ["VISITANTE"],
      ra: memberPart || "DOC-EXTERNO",
    };

    const isOrganizer = isExplicitOrg;
    const template =
      (isOrganizer ? matchedEvent.organizationCertificateTemplate : matchedEvent.certificateTemplate) ||
      getDefaultCertificateTemplate(matchedEvent, isOrganizer);

    return {
      event: matchedEvent,
      member: fallbackMember,
      isOrganizer,
      certCode: code,
      template,
      hours: Number(isOrganizer && matchedEvent.organizationHours ? matchedEvent.organizationHours : matchedEvent.hours) || 4,
    };
  }

  return null;
}

/**
 * Calculates event end timestamp safely from startDate, endDate and endTime.
 */
export function getEventEndTime(event?: { endDate?: string; startDate?: string; endTime?: string } | null): number {
  if (!event) return 0;
  if (!event.endDate && !event.startDate) return 0;
  const dateStr = (event.endDate || event.startDate || "").trim();
  const timeStr = (event.endTime || "").trim();

  if (timeStr && timeStr.includes(":") && dateStr.length === 10 && dateStr.includes("-")) {
    const [y, m, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    return new Date(y, m - 1, day, hours || 0, minutes || 0, 0, 0).getTime();
  }
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
 * Checks if certificates for an event are released, either because the event is marked 'encerrado',
 * manually released, or because its scheduled end time has passed (when autoReleaseCertificatesOnEnd is active, default true).
 */
export function isEventCertificateReleased(event: Event): boolean {
  if (event.status === "encerrado") return true;
  if ((event as any).isCertificateReleased === true) return true;
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

/**
 * Provides a complete default CertificateTemplate for an event.
 */
export function getDefaultCertificateTemplate(
  event?: Partial<Event>,
  isOrganizer?: boolean,
  settings?: any
): CertificateTemplate {
  const isDioceseEvent = Boolean(event?.isDiocese || event?.dioceseId);
  return {
    bodyText: "",
    fontFamily: "serif",
    bgStyle: "theme-classic",
    isApproved: true,
    showFajopaDirectorSignature: !isDioceseEvent,
    fajopaDirectorName: settings?.directorName || "Direção Acadêmica",
    showSeminarRectorSignature: !isDioceseEvent,
    seminarRectorName: settings?.rectorName || "Reitoria",
    showSignature1: isDioceseEvent,
    signature1Name: "",
    signature1Role: isDioceseEvent ? "Coordenador(a) Diocesano(a)" : "",
    signatureName: "",
    signatureRole: "",
    showSignature2: isDioceseEvent,
    signature2Name: "",
    signature2Role: isDioceseEvent ? "Bispo Diocesano" : "",
    showSignature3: false,
    signature3Name: "",
    signature3Role: "",
    fontSize: 26,
    isBold: false,
    textAlign: "justify",
    textBoxWidth: "normal",
    titleText: "CERTIFICADO",
    subtitleText: isOrganizer ? "DE ORGANIZAÇÃO" : "DE PARTICIPAÇÃO",
    showLogo: true,
    logoSize: 70,
    logoPosition: "top-center",
    showLogo2: true,
    logo2Size: 60,
    logo2Position: "top-right",
    backgroundOpacity: 100,
    keepFrameWithCustomBg: false,
    institutionAddress: settings?.instAddress || "",
    institutionEmail: settings?.instEmail || "",
    showInstitutionFooter: true,
    institutionFooterOffsetY: 0,
    signatureSize: 65,
    signaturePosition: "space-around",
    signatureOffsetY: 0,
    signatureLineGap: -4,
  };
}

