import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, ShieldAlert, Download, QrCode, Image as ImageIcon, Printer } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, appId, createNotification } from '../lib/firebase';
import { logAdminAction } from '../lib/audit';
import FajopaIDCard from './FajopaIDCard';
import { useSettings } from '../context/SettingsContext';
import { type Member, AVAILABLE_SEMINARIES } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { URL_STORAGE_KEY, DEFAULT_PUBLIC_URL, CUSTOM_ROLES_KEY, CUSTOM_COURSES_KEY } from '../lib/constants';
import ImageCropperModal from './ImageCropperModal';
import Modal from './Modal';

interface MemberEditModalProps {
  member: Member;
  onClose: () => void;
  onUpdate: () => void;
}

export default function MemberEditModal({ member, onClose, onUpdate }: MemberEditModalProps) {
  const { settings, updateSettings } = useSettings();
  const [name, setName] = useState(member.name || '');
  const [ra, setRa] = useState(member.ra || '');
  const [cpf, setCpf] = useState(member.cpf || '');
  const [birthdate, setBirthdate] = useState(() => {
    let bd = member.birthdate || '';
    if (bd.includes('/')) {
      const parts = bd.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return bd;
  });
  const [email, setEmail] = useState(member.email || '');
  const [validity, setValidity] = useState(member.validityDate || '');
  const [legacyQrCode, setLegacyQrCode] = useState(member.legacyQrCode || '');
  const [isActive, setIsActive] = useState(member.isActive !== false);
  const [course, setCourse] = useState(member.course || '');
  const [diocese, setDiocese] = useState(member.diocese || '');
  const [seminary, setSeminary] = useState(member.seminary || '');
  const [roles, setRoles] = useState<string[]>(member.roles || []);
  const [newRole, setNewRole] = useState('');
  
  const [newCourse, setNewCourse] = useState('');
  
  const [newDiocese, setNewDiocese] = useState('');

  const baseCourses = ["FILOSOFIA", "FILOSOFIA EAD", "TEOLOGIA", "TEOLOGIA EAD"];
  const availableCourses = [...baseCourses, ...settings.customCourses];

  const baseRoles = ["ALUNO(A)", "PROFESSOR(A)", "COLABORADOR(A)", "SEMINARISTA", "PADRE", "DIÁCONO", "BISPO", "DIRETOR", "VICE-DIRETOR", "RELIGIOSO(A)", "COORDENADOR(A)", "REITOR", "VICE-REITOR", "PSICÓLOGO(A)", "DIRETOR ESPIRITUAL"];
  const availableRoles = [...baseRoles, ...settings.customRoles];

  const baseDioceses = ["MARÍLIA", "ASSIS", "LINS", "BAURU", "OURINHOS", "PRESIDENTE PRUDENTE", "ARAÇATUBA", "BOTUCATU"];
  const availableDioceses = [...baseDioceses, ...settings.customDioceses];

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  
  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleAddRole = async () => {
    if (newRole.trim() && !availableRoles.includes(newRole.trim().toUpperCase())) {
      const formatted = newRole.trim().toUpperCase();
      await updateSettings({ customRoles: [...settings.customRoles, formatted] });
      setRoles(prev => [...prev, formatted]);
      setNewRole('');
    }
  };

  const handleAddCourse = async () => {
    if (newCourse.trim() && !availableCourses.includes(newCourse.trim().toUpperCase())) {
      const formatted = newCourse.trim().toUpperCase();
      await updateSettings({ customCourses: [...settings.customCourses, formatted] });
      setCourse(formatted);
      setNewCourse('');
    }
  };

  const handleAddDiocese = async () => {
    if (newDiocese.trim() && !availableDioceses.includes(newDiocese.trim().toUpperCase())) {
      const formatted = newDiocese.trim().toUpperCase();
      await updateSettings({ customDioceses: [...settings.customDioceses, formatted] });
      setDiocese(formatted);
      setNewDiocese('');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropImageSrc(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const handleUpdate = async () => {
    if (!name || !validity || !course || !diocese || !seminary) {
      setError('Nome, Validade, Curso, Diocese e Seminário são obrigatórios.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    let photoUrl = photoBase64 || member.photoUrl;

    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
      await updateDoc(docRef, {
        name, ra, cpf, birthdate, email, validityDate: validity, isActive, course, diocese, seminary, roles,
        legacyQrCode,
        photoUrl: photoUrl || null
      });

      // Notificar o membro sobre a alteração
      await createNotification({
        recipientId: member.id,
        title: "Perfil Atualizado",
        message: "Sua ficha cadastral foi atualizada pela administração.",
        type: "edicao"
      }).catch(console.error);

      await logAdminAction("MEMBER_UPDATED", `Atualizou os dados de ${name} (RA: ${ra})`, member.id);

      onUpdate();
    } catch (err) {
      console.error(err);
      setError('Falha ao gravar alterações.');
      setLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/students`, member.id);
      await updateDoc(docRef, { deletedAt: new Date().toISOString() });
      await logAdminAction("MEMBER_DELETED", `Moveu ${member.name} (RA: ${member.ra}) para a lixeira`, member.id);
      onUpdate();
    } catch (err) {
      console.error(err);
      setError('Falha ao remover.');
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_${name.replace(/\\s+/g, '_')}.png`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const verificationUrl = `${localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_PUBLIC_URL}?verify=${member.alphaCode}`;

  useEffect(() => {
    // Evita o scroll de fundo quando o modal está aberto
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto print:static print:bg-white print:p-0">
      <Modal 
        isOpen={modalDeleteOpen} 
        onClose={() => setModalDeleteOpen(false)} 
        title="Mover para Lixeira"
        confirmLabel="Sim, Mover"
        confirmVariant="danger"
        onConfirm={handleSoftDelete}
      >
        Tem certeza que deseja mover <strong>{member.name}</strong> para a lixeira? O registo ficará oculto da lista principal mas poderá ser restaurado em até 30 dias.
      </Modal>

      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={(croppedBase64) => {
            setPhotoBase64(croppedBase64);
            setCropImageSrc(null);
          }}
        />
      )}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-4 sm:p-6 w-full max-w-4xl my-auto max-h-[95vh] overflow-y-auto custom-scrollbar animated-scale-in print:hidden">
        
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60 sticky top-0 bg-white/5 dark:bg-slate-800/5 backdrop-blur-sm z-20">
          <h2 className="text-xl font-bold text-sky-600 dark:text-sky-400">Ficha do Membro</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors no-print">
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {error && <div className="mb-4 bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-medium">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/30 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nome Completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-modern w-full rounded-lg py-2 px-3 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">RA</label>
                  <input type="text" value={ra} onChange={e => setRa(e.target.value)} className="input-modern w-full rounded-lg py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                  <select value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')} className="input-modern w-full rounded-lg py-2 px-3 text-sm">
                    <option value="true">Ativo</option>
                    <option value="false">Suspenso</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">CPF</label>
                  <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className="input-modern w-full rounded-lg py-2 px-3 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Nascimento</label>
                  <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} className="input-modern w-full rounded-lg py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Data Validade</label>
                  <input type="date" value={validity} onChange={e => setValidity(e.target.value)} className="input-modern w-full rounded-lg py-2 px-3 text-sm" />
                </div>
              </div>
              <div>
                 <label className="text-xs font-medium text-slate-500 mb-1 block">
                   Vínculo QR Antigo <span className="font-normal opacity-60">(Opcional) - Restaura impressões velhas</span>
                 </label>
                 <input 
                   type="text" 
                   value={legacyQrCode} 
                   onChange={e => setLegacyQrCode(e.target.value)} 
                   placeholder="Ex: https://carteirinhafajopa.netlify.app/?verify=..." 
                   className="input-modern w-full rounded-lg py-2 px-3 text-sm" 
                 />
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Curso Académico *</label>
                <div className="flex gap-2">
                  <select value={course} onChange={e => setCourse(e.target.value)} className="input-modern flex-1 rounded-lg py-1.5 px-3 text-sm">
                    <option value="">Selecione o Curso</option>
                    {availableCourses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input 
                    type="text" 
                    value={newCourse} 
                    onChange={e => setNewCourse(e.target.value)} 
                    placeholder="Novo" 
                    className="input-modern w-24 rounded-lg py-1.5 px-3 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCourse())}
                  />
                  <button 
                    onClick={handleAddCourse}
                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Diocese de Origem *</label>
                <div className="flex gap-2">
                  <select value={diocese} onChange={e => setDiocese(e.target.value)} className="input-modern flex-1 rounded-lg py-1.5 px-3 text-sm">
                    <option value="">Selecione a Diocese</option>
                    {availableDioceses.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <input 
                    type="text" 
                    value={newDiocese} 
                    onChange={e => setNewDiocese(e.target.value)} 
                    placeholder="Nova" 
                    className="input-modern w-24 rounded-lg py-1.5 px-3 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDiocese())}
                  />
                  <button 
                    onClick={handleAddDiocese}
                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Seminário *</label>
                <div className="flex gap-2">
                  <select value={seminary} onChange={e => setSeminary(e.target.value)} className="input-modern flex-1 rounded-lg py-1.5 px-3 text-sm">
                    <option value="">Selecione um Seminário</option>
                    {AVAILABLE_SEMINARIES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Código Identificação (Clique para Abrir a Carteirinha)</label>
                <div 
                  onClick={() => {
                     (window as any).triggerAdminForceView?.(member.alphaCode);
                     onClose();
                  }}
                  className="input-modern w-full rounded-lg py-2 px-3 text-sm font-mono tracking-widest bg-slate-100 dark:bg-slate-900/50 opacity-100 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-300 transition-all flex items-center justify-between"
                >
                  <span>{member.alphaCode || ''}</span>
                  <ShieldAlert className="w-4 h-4 text-sky-500 opacity-50" />
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <label className="text-xs font-medium text-slate-500 mb-2 block">Vínculos</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableRoles.map(role => (
                    <button key={role} onClick={() => toggleRole(role)} className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${roles.includes(role) ? 'bg-sky-100 text-sky-700 border-sky-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                      {role}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value)} 
                    placeholder="Nova Tag" 
                    className="input-modern flex-1 rounded-lg py-1.5 px-3 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRole())}
                  />
                  <button 
                    onClick={handleAddRole}
                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row items-center gap-4">
                 <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-300 dark:border-slate-600 flex-shrink-0 relative">
                   <img src={photoBase64 || member.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=e2e8f0&color=475569`} alt="User" className="w-full h-full object-cover" />
                 </div>
                 <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors text-xs font-semibold dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                   <ImageIcon className="w-4 h-4"/>
                   {photoBase64 ? 'Alterar Fotografia' : 'Substituir/Recortar Foto'}
                   <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                 </label>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 bg-slate-50 dark:bg-slate-900/30 p-6 rounded-xl border border-slate-200 dark:border-slate-700/30 flex flex-col items-center justify-center">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">QR Code de Validação</h3>
            <p className="text-[9px] text-slate-400 mb-4 uppercase font-bold">Clique no QR para testar verificação</p>
            
            <div 
              ref={qrRef} 
              onClick={() => (window as any).triggerVerification?.(member.alphaCode)}
              className="bg-white p-3 rounded-xl shadow-lg mb-4 cursor-pointer hover:scale-105 transition-transform active:scale-95 group relative"
            >
               <QRCodeCanvas value={verificationUrl} size={160} level="M" />
               <div className="absolute inset-0 flex items-center justify-center bg-sky-600/0 group-hover:bg-sky-600/5 transition-colors rounded-xl">
                  <ShieldAlert className="w-8 h-8 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity" />
               </div>
            </div>

            <button onClick={downloadQR} className="btn-modern flex items-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-sm w-full justify-center mb-2 no-print">
              <Download className="w-4 h-4" /> Exportar QR Code
            </button>
            <button onClick={handlePrint} className="btn-modern flex items-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl shadow-sm w-full justify-center no-print">
              <Printer className="w-4 h-4" /> Imprimir Ficha
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/60 gap-4 no-print">
          <button onClick={() => setModalDeleteOpen(true)} disabled={loading} className="btn-modern flex items-center gap-2 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto justify-center">
             <Trash2 className="w-4 h-4" /> Mover para Lixeira
          </button>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} disabled={loading} className="btn-modern flex-1 sm:flex-none px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium">Voltar</button>
            <button onClick={handleUpdate} disabled={loading} className="btn-modern flex-1 sm:flex-none px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {loading ? 'A processar...' : 'Guardar'}
            </button>
          </div>
        </div>

      </div>

      <div className="hidden print:block absolute inset-0 bg-white z-[300] p-8 text-black">
         <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold uppercase tracking-widest border-b-2 border-black pb-4 mb-8">Ficha Cadastral Individual - DAVVERO System</h1>
            
            <div className="flex gap-8 mb-8">
               <div className="w-32 h-40 border-2 border-black rounded-lg overflow-hidden shrink-0">
                  <img src={photoBase64 || member.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=e2e8f0&color=475569`} alt="" className="w-full h-full object-cover" crossOrigin="anonymous"/>
               </div>
               
               <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div className="col-span-2">
                     <p className="font-bold text-xs text-gray-500 uppercase">Nome Completo</p>
                     <p className="text-lg font-bold border-b border-gray-300 pb-1">{name || '---'}</p>
                  </div>
                  <div>
                     <p className="font-bold text-xs text-gray-500 uppercase">Status</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{isActive ? 'Ativo' : 'Suspenso'}</p>
                  </div>
                  <div>
                     <p className="font-bold text-xs text-gray-500 uppercase">RA / Matrícula</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{ra || '---'}</p>
                  </div>
                  <div>
                     <p className="font-bold text-xs text-gray-500 uppercase">CPF</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{cpf || '---'}</p>
                  </div>
                  <div>
                     <p className="font-bold text-xs text-gray-500 uppercase">Data de Nascimento</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{birthdate ? new Date(birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</p>
                  </div>
                  <div>
                     <p className="font-bold text-xs text-gray-500 uppercase">Validade</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{validity ? new Date(validity + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</p>
                  </div>
                  <div className="col-span-2">
                     <p className="font-bold text-xs text-gray-500 uppercase">Vínculos Institucionais</p>
                     <p className="text-base font-bold border-b border-gray-300 pb-1">{roles.join(', ') || 'Nenhum'}</p>
                  </div>
                  {course && (
                    <div className="col-span-2">
                       <p className="font-bold text-xs text-gray-500 uppercase">Curso</p>
                       <p className="text-base font-bold border-b border-gray-300 pb-1">{course}</p>
                    </div>
                  )}
                  {diocese && (
                    <div className="col-span-2">
                       <p className="font-bold text-xs text-gray-500 uppercase">Diocese</p>
                       <p className="text-base font-bold border-b border-gray-300 pb-1">{diocese}</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="bg-gray-100 p-4 flex gap-6 items-center rounded-lg border border-gray-300">
               <div>
                  <QRCodeCanvas value={verificationUrl} size={100} level="M" />
               </div>
               <div className="flex-1">
                  <p className="font-bold text-xs text-gray-500 uppercase mb-1">Código de Autenticação (Alpha-Code)</p>
                  <p className="text-xl font-mono font-black tracking-widest">{member.alphaCode}</p>
                  <p className="text-xs text-gray-500 mt-2">Este código é utilizado para verificação da autenticidade da carteirinha no sistema e também como código de uso no portal do aluno.</p>
               </div>
            </div>

            <div className="mt-20 pt-8 border-t-2 border-dashed border-gray-400 text-center flex justify-around">
               <div className="w-64">
                  <div className="border-t border-black pt-2 font-bold text-sm">Assinatura do Responsável</div>
               </div>
               <div className="w-64">
                  <div className="border-t border-black pt-2 font-bold text-sm">Assinatura do Membro</div>
               </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-12">
               Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} pelo sistema DAVVERO System.
            </p>
         </div>
      </div>

    </div>,
    document.body
  );
}

