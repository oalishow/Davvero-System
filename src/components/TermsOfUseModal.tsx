import { createPortal } from 'react-dom';
import { X, FileText, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';

interface TermsOfUseModalProps {
  onClose?: () => void;
  onAccept?: () => void;
  mustAccept?: boolean;
}

export default function TermsOfUseModal({ onClose, onAccept, mustAccept }: TermsOfUseModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col my-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-3xl sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Termos de Uso e Privacidade</h2>
          </div>
          {!mustAccept && onClose && (
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-sm text-slate-600 dark:text-slate-300">
          
          <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex gap-3 pb-5">
            <ShieldAlert className="w-6 h-6 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
               <h3 className="font-bold text-sky-800 dark:text-sky-300 text-base mb-1">Aviso Importante sobre Responsabilidade</h3>
               <p className="text-sm text-sky-700 dark:text-sky-400/90 leading-relaxed">
                 O <strong>DAVVERO System</strong> (e seus desenvolvedores) não detém controle ou responsabilidade direta sobre os dados aqui inseridos. A gestão dos dados é de inteira responsabilidade da <strong>Faculdade João Paulo II (FAJOPA)</strong>, dos Seminários a ela vinculados, e dos próprios usuários (titulares dos dados).
               </p>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              1. Natureza da Aplicação
            </h3>
            <p>
              O aplicativo é fornecido de forma inteiramente <strong>gratuita</strong> e é resultado de uma parceria sem fins lucrativos entre os desenvolvedores, a FAJOPA e os Seminários vinculados ao sistema, servindo também como Trabalho de Conclusão de Curso (TCC).
            </p>
            <p>
              A infraestrutura visa digitalizar o processo de emissão de Identidades Estudantis (ID) e gestão acadêmica, pastoral e de eventos.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               2. Tratamento e Proteção de Dados (LGPD)
            </h3>
            <p>
              Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>, seus dados (nome, CPF, foto, curso, seminário e outros) são coletados exclusivamente para a validação e funcionamento institucional.
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-slate-400 dark:marker:text-slate-600">
              <li><strong>Armazenamento:</strong> Os dados são mantidos em instâncias isoladas cedidas como serviço (Cloud Database).</li>
              <li><strong>Compartilhamento:</strong> Seus dados não são vendidos ou cedidos a terceiros. Apenas os administradores aprovados pela FAJOPA terão acesso administrativo ao banco de dados estudantil.</li>
              <li><strong>Direito ao Esquecimento:</strong> Você pode, a qualquer momento, solicitar a exclusão da sua conta através da "Zona de Perigo" em seu perfil. Seu pedido será analisado pela administração da FAJOPA para aprovação final.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               3. Isenção de Garantias
            </h3>
            <p>
              Sendo um projeto acadêmico e sem custos, a plataforma é entregue "no estado em que se encontra", sem garantias explícitas de uptime ininterrupto (podendo passar por períodos de manutenção) e sem responsabilização dos desenvolvedores por eventuais perdas cibernéticas em decorrência de ataques ou falhas em serviços de nuvem de terceiros.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               4. Concordância do Usuário
            </h3>
            <p>
              Ao utilizar a plataforma, submeter o formulário de cadastro ou interagir com painéis de eventos e cursos da FAJOPA, você <strong>afirma conhecer, consentir e concordar</strong> com as disposições aqui listadas e estar ciente dos termos da Lei Geral de Proteção de Dados para fins administrativos de ensino.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 rounded-b-3xl">
          <button
            onClick={() => {
              if (onAccept) onAccept();
              if (onClose && !mustAccept) onClose();
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
          >
            Li e Concordo{mustAccept && " com os Termos"}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
