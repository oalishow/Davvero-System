import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, appId, createNotification } from '../lib/firebase';
import { logAdminAction } from '../lib/audit';
import { sendEmailNotification, generateEmailTemplate, getCompiledEmail } from '../lib/emailService';
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
  const [rejectReason, setRejectReason] = useState<string>('Foto fora do padrão exigido (sem nitidez, corte inadequado ou fundo não neutro).');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, `artifacts/${appId}/public/data/students`));
      const snapshot = await getDocs(q);
      const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Member);
      
      // Filtrar Não-Aprovados E também aqueles que têm Sugestões de Correção Pendentes ou Pedidos de Exclusão.
      const pendingReqs = members.filter(
        (m) =>
          !m.deletedAt &&
          (m.isApproved !== true ||
            m.status === "PENDING" ||
            m.hasPendingAction === true ||
            Boolean(m.pendingChanges) ||
            m.deletionRequested === true)
      );
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

  const dispatchEmail = async (toEmail: string, subject: string, htmlBody: string) => {
    if (!toEmail || !toEmail.includes('@') || settings.emailNotificationsEnabled === false) return;
    try {
      await sendEmailNotification({
        to: toEmail,
        subject,
        html: htmlBody,
      }, settings.smtpConfig);
    } catch(e) {
      console.warn("Falha ao registrar envio de e-mail:", e);
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
        status: "VALID",
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

      // Email Notification para o Aluno
      if (settings.notifyStudentOnApproved !== false && member.email) {
        const compiled = getCompiledEmail({
          templateKey: 'approvedStudent',
          customTemplates: settings.emailTemplates,
          vars: {
            name: member.name || 'Estudante',
            roles: member.roles?.join(', ') || 'Estudante',
            course: member.course || 'Não especificado',
            diocese: member.diocese || '',
            seminary: member.seminary || '',
            email: member.email,
            ra: member.ra || '',
            alphaCode: alphaCode
          },
          settings,
          buttonUrl: `${window.location.origin}/?id=${alphaCode}`
        });

        await dispatchEmail(member.email, compiled.subject, compiled.fullHtml);
      }
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
        const targetEmail = updatePayload.email || member.email;
        const emailHtml = generateEmailTemplate({
          title: "Atualização Aprovada! 📝",
          preheader: "As alterações dos dados da sua carteirinha foram validadas.",
          institutionName: settings.instName || "DAVVERO System",
          institutionColor: settings.instColor || "#0ea5e9",
          contentHtml: `
            <p>Olá, <strong>${updatePayload.name || member.name}</strong>!</p>
            <p>As edições e sugestões de dados que você solicitou em sua carteirinha foram validadas e atualizadas no sistema com sucesso.</p>
            <p>Abra o portal do aluno para consultar sua carteirinha atualizada.</p>
          `,
          buttonText: "Acessar Carteirinha",
          buttonUrl: `${window.location.origin}/?id=${member.alphaCode || member.ra || member.cpf}`
        });

        await dispatchEmail(targetEmail, `Atualização de Carteirinha Concluída - ${settings.instName || "DAVVERO"}`, emailHtml);
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
    const effectiveReason = rejectReason === 'OUTRO' 
      ? (customRejectReason.trim() || 'Dados em desacordo com as diretrizes acadêmicas.')
      : rejectReason;

    try {
      const mRef = doc(db, `artifacts/${appId}/public/data/students`, id);
      if (isEdit) {
        await updateDoc(mRef, { pendingChanges: null, hasPendingAction: false });
        await logAdminAction("MEMBER_EDIT_REJECTED", `Recusou as sugestões de edição de dados. Motivo: ${effectiveReason}`, id);
        if (emailToNotify && settings.notifyStudentOnRejected !== false) {
          const emailHtml = generateEmailTemplate({
            title: "Aviso sobre Alteração de Cadastro",
            preheader: "A solicitação de alteração de dados não foi homologada.",
            headerName: settings.emailHeaderName || "DAVVERO System",
            institutionName: settings.instName || "DAVVERO System",
            institutionColor: settings.instColor || "#0ea5e9",
            logoMode: settings.emailLogoMode,
            customLogoUrl: settings.emailCustomLogoUrl,
            institutionLogo: settings.instLogo || undefined,
            contentHtml: `
              <p>Olá, <strong>${memberObj?.name || 'Estudante'}</strong>.</p>
              <p>A sua solicitação de alteração de dados cadastrais no <strong>${settings.instName || "DAVVERO"}</strong> não foi homologada pela secretaria.</p>
              <div class="highlight-card" style="border-left-color: #ef4444; background: #fef2f2;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #dc2626; font-weight: 700; text-transform: uppercase;">Motivo / Observação:</p>
                <p style="margin: 0; font-size: 14px; color: #991b1b;">${effectiveReason}</p>
              </div>
              <p>Caso necessite de correções em seus dados, realize uma nova solicitação ou procure a secretaria.</p>
            `,
            buttonText: "Acessar Sistema",
            buttonUrl: `${window.location.origin}/?id=${memberObj?.alphaCode || memberObj?.ra || ''}`
          });
          await dispatchEmail(emailToNotify, `Aviso sobre Alteração de Cadastro - ${settings.emailHeaderName || settings.instName || "DAVVERO"}`, emailHtml);
        }
      } else {
        await deleteDoc(mRef);
        await logAdminAction("MEMBER_REJECTED", `Recusou a solicitação de carteirinha. Motivo: ${effectiveReason}`, id);
        if (emailToNotify && settings.notifyStudentOnRejected !== false) {
          const compiled = getCompiledEmail({
            templateKey: 'rejectedStudent',
            customTemplates: settings.emailTemplates,
            vars: {
              name: memberObj?.name || 'Estudante',
              roles: memberObj?.roles?.join(', ') || 'Estudante',
              course: memberObj?.course || 'Não especificado',
              diocese: memberObj?.diocese || '',
              seminary: memberObj?.seminary || '',
              email: memberObj?.email || '',
              ra: memberObj?.ra || '',
              alphaCode: memberObj?.alphaCode || '',
              reason: effectiveReason
            },
            settings,
            buttonUrl: `${window.location.origin}/`
          });
          await dispatchEmail(emailToNotify, compiled.subject, compiled.fullHtml);
        }
      }
      setModalRejectOpen(false);
      setSelectedReject(null);
      setCustomRejectReason('');
      fetchRequests();
    } catch(e) {
      console.error(e);
      setErrorMessage('Falha ao rejeitar.');
    }
  };

  const handleReject = (id: string, isEdit: boolean) => {
    setSelectedReject({ id, isEdit });
    setRejectReason('Foto fora do padrão exigido (sem nitidez, corte inadequado ou fundo não neutro).');
    setCustomRejectReason('');
    setModalRejectOpen(true);
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
      <Modal 
        isOpen={modalRejectOpen} 
        onClose={() => setModalRejectOpen(false)} 
        title={selectedReject?.isEdit ? "Rejeitar Alterações de Perfil" : "Recusar Solicitação de Carteirinha"}
        confirmLabel="Confirmar e Notificar"
        confirmVariant="danger"
        onConfirm={confirmReject}
      >
        <div className="space-y-3 text-left">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {selectedReject?.isEdit 
              ? "Deseja recusar as sugestões de edição enviadas pelo aluno? Os dados originais permanecerão intactos." 
              : "Deseja recusar esta solicitação? O solicitante receberá um e-mail com a justificativa e os dados serão excluídos da lista pendente."}
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Motivo da Recusa (enviado ao aluno por e-mail):
            </label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-modern w-full text-xs py-2 px-3 rounded-lg mb-2"
            >
              <option value="Foto fora do padrão exigido (sem nitidez, corte inadequado ou fundo não neutro).">
                📷 Foto fora do padrão (sem nitidez, corte inadequado ou selfie casual)
              </option>
              <option value="Dados cadastrais divergentes dos registros acadêmicos oficiais.">
                📋 Dados cadastrais divergentes dos registros acadêmicos oficiais
              </option>
              <option value="Registro de Matrícula (RA) ou CPF não localizado na base discente.">
                🔍 RA ou CPF não localizado na base discente
              </option>
              <option value="Solicitação duplicada para o mesmo período letivo.">
                📑 Solicitação duplicada
              </option>
              <option value="OUTRO">
                ✍️ Outro motivo (escrever justificativa personalizada)
              </option>
            </select>

            {rejectReason === 'OUTRO' && (
              <textarea
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder="Descreva detalhadamente o motivo da recusa para orientar o estudante..."
                rows={3}
                className="input-modern w-full text-xs p-2.5 rounded-lg"
              />
            )}
          </div>
        </div>
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
              const isDeletion = req.deletionRequested === true;
              const isEdit = Boolean(req.pendingChanges);
              const isNew = !isDeletion && !isEdit;
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
                                  dispatchEmail(req.email, "Exclusão de Conta - FAJOPA", `
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
              } else if (isEdit) {
                const pc = req.pendingChanges!;
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
              } else {
                const isQuick = !req.photoUrl || !req.course || !req.diocese;
                return (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-sky-200 dark:border-sky-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded ${isQuick ? "bg-amber-500" : "bg-sky-500"}`}>
                          {isQuick ? "Cadastro Rápido (Evento)" : "Novo Registo"}
                        </span>
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
                            {isQuick && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                                ⚠️ Registrado via evento. Carteirinha aguarda cadastro completo de dados/foto.
                              </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleApproveNew(req)} className="flex-1 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-semibold border border-emerald-300 transition-colors">Aprovar Identidade</button>
                        <button onClick={() => handleReject(req.id, false)} className="flex-1 py-2 bg-rose-100 text-rose-700 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold border border-rose-300 transition-colors">Recusar</button>
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

