import { useState, useEffect, useRef, ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder, useDragControls } from "motion/react";
import { GraduationCap, Landmark, Image as ImageIcon, FileText, CheckCircle, Trash2, Pin, MessageSquare, BarChart2, Check, ExternalLink, X, Pencil, GripVertical, Heart, Send, MessageCircle } from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDoc, getDocs, limit, arrayUnion, arrayRemove } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth, appId, handleFirestoreError, OperationType } from "../lib/firebase";
import { MuralPost, Member, MuralComment } from "../types";
import { useSettings } from "../context/SettingsContext";
import WhatsappMuralView from "./WhatsappMuralView";

export default function MuralPage({ forcedTab, hideTabs }: { forcedTab?: "academico" | "seminario", hideTabs?: boolean } = {}) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { settings, updateSettings } = useSettings();
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<"academico" | "seminario">(forcedTab || "academico");
  // Form states...
  const [posts, setPosts] = useState<MuralPost[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
    if (cachedMemberStr) {
      try {
        const m = JSON.parse(cachedMemberStr) as Member;
        if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
          return true;
        }
      } catch(e) {}
    }
    return false;
  });
  const [currentUserData, setCurrentUserData] = useState<{ id: string, name: string, photoUrl?: string, roles?: string[] } | null>(() => {
    const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
    if (cachedMemberStr) {
      try {
        const m = JSON.parse(cachedMemberStr) as Member;
        return { id: m.id, name: m.name, photoUrl: m.photoUrl, roles: m.roles };
      } catch(e) {}
    }
    return null;
  });
  const myUserId = currentUserData?.id || auth.currentUser?.uid || "anonymous";

  // Form states
  const [isComposing, setIsComposing] = useState(false);
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState<"message" | "poll">("message");
  const [externalLink, setExternalLink] = useState("");
  const [externalLinkType, setExternalLinkType] = useState<"link" | "image" | "video" | "document">("link");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isAnonymousPoll, setIsAnonymousPoll] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [localOrder, setLocalOrder] = useState<MuralPost[]>([]);
  const getDefaultSemester = () => new Date().getMonth() <= 6 ? -1 : -2;
  const [expiresIn, setExpiresIn] = useState<number | null>(getDefaultSemester()); // Admin auto-delete
  const [postAsAdmin, setPostAsAdmin] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Delete expired posts cleanly if admin, hide for everyone else
    if (isAdmin) {
      posts.forEach(post => {
         if (post.expiresAt && typeof post.expiresAt === 'number' && Date.now() > post.expiresAt) {
            deleteDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id)).catch(console.error);
         }
      });
    }

    setLocalOrder(posts.filter(post => {
      if (post.expiresAt && typeof post.expiresAt === 'number' && Date.now() > post.expiresAt) {
        return false;
      }
      return isAdmin || post.status === "approved" || post.authorId === myUserId;
    }));
  }, [posts, isAdmin, myUserId]);

  const handleDragEnd = async () => {
    if (!isAdmin) return;
    try {
      for (let i = 0; i < localOrder.length; i++) {
        const post = localOrder[i];
        if (post.orderIndex !== i) {
          updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id), { orderIndex: i })
            .catch(err => console.error("Update error for orderIndex:", err));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalVotes = (post: MuralPost) => post.pollOptions?.reduce((acc, opt) => acc + opt.votes, 0) || 0;

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user && !user.isAnonymous) {
        setIsAdmin(true);
        if (user.email) {
          try {
            const q = query(
              collection(db, `artifacts/${appId}/public/data/students`),
              where("email", "==", user.email),
              limit(1)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              const m = snapshot.docs[0].data() as Member;
              setCurrentUserData({ id: snapshot.docs[0].id, name: m.name, photoUrl: m.photoUrl, roles: m.roles });
            }
          } catch(e) {
            console.error("Failed to fetch admin profile:", e);
          }
        }
      } else {
        // If not a management user, check student profile for roles
        const bondedId = localStorage.getItem("davveroId_student_identity");
        const cachedMemberStr = localStorage.getItem("davveroId_cached_member");
        if (cachedMemberStr) {
          try {
             const m = JSON.parse(cachedMemberStr) as Member;
             setCurrentUserData({ id: m.id, name: m.name, photoUrl: m.photoUrl, roles: m.roles });
             if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
               setIsAdmin(true);
             }
          } catch(e) {}
        }
        
        if (bondedId) {
          const q = query(
            collection(db, `artifacts/${appId}/public/data/students`),
            where("alphaCode", "==", bondedId),
            limit(1)
          );
          onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
            if (!snap.empty) {
              const m = snap.docs[0].data() as Member;
              setCurrentUserData({ id: snap.docs[0].id, name: m.name, photoUrl: m.photoUrl, roles: m.roles });
              if (m.roles && m.roles.some(r => ['admin', 'diretoria', 'gestão', 'comunicação', 'secretaria'].includes(r.toLowerCase()))) {
                setIsAdmin(true);
              }
            }
          });
        }
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `artifacts/${appId}/public/data/mural_posts`),
      where("tabFn", "==", activeTab)
    );

    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const fetched: MuralPost[] = [];
      snap.forEach(doc => fetched.push({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as MuralPost));
      
      // Sorting rules:
      // 1. Pinned posts always stay at the top.
      // 2. Custom ordering via orderIndex (new posts without orderIndex act as -1 and stay above ordered posts).
      // 3. Fallback to createdAt.
      fetched.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : -1;
        const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : -1;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setPosts(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `artifacts/${appId}/public/data/mural_posts`);
    });

    return () => unsub();
  }, [activeTab]);

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, ""]);
  };

  const updatePollOption = (index: number, val: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = val;
    setPollOptions(newOptions);
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert("Apenas administradores podem fazer upload de arquivos.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Se for imagem, vamos converter para Base64 comprimido para evitar erros de CORS no Storage
    if (file.type.startsWith('image/')) {
      setIsUploading(true);
      setUploadProgress(20);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setUploadProgress(50);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar mantendo proporção (max 1600px para qualidade superior)
          const MAX_SIZE = 1600;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Comprimir para JPEG (qualidade 0.85 para evitar embaçado)
          let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          
          // Verificar tamanho (Firestore tem limite de 1MB por documento)
          // Em Base64, 1 caracter = 1 byte (aproximadamente). O limite rígido é 1,048,576 bytes.
          if (dataUrl.length > 1000000) { 
             dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          }
          if (dataUrl.length > 1000000) { 
             dataUrl = canvas.toDataURL('image/jpeg', 0.4);
          }
          
          if (dataUrl.length > 1000000) {
             alert("⚠️ A imagem é muito grande para salvar diretamente.\n\nTente uma imagem menor.");
             setIsUploading(false);
             setUploadProgress(0);
             return;
          }
          
          setExternalLink(dataUrl);
          setExternalLinkType('image');
          setUploadProgress(100);
          setTimeout(() => setIsUploading(false), 500);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      return;
    }

    // Se for PDF pequeno (< 600KB), também converte para Base64 para evitar erro de CORS
    if (file.type === 'application/pdf' && file.size < 600000) {
      setIsUploading(true);
      setUploadProgress(50);
      const reader = new FileReader();
      reader.onload = (event) => {
         const dataUrl = event.target?.result as string;
         // Segurança: limite do firestore é 1MB. 600KB de arquivo ~ 800KB em Base64
         if (dataUrl.length < 900000) {
            setExternalLink(dataUrl);
            setExternalLinkType('document');
            setUploadProgress(100);
            setTimeout(() => setIsUploading(false), 500);
         } else {
            alert("O PDF ficou muito grande após conversão. Para enviar este arquivo, configure o CORS do Firebase Storage.");
            setIsUploading(false);
            setUploadProgress(0);
         }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Check size (max 5MB via Storage devido ao CORS)
    if (file.size > 5 * 1024 * 1024) {
      alert("⚠️ Arquivo maior que 5MB.\n\nPor favor, envie um arquivo menor ou utilize o Google Drive colando o link no chat.");
      return;
    }

    console.log("Preparando upload:", file.name, file.type, file.size);
    setIsUploading(true);
    setUploadProgress(10);
    
    // Remover maxUploadRetryTime curto para não quebrar uploads lentos com CORS habilitado.
    
    try {
      // Ensure we have an auth session (or ignore if it fails, fallback to rules)
      if (!auth.currentUser) {
        try {
          console.log("Nenhum usuário detectado, tentando login anônimo...");
          setUploadProgress(20);
          await signInAnonymously(auth);
          console.log("Login anônimo realizado com sucesso.");
        } catch (authErr) {
          console.log("Login anônimo falhou (pode estar desabilitado), prosseguindo com upload...", authErr);
        }
      }

      setUploadProgress(40);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      // Usar o caminho correto conforme definido nas rules
      const storageRef = ref(storage, `artifacts/${appId}/mural_uploads/${fileName}`);
      
      console.log("Fazendo upload para:", storageRef.fullPath);
      
      const uploadPromise = uploadBytes(storageRef, file, {
        cacheControl: 'public,max-age=31536000',
        contentType: file.type || 'application/octet-stream'
      });

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 500);

      try {
        const uploadResult = await uploadPromise;
        clearInterval(progressInterval);
        
        console.log("Upload bem sucedido!");
        setUploadProgress(95);
        
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        setExternalLink(downloadUrl);
        
        if (file.type.startsWith('image/')) {
          setExternalLinkType('image');
        } else if (file.type === 'application/pdf' || file.type.toLowerCase().includes('word') || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
          setExternalLinkType('document');
        } else {
          setExternalLinkType('link');
        }

        setUploadProgress(100);
        console.log("URL de download obtida:", downloadUrl);
        setTimeout(() => setIsUploading(false), 500);
      } catch (uploadErr) {
        clearInterval(progressInterval);
        throw uploadErr;
      }
    } catch (err: any) {
      console.error("Erro crítico no upload:", err);
      let msg = "Erro ao enviar arquivo.";
      
      if (err.code === "auth/operation-not-allowed") {
         msg = "Login anônimo não está habilitado no Firebase Authentication.";
      } else if (err.code === "storage/unauthorized") {
        msg = "Sem permissão no Firebase Storage. Verifique as regras de segurança.";
      } else if (err.code === "storage/retry-limit-exceeded" || err.message?.includes("CORS")) {
        msg = "Não foi possível conectar ao Storage (Tempo Limite/CORS).\n\nPara consertar isso, você precisa configurar o CORS no seu Firebase Storage, autorizando os dominíos da sua aplicação web.";
      }
      
      alert(`⚠️ FALHA NO UPLOAD:\n\n${msg}\n\nDetalhes Técnicos: ${err.code || 'erro_desconhecido'}\n${err.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!postText.trim() && !externalLink.trim()) return;
    if (postType === "poll" && pollOptions.filter(o => o.trim()).length < 2) return;

    setIsSubmitting(true);
    try {
      const formattedPollOptions = postType === "poll" 
        ? pollOptions.filter(o => o.trim()).map(text => ({ id: Math.random().toString(36).substr(2, 9), text, votes: 0 }))
        : [];

      const newPost = {
        tabFn: activeTab,
        authorId: currentUserData?.id || (isAdmin ? "admin" : myUserId),
        authorName: isAdmin && postAsAdmin ? "Administrador" : (currentUserData?.name || (isAdmin ? "Administrador" : "Estudante")),
        authorPhotoUrl: isAdmin && postAsAdmin ? null : (currentUserData?.photoUrl || null),
        text: postText.trim(),
        type: postType,
        mediaUrl: externalLink.trim() ? (
          externalLinkType === 'image' && externalLink.includes('drive.google.com/file/d/')
            ? `https://drive.google.com/uc?export=view&id=${externalLink.split('/d/')[1]?.split('/')[0] || ''}`
          : externalLinkType === 'document' && externalLink.includes('drive.google.com/file/d/')
            ? `https://drive.google.com/file/d/${externalLink.split('/d/')[1]?.split('/')[0] || ''}/preview`
          : externalLinkType === 'video' && externalLink.includes('youtube.com/watch')
            ? `https://www.youtube.com/embed/${new URLSearchParams(new URL(externalLink).search).get('v')}`
          : externalLinkType === 'video' && externalLink.includes('youtu.be/')
            ? `https://www.youtube.com/embed/${externalLink.split('youtu.be/')[1]?.split('?')[0]}`
          : externalLink.trim()
        ) : null,
        mediaType: externalLink.trim() ? externalLinkType : null,
        pollOptions: formattedPollOptions,
        isAnonymousPoll: postType === "poll" ? isAnonymousPoll : undefined,
        votedUserIds: [],
        voterDetails: [],
        createdAt: serverTimestamp(),
        isPinned: false,
        status: isAdmin ? "approved" : "pending",
        isAdminPost: isAdmin,
        expiresAt: expiresIn === -1 
          ? (() => {
              const now = new Date();
              let year = now.getFullYear();
              if (now.getMonth() > 6) year++; // if beyond July, next year's 1st semester
              return new Date(year, 6, 31, 23, 59, 59).getTime(); // July 31st
            })()
          : expiresIn === -2
          ? (() => {
              const now = new Date();
              return new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime(); // December 31st
            })()
          : expiresIn 
          ? Date.now() + expiresIn * 24 * 60 * 60 * 1000 
          : null
      };

      await addDoc(collection(db, `artifacts/${appId}/public/data/mural_posts`), newPost);
      
      setPostText("");
      setExternalLink("");
      setExternalLinkType("link");
      setPostType("message");
      setPollOptions(["", ""]);
      setIsAnonymousPoll(true);
      setExpiresIn(getDefaultSemester());
      setIsComposing(false);
      setIsSubmitting(false);

      if (!isAdmin) {
        alert("Sua publicação foi enviada para aprovação! Ela aparecerá no mural para os outros alunos assim que um administrador aprovar.");
      }
    } catch (err) {
      console.error("Erro ao enviar publicação:", err);
      if (err instanceof Error && err.message.includes('permission')) {
          alert('Você não tem permissões no seu Firebase, por favor veja o aviso REGRAS_FIREBASE_CORRECAO.md!\n\nErro: ' + err.message);
          setIsSubmitting(false);
          handleFirestoreError(err, OperationType.CREATE, `artifacts/${appId}/public/data/mural_posts`);
      } else {
          alert("Erro ao enviar publicação: " + (err instanceof Error ? err.message : String(err)));
          setIsSubmitting(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPostId || !editContent.trim()) return;
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, editingPostId), {
        text: editContent.trim()
      });
      setEditingPostId(null);
      setEditContent("");
    } catch (err) {
      console.error("Erro ao salvar edição:", err);
      alert("Erro ao atualizar!");
    }
  };

  const handleVote = async (post: MuralPost, optionId: string) => {
    const voterId = currentUserData?.id || auth.currentUser?.uid;
    const voterName = currentUserData?.name || "Usuário";
    if (!voterId) return;
    
    if (post.votedUserIds?.includes(voterId)) {
      alert("Você já votou nesta enquete.");
      return;
    }

    const updatedOptions = post.pollOptions?.map(opt => 
      opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
    );

    const newVoterDetail = { userId: voterId, userName: voterName, optionId };

    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id), {
        pollOptions: updatedOptions,
        votedUserIds: [...(post.votedUserIds || []), voterId],
        voterDetails: [...(post.voterDetails || []), newVoterDetail]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const approvePost = async (id: string) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, id), { status: "approved" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const togglePin = async (post: MuralPost) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id), { isPinned: !post.isPinned });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  const deletePost = async (id: string) => {
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/mural_posts`, id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `artifacts/${appId}/public/data/mural_posts`);
    }
  };

  if (settings.useWhatsappMural) {
    return <WhatsappMuralView isAdmin={isAdmin} userRoles={currentUserData?.roles || []} whatsappGroups={settings.whatsappGroups || []} whatsappCategories={settings.whatsappCategories || []} customRoles={settings.customRoles || []} updateSettings={updateSettings as any} />;
  }

  // Identify visible posts

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
        {isOffline && (
          <div className="absolute top-0 left-0 w-full bg-amber-500 text-amber-950 font-bold text-[10px] uppercase tracking-widest py-1 flex items-center justify-center z-20">
             Modo Offline (As publicações serão enviadas quando conectar)
          </div>
        )}
        <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10">
           <MessageSquare className="w-32 h-32 text-indigo-400" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 relative z-10">
          Mural de Recados
        </h2>
        <p className="text-xs text-slate-400 mt-2 relative z-10">
          Avisos, enquetes e comunicados importantes para a comunidade.
        </p>
      </div>

      {!hideTabs && (
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab("academico")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "academico"
                ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Acadêmico
          </button>
          <button
            onClick={() => setActiveTab("seminario")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "seminario"
                ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Landmark className="w-4 h-4" />
            Seminário
          </button>
        </div>
      )}

      {!isComposing && (
        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setIsComposing(true)} 
          className="w-full p-6 rounded-3xl bg-white dark:bg-slate-800 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-400 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm group"
        >
           <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
             <MessageSquare className="w-5 h-5" />
           </div>
           Compartilhar algo com a turma
        </motion.button>
      )}

      <AnimatePresence>
        {isComposing && (
          <motion.div
             initial={{ opacity: 0, height: 0 }}
             animate={{ opacity: 1, height: "auto" }}
             exit={{ opacity: 0, height: 0 }}
             className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
          >
             <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                <button onClick={() => setPostType("message")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${postType === 'message' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}><MessageSquare className="w-3 h-3 inline-block mr-1"/> Mensagem</button>
                <button onClick={() => setPostType("poll")} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${postType === 'poll' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}><BarChart2 className="w-3 h-3 inline-block mr-1"/> Enquete</button>
             </div>
             
             <textarea 
                placeholder="Escreva sua publicação..."
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm min-h-[100px] border-none outline-none resize-y ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                value={postText}
                onChange={e => setPostText(e.target.value)}
             />

             {postType === "message" && (
                <div className="flex flex-col gap-2">
                   {isAdmin ? (
                     <>
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold uppercase text-slate-500 text-left">Anexo ou Link Externo</p>
                          <div className="relative">
                             <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading || isOffline}
                                className={`h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm ${(isUploading || isOffline) ? 'bg-slate-100 text-slate-400 cursor-not-allowed overflow-hidden' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                             >
                                {isUploading ? (
                                   <>
                                      <motion.div 
                                         className="absolute inset-y-0 left-0 bg-white/20"
                                         initial={{ width: 0 }}
                                         animate={{ width: `${uploadProgress}%` }}
                                      />
                                      <span className="relative z-10 flex items-center gap-1.5">
                                         <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                         {Math.round(uploadProgress)}%
                                      </span>
                                   </>
                                ) : (
                                   <>
                                      <ImageIcon className="w-3.5 h-3.5" /> Fazer Upload
                                   </>
                                )}
                             </motion.button>
                          </div>
                          <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             onChange={handleFileUpload}
                             accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select 
                             value={externalLinkType}
                             onChange={e => setExternalLinkType(e.target.value as any)}
                             className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 w-full sm:w-48"
                          >
                             <option value="link">Link Comum</option>
                             <option value="image">Exibir como Imagem</option>
                             <option value="video">Embutir Vídeo</option>
                             <option value="document">Exibir Documento (PDF/Docs)</option>
                          </select>
                          <input 
                             type="url" 
                             placeholder="https://..."
                             value={externalLink}
                             onChange={e => setExternalLink(e.target.value)}
                             className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                     </>
                   ) : (
                     <div>
                        <p className="text-xs font-bold uppercase text-slate-500 text-left mb-1">Link Externo (Opcional)</p>
                        <input 
                           type="url" 
                           placeholder="https://..."
                           value={externalLink}
                           onChange={e => {
                             setExternalLink(e.target.value);
                             setExternalLinkType("link"); // Forçar link comum para não administradores
                           }}
                           className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border-none outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500"
                        />
                     </div>
                   )}
                </div>
             )}

             {postType === "poll" && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-xs font-bold uppercase text-slate-500">Opções da Enquete</p>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isAnonymousPoll} onChange={e => setIsAnonymousPoll(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 outline-none border-slate-300" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Voto Anônimo</span>
                     </label>
                   </div>
                   {pollOptions.map((opt, i) => (
                     <div key={i} className="flex gap-2">
                        <input value={opt} onChange={e => updatePollOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-sm border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        {pollOptions.length > 2 && <button onClick={() => handleRemovePollOption(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>}
                     </div>
                   ))}
                   {pollOptions.length < 5 && (
                     <button onClick={handleAddPollOption} className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-2 hover:underline">+ Nova Opção</button>
                   )}
                </div>
             )}

             {isAdmin && (
                <div className="space-y-2">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between">
                     <p className="text-xs font-bold uppercase text-slate-500">Postar Como</p>
                     <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                       <button onClick={() => setPostAsAdmin(true)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${postAsAdmin ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Administrador</button>
                       <button onClick={() => setPostAsAdmin(false)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!postAsAdmin ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Eu Mesmo</button>
                     </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between">
                     <p className="text-xs font-bold uppercase text-slate-500">Apagar Automaticamente</p>
                     <select 
                        value={expiresIn === null ? "" : expiresIn} 
                        onChange={e => setExpiresIn(e.target.value ? Number(e.target.value) : null)}
                        className="p-2 bg-white dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-300"
                     >
                       <option value="">Nunca (Fixo)</option>
                       <option value="-1">Fim do 1º Semestre (Julho)</option>
                       <option value="-2">Fim do 2º Semestre (Dezembro)</option>
                       <option value="15">Em 15 dias</option>
                       <option value="30">Em 30 dias</option>
                       <option value="60">Em 60 dias</option>
                       <option value="150">Em 5 meses</option>
                     </select>
                  </div>
                </div>
             )}

             <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setIsComposing(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isSubmitting} 
                  onClick={handleSubmit} 
                  className="px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 transition-all shadow-xl shadow-green-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2 group"
                >
                  {isSubmitting ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  )}
                  {isSubmitting ? "Enviando..." : "Publicar agora"}
                </motion.button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
         {localOrder.length === 0 ? (
           <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8">
             <div className="text-center space-y-4 max-w-sm">
               <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                 {activeTab === "academico" ? <GraduationCap className="w-8 h-8" /> : <Landmark className="w-8 h-8" />}
               </div>
               <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                 Nenhuma publicação
               </h3>
             </div>
           </div>
         ) : (
           <Reorder.Group axis="y" values={localOrder} onReorder={setLocalOrder} className="space-y-4">
            {localOrder.map(post => (
              <MuralPostItem
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                myUserId={myUserId}
                currentUserData={currentUserData}
                approvePost={approvePost}
                togglePin={togglePin}
                setEditingPostId={setEditingPostId}
                setEditContent={setEditContent}
                editingPostId={editingPostId}
                editContent={editContent}
                handleSaveEdit={handleSaveEdit}
                setDeleteConfirmId={setDeleteConfirmId}
                handleVote={handleVote}
                totalVotes={totalVotes}
                handleDragEnd={handleDragEnd}
              />
            ))}
           </Reorder.Group>
         )}
     </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setDeleteConfirmId(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700 text-center animate-in fade-in zoom-in duration-200"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 mx-auto rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Excluir Publicação?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Esta ação não poderá ser desfeita. O recado será removido permanentemente do mural.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deletePost(deleteConfirmId)}
                className="py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

interface MuralPostItemProps {
  key?: string | number;
  post: MuralPost;
  isAdmin: boolean;
  myUserId?: string;
  currentUserData: { id: string; name: string; photoUrl?: string; roles?: string[] } | null;
  approvePost: (id: string) => Promise<void>;
  togglePin: (post: MuralPost) => Promise<void>;
  setEditingPostId: (id: string | null) => void;
  setEditContent: (content: string) => void;
  editingPostId: string | null;
  editContent: string;
  handleSaveEdit: () => Promise<void>;
  setDeleteConfirmId: (id: string | null) => void;
  handleVote: (post: MuralPost, optionId: string) => Promise<void>;
  totalVotes: (post: MuralPost) => number;
  handleDragEnd: () => Promise<void>;
}

function MuralPostItem({
  post,
  isAdmin,
  myUserId,
  currentUserData,
  approvePost,
  togglePin,
  setEditingPostId,
  setEditContent,
  editingPostId,
  editContent,
  handleSaveEdit,
  setDeleteConfirmId,
  handleVote,
  totalVotes,
  handleDragEnd
}: MuralPostItemProps) {
  const controls = useDragControls();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<MuralComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [isSavingEditComment, setIsSavingEditComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const hasLiked = post.likes?.includes(myUserId || "");

  const handleToggleLike = async () => {
    if (!myUserId || isLiking) return;
    setIsLiking(true);
    try {
      const postRef = doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id);
      if (hasLiked) {
        await updateDoc(postRef, { likes: arrayRemove(myUserId) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(myUserId) });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    if (!isCommentsOpen) return;
    const q = query(
      collection(db, `artifacts/${appId}/public/data/mural_posts/${post.id}/comments`),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched: MuralComment[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as MuralComment));
      setComments(fetched);
    });
    return () => unsub();
  }, [isCommentsOpen, post.id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUserData) return;
    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/mural_posts/${post.id}/comments`), {
        postId: post.id,
        authorId: currentUserData.id,
        authorName: currentUserData.name,
        authorPhotoUrl: currentUserData.photoUrl || null,
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment("");
      
      const postRef = doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id);
      await updateDoc(postRef, { commentsCount: (post.commentsCount || 0) + 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Deseja apagar este comentário?")) return;
    setIsDeletingComment(true);
    try {
      console.log(`Tentando excluir comentário ${commentId} do post ${post.id}`);
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/mural_posts/${post.id}/comments`, commentId));
      const postRef = doc(db, `artifacts/${appId}/public/data/mural_posts`, post.id);
      await updateDoc(postRef, { 
        commentsCount: (post.commentsCount && post.commentsCount > 0) ? (post.commentsCount - 1) : 0 
      });
      console.log("Comentário excluído com sucesso");
    } catch (err: any) {
      console.error("Erro ao apagar comentário", err);
      alert("Erro ao excluir: " + (err.message || "Permissão negada"));
    } finally {
      setIsDeletingComment(false);
    }
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    setIsSavingEditComment(true);
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/mural_posts/${post.id}/comments`, commentId), {
        text: editCommentText.trim()
      });
      setEditingCommentId(null);
      setEditCommentText("");
    } catch (err) {
      console.error("Erro ao editar comentário", err);
    } finally {
      setIsSavingEditComment(false);
    }
  };

  return (
    <Reorder.Item 
      value={post}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onDragEnd={handleDragEnd}
      dragListener={false}
      dragControls={controls}
      className={`p-5 rounded-3xl border transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 ${post.isPinned ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} relative`}
    >
       {post.isPinned && (
         <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
           <Pin className="w-3 h-3" /> <span className="text-[10px] font-black uppercase tracking-widest">Fixado</span>
         </div>
       )}
       
       <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner overflow-hidden ${post.isAdminPost ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                {post.authorPhotoUrl ? (
                  <img src={post.authorPhotoUrl} alt={post.authorName} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  post.isAdminPost ? <CheckCircle className="w-5 h-5"/> : <GraduationCap className="w-5 h-5"/>
                )}
             </div>
             <div>
                <p className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">{post.authorName} {post.isAdminPost && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Admin</span>}</p>
                <p className="text-[10px] text-slate-500 font-medium">
                   {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString('pt-BR') : 'Aguarde...'}
                </p>
             </div>
          </div>
          
          {/* Status Badge & Admn Controls */}
          <div className="flex items-center gap-2">
            {post.status === "pending" && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] rounded-lg font-bold uppercase">Pendente</span>
            )}
            {(isAdmin || post.authorId === myUserId) && (
              <div className="flex items-center gap-1">
                 {isAdmin && post.status === "pending" && (
                   <button onClick={() => approvePost(post.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md" title="Aprovar">
                     <Check className="w-4 h-4"/>
                   </button>
                 )}
                 {isAdmin && (
                   <button onClick={() => togglePin(post)} className={`p-1.5 rounded-md ${post.isPinned ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'}`} title={post.isPinned ? "Desafixar" : "Fixar no topo"}>
                      <Pin className="w-4 h-4"/>
                   </button>
                 )}
                    <button onClick={() => { setEditingPostId(post.id); setEditContent(post.text); }} className="p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded-md" title="Editar">
                      <Pencil className="w-4 h-4"/>
                    </button>
                  <button onClick={() => setDeleteConfirmId(post.id)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-md" title="Apagar Publicação">
                    <Trash2 className="w-4 h-4"/>
                 </button>
                 {isAdmin && (
                   <div 
                     onPointerDown={(e) => controls.start(e)}
                     className="p-1.5 mt-1 cursor-grab active:cursor-grabbing transition-colors rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700" 
                     title="Arraste para reordenar"
                     style={{ touchAction: 'none' }}
                   >
                     <GripVertical className="w-5 h-5" />
                   </div>
                 )}
              </div>
            )}
          </div>
       </div>

       {editingPostId === post.id ? (
         <div className="mt-4">
           <textarea 
             value={editContent} 
             onChange={e => setEditContent(e.target.value)}
             className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
             rows={4}
           />
           <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setEditingPostId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleSaveEdit} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Salvar</button>
           </div>
         </div>
       ) : (
         <div className="mt-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {post.text}
         </div>
       )}

       {post.mediaUrl && (
          <div className="mt-4">
            {(post.mediaType === 'image' || post.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || post.mediaUrl.includes('drive.google.com/uc?export=view')) ? (
               <div className="rounded-xl overflow-hidden cursor-pointer bg-transparent flex justify-center" onClick={() => window.open(post.mediaUrl!, '_blank')}>
                 <img 
                    src={post.mediaUrl} 
                    alt="Visualização" 
                    loading="lazy"
                    className="w-full h-auto object-contain hover:opacity-95 transition-opacity rounded-xl" 
                    referrerPolicy="no-referrer"
                 />
               </div>
            ) : post.mediaType === 'pdf' || post.mediaUrl.match(/\.pdf$/i) || post.mediaUrl.startsWith('data:application/pdf') ? (
               <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
                 <object 
                    data={post.mediaUrl} 
                    type="application/pdf"
                    className="w-full h-[60vh] min-h-[500px] border-0" 
                 >
                    <div className="p-8 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800">
                       <FileText className="w-12 h-12 text-slate-400 mb-3"/>
                       <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-4">Pré-visualização não suportada pelo navegador no momento.</p>
                       <a href={post.mediaUrl} download="documento.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors rounded-xl font-bold text-xs shadow-sm">
                          Baixar Documento PDF
                       </a>
                    </div>
                 </object>
                 <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                   <span className="text-xs font-medium text-slate-500 uppercase tracking-widest pl-2">Documento PDF</span>
                   <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" download="documento.pdf" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                     <ExternalLink className="w-3.5 h-3.5" /> 
                     Abrir / Baixar
                   </a>
                 </div>
               </div>
            ) : (post.mediaType === 'video' || (post.mediaType === 'document' && !post.mediaUrl.startsWith('data:')) || post.mediaUrl.includes('youtube.com/embed') || post.mediaUrl.includes('youtu.be/') || post.mediaUrl.includes('/preview') || post.mediaUrl.includes('.docx') || post.mediaUrl.includes('.doc')) ? (
               <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                 <iframe 
                    src={post.mediaUrl.includes('firebasestorage') && (post.mediaUrl.toLowerCase().includes('.docx') || post.mediaUrl.toLowerCase().includes('.doc')) 
                      ? `https://docs.google.com/viewer?url=${encodeURIComponent(post.mediaUrl)}&embedded=true` 
                      : post.mediaUrl} 
                    className="w-full aspect-video border-0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                 </iframe>
               </div>
            ) : (post.mediaType === 'document' && post.mediaUrl.startsWith('data:')) ? (
               <a href={post.mediaUrl} download="documento.pdf" className="inline-flex items-center gap-3 px-6 py-4 bg-indigo-50 dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-slate-700 transition-colors group shadow-sm">
                  <div className="w-10 h-10 bg-indigo-200/50 dark:bg-indigo-900/80 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                     <FileText className="w-5 h-5"/> 
                  </div>
                  Baixar Anexo
               </a>
            ) : (
               <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 text-sm font-bold truncate max-w-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ExternalLink className="w-5 h-5 flex-shrink-0"/> <span className="truncate">{post.mediaUrl}</span>
               </a>
            )}
         </div>
       )}

       {post.type === "poll" && post.pollOptions && (
         <div className="mt-5 space-y-2">
            {post.pollOptions.map((opt) => {
              const vTotal = totalVotes(post);
              const percentage = vTotal > 0 ? Math.round((opt.votes / vTotal) * 100) : 0;
              
              return (
                <button 
                  key={opt.id} 
                  onClick={() => handleVote(post, opt.id)}
                  className="w-full relative group overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                >
                   <div className="absolute top-0 left-0 bottom-0 bg-indigo-100 dark:bg-indigo-900/30 transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
                   <div className="relative z-10 flex justify-between items-center text-sm font-medium">
                      <span className="text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">{opt.text}</span>
                      <span className="text-xs font-bold text-slate-500">{percentage}% ({opt.votes})</span>
                   </div>
                </button>
              )
            })}
            
            <div className="flex justify-between items-end mt-2">
               {post.isAnonymousPoll === false ? (
                  <div className="flex-1">
                     <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Quem votou:</p>
                     <div className="flex flex-wrap gap-1">
                       {(post.voterDetails || []).map((vote, idx) => {
                          const optText = post.pollOptions?.find(o => o.id === vote.optionId)?.text || "Opção";
                          return (
                            <span key={idx} className="text-[9px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md text-slate-500" title={optText}>
                               {vote.userName}
                            </span>
                          );
                       })}
                       {(!post.voterDetails || post.voterDetails.length === 0) && <span className="text-[9px] text-slate-400">Nenhum voto ainda.</span>}
                     </div>
                  </div>
               ) : (
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-2">Enquete Anônima</p>
                  </div>
               )}
               <p className="text-[10px] uppercase font-bold text-slate-400 text-right shrink-0">{totalVotes(post)} votos no total</p>
            </div>
         </div>
       )}

       <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <button 
             onClick={handleToggleLike}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${hasLiked ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
           >
             <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
             <span>{post.likes?.length || 0}</span>
           </button>
           <button 
             onClick={() => setIsCommentsOpen(!isCommentsOpen)}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isCommentsOpen ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
           >
             <MessageCircle className="w-4 h-4" />
             <span>{post.commentsCount || 0}</span>
           </button>
         </div>
       </div>

       <AnimatePresence>
         {isCommentsOpen && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden mt-3"
           >
             <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60">
               <div className="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                 {comments.length === 0 ? (
                   <p className="text-xs text-slate-500 text-center py-2">Sem comentários ainda. Seja o primeiro!</p>
                 ) : (
                   comments.map(c => (
                     <div key={c.id} className="flex gap-2">
                       <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                         {c.authorPhotoUrl ? (
                           <img src={c.authorPhotoUrl} alt="User" loading="lazy" className="w-full h-full object-cover" />
                         ) : (
                           <GraduationCap className="w-3 h-3" />
                         )}
                       </div>
                       <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-3 py-2 shadow-sm relative group">
                         <div className="flex justify-between items-start mb-1">
                           <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.authorName}</span>
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] text-slate-400">
                               {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString('pt-BR') : 'Agora'}
                             </span>
                             {(isAdmin || c.authorId === myUserId) && (
                               <>
                                 <button 
                                   onClick={() => {
                                     setEditingCommentId(c.id);
                                     setEditCommentText(c.text);
                                   }}
                                   className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-all"
                                   title="Editar comentário"
                                   disabled={isDeletingComment}
                                 >
                                   <Pencil className="w-3 h-3" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteComment(c.id)}
                                   className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-all"
                                   title="Apagar comentário"
                                   disabled={isDeletingComment}
                                 >
                                   <Trash2 className="w-3 h-3" />
                                 </button>
                               </>
                             )}
                           </div>
                         </div>
                         
                         {editingCommentId === c.id ? (
                           <div className="mt-2 space-y-2">
                             <textarea 
                               value={editCommentText}
                               onChange={(e) => setEditCommentText(e.target.value)}
                               className="w-full bg-slate-50 dark:bg-slate-900 text-sm border border-slate-300 dark:border-slate-600 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none min-h-[60px]"
                             />
                             <div className="flex justify-end gap-2">
                               <button 
                                 onClick={() => setEditingCommentId(null)}
                                 className="text-xs px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                               >
                                 Cancelar
                               </button>
                               <button 
                                 onClick={() => handleSaveEditComment(c.id)}
                                 disabled={!editCommentText.trim() || isSavingEditComment}
                                 className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                               >
                                 Salvar
                               </button>
                             </div>
                           </div>
                         ) : (
                           <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{c.text}</p>
                         )}
                       </div>
                     </div>
                   ))
                 )}
               </div>
               {currentUserData ? (
                 <div className="flex gap-2 relative">
                   <input
                     type="text"
                     value={newComment}
                     onChange={(e) => setNewComment(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                         e.preventDefault();
                         handleAddComment();
                       }
                     }}
                     placeholder="Escreva um comentário..."
                     className="flex-1 bg-white dark:bg-slate-800 text-sm border border-slate-300 dark:border-slate-600 rounded-full pl-4 pr-10 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                     disabled={isSubmittingComment}
                   />
                   <button 
                     onClick={handleAddComment}
                     disabled={!newComment.trim() || isSubmittingComment}
                     className="absolute right-1 top-1 bottom-1 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                     <Send className="w-4 h-4 ml-0.5" />
                   </button>
                 </div>
               ) : (
                 <div className="text-center w-full px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-medium border border-indigo-100 dark:border-indigo-800/50 shadow-inner">
                   Você não está identificado. Volte no Início para vincular a sua identidade antes de comentar.
                 </div>
               )}
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </Reorder.Item>
  );
}
