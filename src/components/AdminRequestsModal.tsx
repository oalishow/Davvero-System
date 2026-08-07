import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, appId, createNotification } from '../lib/firebase';
import { logAdminAction } from '../lib/audit';
import type { Member } from '../types';
import Modal from './Modal';
import { useSettings } from '../context/SettingsContext';

export default function AdminRequestsModal({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings, updateSettings } = useSettings();

  // Modal State
  const [modalRejectOpen, setModalRejectOpen] = useState(false);
  const [selectedReject, setSelectedReject] = useState<{id: string, isEdit: boolean} | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, `artifacts/${appId}/public/data/students`));
      const snapshot = await getDocs(q);
      const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      
      // Filtrar Não-Aprovados E também aqueles que têm Sugestões de Correção Pendentes ou Pedidos de Exclusão.
      const pendingReqs = members.filter(m => !m.deletedAt && (m.isApproved === false || m.pendingChanges || m.deletionRequested === true));
      setRequests(pendingReqs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const sendEmailNotification = async (toEmail: string, subject: string, htmlHtml: string) => {
    if (!toEmail) return;
    try {
      await addDoc(collection(db, 'mail'), {
        to: toEmail,
        message: {
          subject: subject,
          html: htmlHtml
        }
      });
    } catch(e) {
      console.error("Falha ao registrar envio de e-mail:", e);
    }
  };

  const handleApproveNew = async (member: Member) => {
    try {
      // Append non-existing custom items
      if (member.roles && member.roles.length > 0) {
        const newRoles = member.roles.filter(r => !settings.customRoles.includes(r));
        if (newRoles.length > 0) {
          await updateSettings({ customRoles: [...settings.customRoles, ...newRoles] });
        }
      }
      if (member.diocese && !settings.customDioceses.includes(member.diocese)) {
        await updateSettings({ customDioceses: [...settings.customDioceses, member.diocese] });
      }

      // Reusa o código AlphaCode existente ou cria um novo nativo AlphaCode
      const alphaCode = member.alphaCode || Array(6).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
      await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, member.id), {
        isApproved: true,
        isActive: true,
        alphaCode,
        hasPendingAction: false,
        validityDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] // Vence em 1 ano por segurança
      });
      fetchRequests();

      // App Notification
      await createNotification({
        recipientId: member.id,
        title: "Carteirinha Aprovada",
        message: "Sua solicitação de identidade estudantil foi aprovada!",
        type: "carteirinha"
      });

      await logAdminAction("MEMBER_APPROVED", `Aprovou a solicitação de carteirinha`, member.id);

      // Email Notification
      await sendEmailNotification(member.email || '', "Sua Carteirinha de Estudante Foi Aprovada!", `<h3>Parabéns!</h3><p>Sua solicitação para a identidade estudantil DAVVERO System foi <b>Aprovada</b>.</p><p>O seu código de uso no aplicativo é: <b>${alphaCode}</b></p><p>Acesse o portal e valide a sua identidade.</p>`);
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao aprovar membro.');
    }
  };

  const handleApproveEdit = async (member: Member) => {
    try {
      const pc = member.pendingChanges;
      const updatePayload: any = { pendingChanges: null, hasPendingAction: false };
      
      // Append non-existing custom items
      if (pc.roles && pc.roles.length > 0) {
        const newRoles = pc.roles.filter((r: string) => !settings.customRoles.includes(r));
        if (newRoles.length > 0) {
          await updateSettings({ customRoles: [...settings.customRoles, ...newRoles] });
        }
      }
      if (pc.diocese && !settings.customDioceses.includes(pc.diocese)) {
        await updateSettings({ customDioceses: [...settings.customDioceses, pc.diocese] });
      }

      if (pc.name) updatePayload.name = pc.name;
      if (pc.ra) updatePayload.ra = pc.ra;
      if (pc.roles) updatePayload.roles = pc.roles;
      if (pc.course) updatePayload.course = pc.course;
      if (pc.diocese) updatePayload.diocese = pc.diocese;
      if (pc.seminary !== undefined) updatePayload.seminary = pc.seminary;
      if (pc.cpf !== undefined) updatePayload.cpf = pc.cpf;
      if (pc.birthdate !== undefined) updatePayload.birthdate = pc.birthdate;
      if (pc.email !== undefined) updatePayload.email = pc.email;
      if (pc.photoUrl) updatePayload.photoUrl = pc.photoUrl;

      await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, member.id), updatePayload);
      fetchRequests();

      // App Notification
      await createNotification({
        recipientId: member.id,
        title: "Edição Aprovada",
        message: "As edições da sua carteirinha foram aprovadas.",
        type: "edicao"
      });

      await logAdminAction("MEMBER_EDIT_APPROVED", `Aprovou as sugestões de edição de dados`, member.id);

      // Email Notification
      if (member.email || updatePayload.email) {
          await sendEmailNotification(updatePayload.email || member.email, "Edição Concluída", `<h3>Atualização Aprovada!</h3><p>As edições que você sugeriu na sua carteirinha de estudante foram validadas e atualizadas no sistema com sucesso.</p><p>Atualize a página na sua Minha ID para ver as mudanças.</p>`);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Erro ao aplicar pacote de atualizações.');
    }
  };

  const confirmReject = async () => {
    if (!selectedReject) return;
    const { id, isEdit } = selectedReject;
    
    // Check if we can find the email before we delete it
    const memberObj = requests.find(r => r.id === id);
    const emailToNotify = memberObj?.email;

    try {
      const mRef = doc(db, `artifacts/${appId}/public/data/students`, id);
      if (isEdit) {
        await updateDoc(mRef, { pendingChanges: null, hasPendingAction: false });
        await logAdminAction("MEMBER_EDIT_REJECTED", `Recusou as sugestões de edição de dados`, id);
        if (emailToNotify) await sendEmailNotification(emailToNotify, "Atualização Recusada", `<p>A sua sugestão de edição de dados não foi aceita pela instituição após a devida comprovação cadastral.</p>`);
      } else {
        await deleteDoc(mRef);
        await logAdminAction("MEMBER_REJECTED", `Recusou a solicitação de carteirinha`, id);
        if (emailToNotify) await sendEmailNotification(emailToNotify, "Cadastro Não Aprovado", `<p>A sua solicitação de identidade estudantil não pôde ser aprovada neste momento.</p><p>Fale diretamente com os responsáveis do seu seminário/dioceses se achar que existe algum erro.</p>`);
      }
      setModalRejectOpen(false);
      setSelectedReject(null);
      fetchRequests();
    } catch(e) {
      console.error(e);
      setErrorMessage('Falha ao rejeitar.');
    }
  };

  const handleReject = (id: string, isEdit: boolean) => {
    setSelectedReject({ id, isEdit });
    setModalRejectOpen(true);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <Modal 
        isOpen={modalRejectOpen} 
        onClose={() => setModalRejectOpen(false)} 
        title={selectedReject?.isEdit ? "Rejeitar Alterações" : "Recusar Cadastro"}
        confirmLabel="Confirmar Rejeição"
        confirmVariant="danger"
        onConfirm={confirmReject}
      >
        {selectedReject?.isEdit 
          ? "Deseja ignorar as sugestões de edição enviadas pelo aluno? Os dados atuais permanecerão inalterados." 
          : "Deseja recusar este cadastro? Os dados enviados serão eliminados permanentemente da base de dados."}
      </Modal>

      <Modal 
        isOpen={!!errorMessage} 
        onClose={() => setErrorMessage(null)} 
        title="Aviso do Sistema"
      >
        {errorMessage}
      </Modal>

      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-6 w-full max-w-2xl animated-scale-in my-auto max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            Aprovações Pendentes
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
             <div className="flex justify-center p-6"><div className="w-6 h-6 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div></div>
          ) : requests.length === 0 ? (
            <p className="text-slate-500 italic text-center p-4 text-sm">Nenhuma solicitação pendente no momento.</p>
          ) : (
            requests.map(req => {
              const isNew = req.isApproved === false;
              const isDeletion = req.deletionRequested === true;
              const avatarSrc = req.photoUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>';
              
              if (isDeletion) {
                return (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-red-200 dark:border-red-500/30">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="bg-red-500 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded">Exclusão LGPD</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold ml-auto">{req.name}</span>
                      </div>
                      <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg text-xs space-y-2 border border-slate-200 dark:border-slate-700">
                          <p className="text-slate-600 dark:text-slate-400">O membro solicitou a exclusão de seus dados. Ao aceitar, o perfil será movido para a lixeira.</p>
                          {req.deletionRequestedAt && <p className="text-[10px] text-slate-500 font-medium">Solicitado em: {new Date(req.deletionRequestedAt).toLocaleString()}</p>}
                      </div>
                      <div className="flex gap-2 mt-3">
                          <button onClick={async () => {
                             try {
                               await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, req.id), {
                                 deletedAt: new Date().toISOString(),
                                 deletionRequested: false
                               });
                               setRequests(p => p.filter(x => x.id !== req.id));
                               // Try to send notification
                               if (req.email) {
                                  sendEmailNotification(req.email, "Exclusão de Conta - FAJOPA", `
                                    <p>Sua solicitação de exclusão de dados sob a LGPD foi aprovada.</p>
                                    <p>Todos os seus dados foram removidos dos sistemas de produção e constam apenas em backup frio por retenção legal (se aplicável).</p>
                                  `);
                               }
                             } catch(e) {
                               console.error(e);
                               setErrorMessage("Erro ao processar a exclusão.");
                             }
                          }} className="flex-1 py-1.5 bg-red-100 text-red-700 hover:bg-red-500 hover:text-white rounded-lg text-xs font-semibold border border-red-300 transition-colors">Aprovar Exclusão</button>
                          
                          <button onClick={async () => {
                             try {
                               await updateDoc(doc(db, `artifacts/${appId}/public/data/students`, req.id), {
                                 deletionRequested: false
                               });
                               setRequests(p => p.filter(x => x.id !== req.id));
                             } catch(e) {
                               console.error(e);
                             }
                          }} className="flex-1 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-semibold border border-slate-300 transition-colors">Cancelar Pedido</button>
                      </div>
                  </div>
                );
              } else if (isNew) {
                return (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-sky-200 dark:border-sky-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-sky-500 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded">Novo Registo</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <img src={avatarSrc} className="w-12 h-12 rounded-full border border-slate-300 dark:border-slate-600 object-cover bg-white dark:bg-slate-800" />
                        <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{req.name} {req.ra && <span className="text-xs font-normal text-slate-500 border border-slate-300 px-1 rounded ml-1">RA: {req.ra}</span>}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{req.roles?.join(', ')} • {req.course || 'S/ Curso'} • {req.diocese || 'S/ Diocese'}{req.seminary ? ` • ${req.seminary}` : ''}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                              {req.cpf && <p className="text-[10px] text-slate-500 font-medium">CPF: {req.cpf}</p>}
                              {req.birthdate && <p className="text-[10px] text-slate-500 font-medium">Nasc: {req.birthdate}</p>}
                              {req.diocese && <p className="text-[10px] text-amber-600 font-bold">Diocese: {req.diocese}</p>}
                              {req.seminary && <p className="text-[10px] text-amber-600 font-bold">Seminário: {req.seminary}</p>}
                            </div>
                            {req.email && <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1">{req.email}</p>}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleApproveNew(req)} className="flex-1 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-semibold border border-emerald-300 transition-colors">Aprovar Identidade</button>
                        <button onClick={() => handleReject(req.id, false)} className="flex-1 py-2 bg-rose-100 text-rose-700 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold border border-rose-300 transition-colors">Recusar</button>
                    </div>
                  </div>
                );
              } else {
                const pc = req.pendingChanges;
                return (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="bg-amber-500 text-slate-900 text-[9px] uppercase font-bold px-2 py-0.5 rounded">Sugestão de Edição</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold ml-auto">{req.name}</span>
                      </div>
                      <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg text-xs space-y-2 border border-slate-200 dark:border-slate-700">
                          {pc.name && <p><span className="text-slate-500">Novo Nome:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.name}</span></p>}
                          {pc.ra && <p><span className="text-slate-500">Novo RA:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.ra}</span></p>}
                          {pc.cpf && <p><span className="text-slate-500">Novo CPF:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.cpf}</span></p>}
                          {pc.birthdate && <p><span className="text-slate-500">Nova Data Nasc.:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.birthdate}</span></p>}
                          {pc.email && <p><span className="text-slate-500">Novo E-mail:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.email}</span></p>}
                          {pc.roles && <p><span className="text-slate-500">Novo Vínculo:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.roles.join(', ')}</span></p>}
                          {pc.course && <p><span className="text-slate-500">Novo Curso:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.course}</span></p>}
                          {pc.diocese && <p><span className="text-slate-500">Nova Diocese:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.diocese}</span></p>}
                          {pc.seminary !== undefined && <p><span className="text-slate-500">Novo Seminário:</span> <span className="text-amber-600 dark:text-amber-300 font-medium">{pc.seminary || 'Nenhum'}</span></p>}
                          {pc.photoUrl && <div className="flex items-center gap-2 mt-1"><span className="text-slate-500">Nova Foto:</span> <img src={pc.photoUrl} className="w-8 h-8 rounded border border-amber-300 object-cover" /></div>}
                      </div>
                      <div className="flex gap-2 mt-3">
                          <button onClick={() => handleApproveEdit(req)} className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-semibold border border-emerald-300 transition-colors">Aceitar Alterações</button>
                          <button onClick={() => handleReject(req.id, true)} className="flex-1 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold border border-rose-300 transition-colors">Ignorar</button>
                      </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

