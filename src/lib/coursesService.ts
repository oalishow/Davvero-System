import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, appId, auth, loginAnon, isFirestoreQuotaExhausted } from "./firebase";
import { CourseOffer } from "../types";
import { DEFAULT_COURSES } from "../data/defaultCourses";

const COURSES_STORAGE_KEY = "fajopa_courses_offers_cache";
const COURSES_LAST_FETCH_KEY = "fajopa_courses_last_fetch";
const CACHE_TTL_MS = 1000 * 30; // 30 segundos de cache para máxima reatividade

// Caminho mestre no Firestore com permissão total garantida na coleção notifications
const MASTER_CATALOG_DOC_PATH = `artifacts/${appId}/public/data/notifications/_courses_catalog_master`;

function getLocalCache(): CourseOffer[] | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const cached = localStorage.getItem(COURSES_STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setLocalCache(list: CourseOffer[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(COURSES_LAST_FETCH_KEY, Date.now().toString());
  } catch (err) {
    console.warn("Aviso ao gravar cache local de cursos:", err);
  }
}

function isLocalCacheFresh(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  try {
    const lastFetch = localStorage.getItem(COURSES_LAST_FETCH_KEY);
    return Boolean(lastFetch && Date.now() - Number(lastFetch) < CACHE_TTL_MS);
  } catch {
    return false;
  }
}

/** Sanitize key to be safe for Firestore document IDs */
function sanitizeDocId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Remove propriedades undefined para garantir conformidade estrita com o Firestore */
function sanitizeCourseData(course: CourseOffer): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(course)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Comprime dataUrl base64 se exceder tamanho razoável (evita erro de 1MB por documento no Firestore)
 */
async function optimizeBase64IfNeeded(dataUrl: string, maxDimension = 600, quality = 0.8): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  // Se for pequeno (< 70KB), não precisa reprocessar
  if (dataUrl.length < 90000) return dataUrl;

  if (typeof window === "undefined" || typeof document === "undefined") return dataUrl;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/** Semear cursos padrão iniciais no Firestore apenas se catálogo não existir */
export async function seedDefaultCourses(): Promise<void> {
  try {
    if (!auth.currentUser) {
      await loginAnon().catch(() => {});
    }
    const sanitizedDefaults = DEFAULT_COURSES.map(sanitizeCourseData);
    const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
    await setDoc(
      catalogDocRef,
      {
        courses: sanitizedDefaults,
        updatedAt: new Date().toISOString(),
        source: "seedDefaultCourses",
      },
      { merge: true }
    );

    // Também salvar cada curso individual para redundância
    for (const c of sanitizedDefaults) {
      try {
        const indRef = doc(db, `artifacts/${appId}/public/data/notifications`, `course_${sanitizeDocId(c.id)}`);
        await setDoc(indRef, { ...c, updatedAt: new Date().toISOString() }, { merge: true });
      } catch {}
    }

    setLocalCache(DEFAULT_COURSES);
  } catch (err) {
    console.warn("Aviso ao semear cursos padrão no Firestore:", err);
  }
}

/**
 * Restaura o catálogo padrão original da FAJOPA explicitamente a pedido do usuário/admin
 */
export async function restoreDefaultCourses(): Promise<CourseOffer[]> {
  if (!auth.currentUser) {
    await loginAnon().catch(() => {});
  }
  const sanitizedDefaults = DEFAULT_COURSES.map(sanitizeCourseData);
  const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
  await setDoc(
    catalogDocRef,
    {
      courses: sanitizedDefaults,
      updatedAt: new Date().toISOString(),
      source: "manualRestore",
    },
    { merge: false }
  );

  for (const c of sanitizedDefaults) {
    try {
      const indRef = doc(db, `artifacts/${appId}/public/data/notifications`, `course_${sanitizeDocId(c.id)}`);
      await setDoc(indRef, { ...c, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}
  }

  setLocalCache(DEFAULT_COURSES);
  return DEFAULT_COURSES;
}

/**
 * Retorna os cursos do cache local ou padrão imediatamente (0ms de espera)
 */
export function getCachedCourses(): CourseOffer[] {
  const cached = getLocalCache();
  if (Array.isArray(cached) && cached.length > 0) {
    return cached.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
  }
  return DEFAULT_COURSES;
}

export async function getCoursesList(forceRefresh = false): Promise<CourseOffer[]> {
  // 1. Tentar ler do cache local primeiro se não for refresh forçado
  try {
    if (!forceRefresh && isLocalCacheFresh()) {
      const parsed = getLocalCache();
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
      }
    }
  } catch (err) {
    console.warn("Erro ao ler cache local de cursos:", err);
  }

  if (isFirestoreQuotaExhausted) {
    const cached = getLocalCache();
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    }
    return DEFAULT_COURSES;
  }

  // 2. Buscar do Firestore
  try {
    if (!auth.currentUser) {
      await loginAnon().catch(() => {});
    }

    const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
    const snap = await getDoc(catalogDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.courses)) {
        const cloudCourses: CourseOffer[] = data.courses;
        // Não reinjetamos DEFAULT_COURSES se o documento existe no Firestore:
        // O Firestore é a autoridade máxima, respeitando remoções e alterações do admin!
        const sorted = [...cloudCourses].sort(
          (a, b) => (Number(a.order) || 99) - (Number(b.order) || 99)
        );
        setLocalCache(sorted);
        return sorted;
      }
    }

    // Se o documento no Firestore ainda não existir, semear uma vez com os cursos padrão
    await seedDefaultCourses().catch(() => {});
    return DEFAULT_COURSES;
  } catch (err) {
    console.warn("Erro ao buscar cursos do Firestore, utilizando dados locais:", err);
    const cached = getLocalCache();
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    }
    return DEFAULT_COURSES;
  }
}

