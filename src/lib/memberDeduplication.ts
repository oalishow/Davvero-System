import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  where,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db, appId } from './firebase';
import type { Member, Attendance } from '../types';

/**
 * Normaliza um nome para letras maiúsculas e remove espaços extras
 */
export function normalizeMemberName(name?: string): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Extrai apenas os números de um CPF
 */
export function cleanCPFNumber(cpf?: string): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

/**
 * Formata um CPF para o formato 000.000.000-00
 */
export function formatCPFNumber(cpf?: string): string {
  const clean = cleanCPFNumber(cpf);
  if (clean.length !== 11) return cpf || "";
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Normaliza o RA para comparação e armazenamento consistente
 */
export function normalizeRA(ra?: string): string {
  if (!ra) return "";
  return ra.trim().toUpperCase();
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateField?: 'cpf' | 'ra' | 'both';
  existingMember?: Member;
  message?: string;
}

/**
 * Verifica no Firestore se já existe algum cadastro ativo com o CPF ou RA informado
 */
export async function checkMemberDuplicates(
  cpf?: string,
  ra?: string,
  excludeMemberId?: string
): Promise<DuplicateCheckResult> {
  const cleanCpf = cleanCPFNumber(cpf);
  const formattedCpf = formatCPFNumber(cpf);
  const cleanRa = normalizeRA(ra);

  const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);

  // 1. Verificar por CPF se fornecido
  if (cleanCpf && cleanCpf.length >= 8) {
    const searchCpfs = Array.from(new Set([cleanCpf, formattedCpf, cpf?.trim()].filter(Boolean))) as string[];
    
    // Pesquisa no campo cpf
    try {
      const qCpf = query(studentsRef, where('cpf', 'in', searchCpfs));
      const snapCpf = await getDocs(qCpf);
      const matched = snapCpf.docs
        .map(d => ({ id: d.id, ...d.data() } as Member))
        .find(m => (!excludeMemberId || m.id !== excludeMemberId) && !m.deletedAt);

      if (matched) {
        return {
          hasDuplicate: true,
          duplicateField: 'cpf',
          existingMember: matched,
          message: `O CPF informado já pertence a ${matched.name || 'outro membro'} (RA: ${matched.ra || 'S/N'}). Já existe cadastro com este CPF.`
        };
      }
    } catch (e) {
      console.warn("Erro ao buscar duplicado por CPF via query in:", e);
    }
  }

  // 2. Verificar por RA se fornecido
  if (cleanRa) {
    try {
      const qRa = query(studentsRef, where('ra', '==', cleanRa));
      const snapRa = await getDocs(qRa);
      const matched = snapRa.docs
        .map(d => ({ id: d.id, ...d.data() } as Member))
        .find(m => (!excludeMemberId || m.id !== excludeMemberId) && !m.deletedAt);

      if (matched) {
        return {
          hasDuplicate: true,
          duplicateField: 'ra',
          existingMember: matched,
          message: `O RA/Matrícula (${cleanRa}) já está cadastrado para ${matched.name || 'outro membro'}. Não é possível cadastrar com o mesmo RA.`
        };
      }
    } catch (e) {
      console.warn("Erro ao buscar duplicado por RA via query:", e);
    }
  }

  return { hasDuplicate: false };
}

export interface DuplicateGroup {
  key: string;
  reason: string;
  field: 'cpf' | 'ra' | 'name';
  members: Member[];
  suggestedMasterId: string;
}

/**
 * Analisa uma lista de membros e agrupa registros que sejam duplicados
 */
