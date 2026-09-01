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
               <h3 className="font-bold text-sky-800 dark:text-sky-300 text-base mb-1">Aviso Importante sobre Responsabilidade e Gestão</h3>
               <p className="text-sm text-sky-700 dark:text-sky-400/90 leading-relaxed">
                 O <strong>DAVVERO System</strong> é uma plataforma de gestão de identidades digitais, eventos e credenciamento acadêmico. A administração, gestão de conteúdos e responsabilidade pelas informações e eventos são da <strong>Faculdade João Paulo II (FAJOPA)</strong>, dos Seminários e Dioceses vinculados, e dos próprios usuários titulares dos dados.
               </p>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              1. Natureza da Aplicação e Serviços
            </h3>
            <p>
              A plataforma visa digitalizar e facilitar os processos de emissão de Identidades Estudantis (ID Digital), gestão acadêmica e pastoral, inscrições em eventos, controle de presenças por QR Code e homologação de certificados com autenticidade verificável.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               2. Tratamento e Proteção de Dados (LGPD)
            </h3>
            <p>
              Em conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</strong>, seus dados cadastrais (nome, CPF, e-mail, foto facial, curso, diocese, seminário e outros) são coletados e tratados estritamente para a finalidade legítima de identificação institucional, controle de acesso e emissão de certificados.
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-slate-400 dark:marker:text-slate-600">
              <li><strong>Armazenamento Seguro:</strong> Os dados são armazenados em infraestrutura de banco de dados em nuvem protegida por regras rígidas de segurança e criptografia de tráfego.</li>
              <li><strong>Compartilhamento:</strong> Seus dados pessoais não são comercializados ou cedidos a terceiros não autorizados. O acesso administrativo é restrito a operadores e secretaria credenciados.</li>
              <li><strong>Direitos do Titular:</strong> O titular pode consultar, atualizar seus dados cadastrais ou solicitar a exclusão de sua conta através das opções disponíveis em seu perfil ("Zona de Perigo").</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
               3. Pagamentos, Taxas de Inscrição e Transações Financeiras
            </h3>
            <p>
              Determinados eventos, cursos de extensão, simpósios, materiais, taxas de emissão de documentos físicos ou serviços adicionais poderão, a critério da FAJOPA ou dos organizadores responsáveis, estar sujeitos a cobrança financeira e pagamento de taxas:
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-slate-400 dark:marker:text-slate-600">
              <li><strong>Processamento Seguro:</strong> Quando aplicável, pagamentos serão efetuados através de meios eletrônicos certificados e intermediadores seguros (ex: PIX com QR Code dinâmico, cartões de crédito/débito ou gateways bancários).</li>
              <li><strong>Proteção dos Dados Financeiros:</strong> A plataforma <strong>não armazena</strong> dados sensíveis de cartões de crédito ou senhas bancárias em seus servidores. As transações são transmitidas de forma criptografada diretamente aos provedores financeiros autorizados.</li>
              <li><strong>Confirmação de Inscrição e Acesso:</strong> Em eventos ou serviços com taxa, a confirmação definitiva da vaga, credenciamento ou liberação de certificado estará condicionada à confirmação e compensação da transação financeira pelo sistema bancário.</li>
              <li><strong>Política de Reembolso e Cancelamento:</strong> Em observância ao Código de Defesa do Consumidor (Lei nº 8.078/1990) e às normas do regulamento específico de cada evento, pedidos de cancelamento e reembolso deverão ser solicitados dentro dos prazos regulamentares informados na divulgação de cada atividade.</li>
              <li><strong>Taxas de Emissão e Serviços:</strong> A instituição reserva-se o direito de estipular taxas de reemissão de vias físicas ou de serviços administrativos extraordinários previamente comunicados.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               4. Emissão e Validação de Certificados Digitais
            </h3>
            <p>
              Os certificados de participação e organização gerados pelo sistema contêm chaves de autenticação exclusivas e QR Codes que permitem verificação pública instantânea de autenticidade no verificador oficial do sistema. A emissão pressupõe o cumprimento dos requisitos de frequência mínima e regularidade acadêmica e financeira do participante.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               5. Isenção de Garantias e Disponibilidade
            </h3>
            <p>
              O sistema é mantido com os mais altos padrões de disponibilidade e segurança, mas pode passar por intervenções programadas de manutenção, melhorias ou atualizações. A FAJOPA e os desenvolvedores não se responsabilizam por instabilidades temporárias decorrentes de falhas gerais de conexão da internet ou de provedores de infraestrutura externa.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-black text-slate-800 dark:text-white pb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
               6. Concordância do Usuário e Atualizações
            </h3>
            <p>
              Ao utilizar a plataforma, submeter formulários de cadastro, inscrever-se em eventos ou efetuar transações, você <strong>afirma conhecer, consentir e concordar integralmente</strong> com estes Termos de Uso e com a Política de Privacidade.
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