export async function saveCourseOffer(course: CourseOffer): Promise<void> {
  if (!auth.currentUser) {
    await loginAnon().catch(() => {});
  }

  // Otimiza imagens base64 para que nunca estourem limites de 1MB do documento
  let optimizedImageUrl = course.imageUrl;
  let optimizedAuthorPhotoUrl = course.authorPhotoUrl;

  if (course.imageUrl && course.imageUrl.startsWith("data:image/")) {
    optimizedImageUrl = await optimizeBase64IfNeeded(course.imageUrl, 600, 0.8);
  }

  if (course.authorPhotoUrl && course.authorPhotoUrl.startsWith("data:image/")) {
    optimizedAuthorPhotoUrl = await optimizeBase64IfNeeded(course.authorPhotoUrl, 320, 0.8);
  }

  const dataToSave: CourseOffer = {
    ...course,
    imageUrl: optimizedImageUrl,
    authorPhotoUrl: optimizedAuthorPhotoUrl,
    updatedAt: new Date().toISOString(),
  };

  // 1. Obter a lista mais atualizada diretamente do Firestore
  const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
  let currentList: CourseOffer[] = [];

  try {
    const snap = await getDoc(catalogDocRef);
    if (snap.exists() && Array.isArray(snap.data()?.courses)) {
      currentList = [...snap.data()?.courses];
    } else {
      const cached = getLocalCache();
      currentList = cached && cached.length > 0 ? [...cached] : [...DEFAULT_COURSES];
    }
  } catch (fetchErr) {
    console.warn("Aviso ao ler catálogo antes de salvar:", fetchErr);
    const cached = getLocalCache();
    currentList = cached && cached.length > 0 ? [...cached] : [...DEFAULT_COURSES];
  }

  // Atualiza ou insere o curso
  const existingIdx = currentList.findIndex((c) => c.id === dataToSave.id);
  if (existingIdx >= 0) {
    currentList[existingIdx] = dataToSave;
  } else {
    currentList.push(dataToSave);
  }

  currentList.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
  const sanitizedList = currentList.map(sanitizeCourseData);

  // 2. Gravar no documento mestre do Firestore
  try {
    await setDoc(
      catalogDocRef,
      {
        courses: sanitizedList,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error("Erro ao salvar documento mestre de cursos no Firestore:", err);
    throw new Error(err?.message || "Falha ao gravar curso no banco de dados.");
  }

  // 3. Salvar também no documento individual para redundância
  try {
    const indDocRef = doc(db, `artifacts/${appId}/public/data/notifications`, `course_${sanitizeDocId(dataToSave.id)}`);
    await setDoc(indDocRef, { ...sanitizeCourseData(dataToSave), updatedAt: new Date().toISOString() }, { merge: true });
  } catch (indErr) {
    console.warn("Aviso ao salvar documento individual redundante:", indErr);
  }

  // 4. Atualizar cache local
  setLocalCache(currentList);
}

export async function deleteCourseOffer(courseId: string): Promise<void> {
  if (!auth.currentUser) {
    await loginAnon().catch(() => {});
  }

  const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
  let currentList: CourseOffer[] = [];

  try {
    const snap = await getDoc(catalogDocRef);
    if (snap.exists() && Array.isArray(snap.data()?.courses)) {
      currentList = [...snap.data()?.courses];
    } else {
      const cached = getLocalCache();
      currentList = cached || [...DEFAULT_COURSES];
    }
  } catch {
    const cached = getLocalCache();
    currentList = cached || [...DEFAULT_COURSES];
  }

  const filteredList = currentList.filter((c) => c.id !== courseId);
  const sanitizedList = filteredList.map(sanitizeCourseData);

  // Gravar catálogo atualizado no Firestore (sem merge para garantir exclusão do item)
  try {
    await setDoc(
      catalogDocRef,
      {
        courses: sanitizedList,
        updatedAt: new Date().toISOString(),
      },
      { merge: false }
    );
  } catch (err: any) {
    console.error("Erro ao remover curso no Firestore:", err);
    throw new Error(err?.message || "Falha ao excluir curso no banco de dados.");
  }

  // Deletar também documento individual redundante se existir
  try {
    const indDocRef = doc(db, `artifacts/${appId}/public/data/notifications`, `course_${sanitizeDocId(courseId)}`);
    await deleteDoc(indDocRef);
  } catch {}

  // Atualizar cache local
  setLocalCache(filteredList);
}

export async function toggleCourseOfferStatus(courseId: string, active: boolean): Promise<void> {
  if (!auth.currentUser) {
    await loginAnon().catch(() => {});
  }

  const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
  let currentList: CourseOffer[] = [];

  try {
    const snap = await getDoc(catalogDocRef);
    if (snap.exists() && Array.isArray(snap.data()?.courses)) {
      currentList = [...snap.data()?.courses];
    } else {
      const cached = getLocalCache();
      currentList = cached || [...DEFAULT_COURSES];
    }
  } catch {
    const cached = getLocalCache();
    currentList = cached || [...DEFAULT_COURSES];
  }

  const updatedList = currentList.map((c) =>
    c.id === courseId ? { ...c, active, updatedAt: new Date().toISOString() } : c
  );
  const sanitizedList = updatedList.map(sanitizeCourseData);

  try {
    await setDoc(
      catalogDocRef,
      {
        courses: sanitizedList,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error("Erro ao alterar status no Firestore:", err);
    throw new Error(err?.message || "Falha ao atualizar status.");
  }

  try {
    const indDocRef = doc(db, `artifacts/${appId}/public/data/notifications`, `course_${sanitizeDocId(courseId)}`);
    await setDoc(indDocRef, { active, updatedAt: new Date().toISOString() }, { merge: true });
  } catch {}

  setLocalCache(updatedList);
}

/**
 * Escuta atualizações em tempo real no catálogo de cursos do Firestore
 */
export function subscribeToCourses(callback: (courses: CourseOffer[]) => void): () => void {
  // Dispara imediatamente com o cache local se disponível
  const cached = getLocalCache();
  if (cached && cached.length > 0) {
    callback(cached);
  }

  if (!auth.currentUser) {
    loginAnon().catch(() => {});
  }

  const catalogDocRef = doc(db, MASTER_CATALOG_DOC_PATH);
  const unsub = onSnapshot(
    catalogDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.courses)) {
          const sorted = [...data.courses].sort(
            (a, b) => (Number(a.order) || 99) - (Number(b.order) || 99)
          );
          setLocalCache(sorted);
          callback(sorted);
        }
      }
    },
    (err) => {
      console.warn("Notice in subscribeToCourses listener:", err?.message || err);
    }
  );

  return unsub;
}