export function findDuplicateGroups(members: Member[]): DuplicateGroup[] {
  const activeMembers = members.filter(m => !m.deletedAt && !m.id.startsWith('_'));
  const groups: DuplicateGroup[] = [];
  const processedMemberIds = new Set<string>();

  // 1. Agrupar por CPF (limpo de pontuação)
  const cpfMap = new Map<string, Member[]>();
  for (const m of activeMembers) {
    const clean = cleanCPFNumber(m.cpf);
    if (clean && clean.length >= 8) {
      const list = cpfMap.get(clean) || [];
      list.push(m);
      cpfMap.set(clean, list);
    }
  }

  for (const [cpf, list] of cpfMap.entries()) {
    if (list.length > 1) {
      list.forEach(m => processedMemberIds.add(m.id));
      const suggestedMaster = pickBestMasterMember(list);
      groups.push({
        key: `cpf_${cpf}`,
        reason: `Mesmo CPF (${formatCPFNumber(cpf)})`,
        field: 'cpf',
        members: list,
        suggestedMasterId: suggestedMaster.id
      });
    }
  }

  // 2. Agrupar por RA (apenas quem ainda não foi agrupado por CPF)
  const raMap = new Map<string, Member[]>();
  for (const m of activeMembers) {
    const cleanRa = normalizeRA(m.ra);
    if (cleanRa && cleanRa !== 'VISITANTE' && cleanRa !== 'VISITANTE-S/N' && cleanRa !== 'S/N' && cleanRa !== 'SEM RA') {
      const list = raMap.get(cleanRa) || [];
      list.push(m);
      raMap.set(cleanRa, list);
    }
  }

  for (const [ra, list] of raMap.entries()) {
    if (list.length > 1) {
      // Ignorar se já todos os membros deste grupo estiverem em um grupo de CPF
      const unassigned = list.filter(m => !processedMemberIds.has(m.id));
      if (list.length > 1) {
        list.forEach(m => processedMemberIds.add(m.id));
        const suggestedMaster = pickBestMasterMember(list);
        groups.push({
          key: `ra_${ra}`,
          reason: `Mesmo RA / Matrícula (${ra})`,
          field: 'ra',
          members: list,
          suggestedMasterId: suggestedMaster.id
        });
      }
    }
  }

  // 3. Agrupar por Nome Exato (Normalizado) com mesma data de nascimento ou mesmo curso/diocese
  const nameMap = new Map<string, Member[]>();
  for (const m of activeMembers) {
    const norm = normalizeMemberName(m.name);
    if (norm && norm.length >= 5) {
      const list = nameMap.get(norm) || [];
      list.push(m);
      nameMap.set(norm, list);
    }
  }

  for (const [normName, list] of nameMap.entries()) {
    if (list.length > 1) {
      // Filtrar membros que já foram completamente agrupados
      const notInAny = list.filter(m => !processedMemberIds.has(m.id));
      if (notInAny.length > 1) {
        notInAny.forEach(m => processedMemberIds.add(m.id));
        const suggestedMaster = pickBestMasterMember(notInAny);
        groups.push({
          key: `name_${normName}`,
          reason: `Mesmo Nome Completo (${normName})`,
          field: 'name',
          members: notInAny,
          suggestedMasterId: suggestedMaster.id
        });
      }
    }
  }

  return groups;
}

/**
 * Escolhe automaticamente o registro mais completo para ser o principal (Master)
 */
export function pickBestMasterMember(members: Member[]): Member {
  return [...members].sort((a, b) => {
    // 1. Quem tem foto tem preferência
    if (Boolean(a.photoUrl) && !b.photoUrl) return -1;
    if (!a.photoUrl && Boolean(b.photoUrl)) return 1;

    // 2. Quem é aprovado tem preferência
    if (a.isApproved && !b.isApproved) return -1;
    if (!a.isApproved && b.isApproved) return 1;

    // 3. Quem é ativo tem preferência
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;

    // 4. Quem tem CPF e RA tem preferência
    const aCompleteness = (a.cpf ? 2 : 0) + (a.ra ? 2 : 0) + (a.email ? 1 : 0) + (a.phone ? 1 : 0);
    const bCompleteness = (b.cpf ? 2 : 0) + (b.ra ? 2 : 0) + (b.email ? 1 : 0) + (b.phone ? 1 : 0);
    if (aCompleteness !== bCompleteness) {
      return bCompleteness - aCompleteness;
    }

    // 5. Data de criação mais antiga (ou mais recente com alphaCode)
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  })[0];
}

/**
 * Unifica registros duplicados em um único cadastro Mestre (Master):
 * 1. Completa dados ausentes no Master com informações dos registros secundários.
 * 2. Atualiza a coleção de presenças (attendances) migrando todos os registros para o Master.
 * 3. Marca os registros secundários como excluídos/unificados.
 */
export async function mergeDuplicateMembers(
  masterId: string,
  duplicateIds: string[],
  adminName: string = "Administrador"
): Promise<{ success: boolean; mergedCount: number; attendancesUpdated: number }> {
  if (!masterId || !duplicateIds || duplicateIds.length === 0) {
    return { success: false, mergedCount: 0, attendancesUpdated: 0 };
  }

  const validDuplicateIds = duplicateIds.filter(id => id && id !== masterId);
  if (validDuplicateIds.length === 0) {
    return { success: false, mergedCount: 0, attendancesUpdated: 0 };
  }

  // 1. Carregar o Master
  const masterDocRef = doc(db, `artifacts/${appId}/public/data/students`, masterId);
  const masterSnap = await getDoc(masterDocRef);
  if (!masterSnap.exists()) {
    throw new Error("Cadastro mestre não foi encontrado.");
  }
  const masterData = masterSnap.data() as Member;

  // 2. Carregar os registros duplicados e compilar campos complementares
  const mergedFields: Partial<Member> = {
    name: normalizeMemberName(masterData.name)
  };

  const duplicateDocsData: { id: string; data: Member }[] = [];
  for (const dupId of validDuplicateIds) {
    const dupRef = doc(db, `artifacts/${appId}/public/data/students`, dupId);
    const dupSnap = await getDoc(dupRef);
    if (dupSnap.exists()) {
      const data = dupSnap.data() as Member;
      duplicateDocsData.push({ id: dupId, data });

      // Se o master não tiver CPF mas o duplicado tiver
      if (!masterData.cpf && data.cpf) {
        mergedFields.cpf = cleanCPFNumber(data.cpf);
      }
      // Se o master não tiver RA
      if ((!masterData.ra || masterData.ra === 'S/N' || masterData.ra.includes('VISITANTE')) && data.ra) {
        mergedFields.ra = normalizeRA(data.ra);
      }
      // Se o master não tiver email
      if (!masterData.email && data.email) {
        mergedFields.email = data.email.trim();
      }
      // Se o master não tiver telefone
      if (!masterData.phone && data.phone) {
        mergedFields.phone = data.phone.trim();
      }
      // Se o master não tiver data de nascimento
      if (!masterData.birthdate && data.birthdate) {
        mergedFields.birthdate = data.birthdate;
      }
      // Se o master não tiver foto
      if (!masterData.photoUrl && data.photoUrl) {
        mergedFields.photoUrl = data.photoUrl;
      }
      // Se o master não tiver curso ou diocese
      if (!masterData.course && data.course) {
        mergedFields.course = data.course;
      }
      if ((!masterData.diocese || masterData.diocese === 'GERAL') && data.diocese) {
        mergedFields.diocese = data.diocese;
      }
      if (!masterData.seminary && data.seminary) {
        mergedFields.seminary = data.seminary;
      }
      // Unir papéis (roles)
      if (Array.isArray(data.roles) && data.roles.length > 0) {
        const currentRoles = Array.isArray(mergedFields.roles || masterData.roles) 
          ? [...(mergedFields.roles || masterData.roles)] 
          : [];
        for (const r of data.roles) {
          if (!currentRoles.includes(r)) {
            currentRoles.push(r);
          }
        }
        mergedFields.roles = currentRoles;
      }
    }
  }

  // Atualizar o documento Master com as informações enriquecidas
  await updateDoc(masterDocRef, {
    ...mergedFields,
    isApproved: true,
    isActive: true,
    lastMergedAt: new Date().toISOString(),
    lastMergedBy: adminName
  });

  // 3. Migrar presenças (attendances)
  let attendancesUpdated = 0;
  const attendancesRef = collection(db, `artifacts/${appId}/public/data/attendances`);
  const attendancesSnap = await getDocs(attendancesRef);

  // Mapear todas as presenças do Master para mesclar datas de check-in caso haja presença duplicada no mesmo evento
  const masterAttendancesByEvent = new Map<string, { id: string; data: Attendance }>();
  const duplicateAttendancesToMigrate: { id: string; data: Attendance }[] = [];

  attendancesSnap.docs.forEach(d => {
    const att = { id: d.id, ...d.data() } as Attendance;
    if (att.studentId === masterId) {
      masterAttendancesByEvent.set(att.eventId, { id: d.id, data: att });
    } else if (validDuplicateIds.includes(att.studentId)) {
      duplicateAttendancesToMigrate.push({ id: d.id, data: att });
    }
  });

  for (const dupAtt of duplicateAttendancesToMigrate) {
    const existingMasterAtt = masterAttendancesByEvent.get(dupAtt.data.eventId);

    if (existingMasterAtt) {
      // Já existe registro de presença do Master no mesmo evento!
      // Mesclar datas de check-in e status mais favorável
      const masterDays = existingMasterAtt.data.checkInDays || [];
      const dupDays = dupAtt.data.checkInDays || [];
      const mergedDays = Array.from(new Set([...masterDays, ...dupDays]));
      
      const newStatus = (existingMasterAtt.data.status === 'presente' || dupAtt.data.status === 'presente')
        ? 'presente'
        : (existingMasterAtt.data.status === 'apto_para_certificado' || dupAtt.data.status === 'apto_para_certificado')
          ? 'apto_para_certificado'
          : existingMasterAtt.data.status;

      const isOrganizer = existingMasterAtt.data.isOrganizer || dupAtt.data.isOrganizer || false;

      // Atualiza o registro do Master
      await updateDoc(doc(db, `artifacts/${appId}/public/data/attendances`, existingMasterAtt.id), {
        checkInDays: mergedDays,
        status: newStatus,
        isOrganizer,
        studentName: normalizeMemberName(masterData.name),
        mergedFromAttendanceId: dupAtt.id
      });

      // Remove a presença duplicada secundária para não haver duplicatas
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/attendances`, dupAtt.id));
      attendancesUpdated++;
    } else {
      // Não existe no Master, então apenas transfere a posse para o MasterId
      await updateDoc(doc(db, `artifacts/${appId}/public/data/attendances`, dupAtt.id), {
        studentId: masterId,
        studentName: normalizeMemberName(masterData.name),
        migratedAt: new Date().toISOString()
      });
      attendancesUpdated++;
    }
  }

  // 4. Marcar os registros duplicados como mesclados e inativos (soft-delete seguro)
  for (const dupId of validDuplicateIds) {
    const dupRef = doc(db, `artifacts/${appId}/public/data/students`, dupId);
    await updateDoc(dupRef, {
      isActive: false,
      isApproved: false,
      deletedAt: new Date().toISOString(),
      mergedInto: masterId,
      mergeNote: `Unificado no cadastro mestre ID ${masterId} (${normalizeMemberName(masterData.name)}) por ${adminName}`
    });
  }

  return {
    success: true,
    mergedCount: validDuplicateIds.length,
    attendancesUpdated
  };
}

/**
 * Padroniza todos os nomes de membros para LETRAS MAIÚSCULAS no Firestore.
 * Converte tanto os que já foram cadastrados quanto sincroniza presenças.
 */
export async function normalizeAllMemberNamesToUpperCase(
  adminName: string = "Administrador"
): Promise<{ totalUpdated: number; totalProcessed: number }> {
  const studentsRef = collection(db, `artifacts/${appId}/public/data/students`);
  const snap = await getDocs(studentsRef);

  let totalUpdated = 0;
  let totalProcessed = 0;

  // Processar em lotes (batch) de até 400 por limitação do Firestore
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    totalProcessed++;
    const data = docSnap.data() as Member;
    const originalName = data.name || "";
    const upperName = normalizeMemberName(originalName);

    // Se o nome não está em maiúsculo ou possui espaços sobrando
    if (originalName && originalName !== upperName) {
      batch.update(docSnap.ref, {
        name: upperName,
        nameNormalizedAt: new Date().toISOString()
      });
      totalUpdated++;
      batchCount++;

      if (batchCount >= 350) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  // Também padronizar nomes nas presenças (attendances) que não estejam em maiúsculas
  try {
    const attendancesRef = collection(db, `artifacts/${appId}/public/data/attendances`);
    const attSnap = await getDocs(attendancesRef);
    let attBatch = writeBatch(db);
    let attBatchCount = 0;

    for (const d of attSnap.docs) {
      const data = d.data() as Attendance;
      const original = data.studentName || "";
      const upper = normalizeMemberName(original);

      if (original && original !== upper) {
        attBatch.update(d.ref, {
          studentName: upper
        });
        attBatchCount++;

        if (attBatchCount >= 350) {
          await attBatch.commit();
          attBatch = writeBatch(db);
          attBatchCount = 0;
        }
      }
    }

    if (attBatchCount > 0) {
      await attBatch.commit();
    }
  } catch (errAtt) {
    console.warn("Erro ao normalizar nomes em presenças:", errAtt);
  }

  return { totalUpdated, totalProcessed };
}
