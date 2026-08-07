import { createPortal } from "react-dom";
import { X, Info } from "lucide-react";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animated-fade-in border border-slate-200 dark:border-slate-800">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
                Sobre o Aplicativo
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                História e agradecimentos do DAVVERO System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-hide">
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative">
              <div className="absolute -top-3 -left-2 text-4xl text-indigo-200 dark:text-indigo-900/40 font-serif">
                "
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed relative z-10 text-justify">
                É dever permanente da Igreja perscrutar os sinais dos tempos e
                interpretá-los à luz do Evangelho, para que assim possa
                responder, de modo adaptado a cada geração, às eternas
                interrogações dos homens sobre o sentido da vida...
              </p>
              <p className="text-xs text-slate-500 font-medium mt-2 text-right">
                (Constituição Pastoral Gaudium et Spes, n. 4)
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative">
              <div className="absolute -top-3 -left-2 text-4xl text-sky-200 dark:text-sky-900/40 font-serif">
                "
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed relative z-10 text-justify">
                Vocês vivem nela, e isso não é mau: contém enormes oportunidades
                de estudo e comunicação. No entanto, não permitam que o
                algoritmo escreva a sua história! Sejam os seus autores:
                sirvam-se da tecnologia com sabedoria e não permitam que a
                tecnologia se sirva de vocês.
              </p>
              <p className="text-xs text-slate-500 font-medium mt-2 text-right">
                – Disse o Papa Leão XIV (Vatican News, 2025)
              </p>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-justify mt-6">
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">
                E o Verbo se fez I.A.?
              </h3>
              <p>
                (...) Em certo sentido, pode-se afirmar que sim: o Verbo eterno,
                que "se fez carne e habitou entre nós" (cf. Jo 1,14), continua
                manifestando-se através das mediações históricas disponíveis em
                cada época, incluindo as tecnologias digitais contemporâneas.
                Quando a IA é utilizada para facilitar o acesso às Sagradas
                Escrituras, promover a formação catequética, otimizar a
                organização pastoral ou criar pontes de comunicação entre
                pastores e fiéis, ela pode ser considerada instrumento da
                providência divina na história da salvação.
              </p>
              <p>
                Por outro lado, a resposta deve ser não: o Verbo não se reduz a
                bits, a essência divina não se confunde com algoritmos, e o
                mistério da Encarnação não pode ser digitalizado ou
                automatizado. A experiência do sagrado, o encontro pessoal com
                Cristo, a vida de oração e a comunhão fraterna mantêm dimensões
                irredutíveis que transcendem qualquer mediação tecnológica,
                porém Cristo se faz presente naqueles que a utilizam e podem com
                tais ferramentas poderosas, evangelizar este continente digital.
              </p>
              <p>
                Como tudo é novo, e teremos ainda mais novidades sobre
                tecnologia após a produção deste estudo, talvez a resposta mais
                adequada seja paradoxal: o Verbo se fez IA na medida em que a IA
                serve ao Verbo, mas o Verbo jamais se reduz à IA. A tecnologia
                pode ser sacramento da presença divina quando transparente a
                valores mais altos, mas, pode tornar-se ídolo quando pretende
                substituir o próprio divino.
              </p>
              <p>
                Esta tensão criativa entre afirmação e negação, entre
                potencialidade e limitação, entre esperança e vigilância,
                caracteriza a condição de toda atividade humana no tempo da
                Igreja peregrina. Como os projetos analisados demonstram, é
                possível e necessário abraçar as oportunidades que a IA oferece
                para a evangelização, desde que mantenhamos o ser humano em
                primeiro lugar, e que possamos ter sempre presente que "nem só
                de pão vive o homem, mas de toda palavra que procede da boca de
                Deus" (cf. Mt 4,4).
              </p>
            </div>

            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-8">
              Nossa História
            </h3>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-justify">
              <p>
                O projeto nasceu em outubro de 2025 com o objetivo de aplicar,
                de forma prática, os conhecimentos adquiridos no Trabalho de
                Conclusão de Curso (TCC) intitulado{" "}
                <strong>
                  "E O VERBO SE FEZ I.A.? DA REFLEXÃO TEOLÓGICA E COMUNICATIVA
                  AO DESENVOLVIMENTO DE SOLUÇÕES PASTORAIS COM INTELIGÊNCIA
                  ARTIFICIAL"
                </strong>
                , por meio da programação <em>Vibe Coding</em>.
              </p>

              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30 my-6 text-slate-700 dark:text-slate-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
                  O que é Vibe Coding?
                </h4>
                <p className="text-sm">
                  O <em>Vibe Coding</em> (ou "programar por intuição/vibração")
                  é um novo paradigma de desenvolvimento de software em que a
                  criação ocorre de forma descritiva e colaborativa com modelos
                  avançados de Inteligência Artificial. Em vez de digitar
                  manualmente cada linha sintática de código, o desenvolvedor
                  guia o processo expressando intenções, lógicas e o resultado
                  desejado em linguagem natural humana, enquanto a IA atua como
                  uma engenheira que converte essas ideias em código-fonte real.
                  Isso torna o processo ágil e democratiza a capacidade de
                  transformar ideias em tecnologia com sentimento e propósito.
                </p>
              </div>

              <p>
                Inicialmente, a ideia era criar apenas um simples "Verificador
                de Carteirinhas".
              </p>
              <p>
                Naquela época, a inteligência artificial utilizada (Gemini 2.5
                PRO), embora potente, ainda possuía algumas limitações em
                programação. Mas com a chegada da versão Gemini 3.1 PRO, houve
                um salto de tecnologia que impulsionou a continuidade do
                desenvolvimento. A intenção inicial era apenas realizar algumas
                atualizações ao sistema antigo, pois em 2025, integrávamos
                carteirinhas físicas a um sistema verificador de forma bastante
                manual, o que dava muito trabalho.
              </p>
              <p>
                Entretanto, ao conversar com diversos alunos, professores e
                colaboradores, ficou clara a necessidade de automatizar alguns
                serviços que demandavam tempo e eram custosos para os
                funcionários. Ao ouvir essas necessidades ao longo de 2026,
                decidimos melhorar cada vez mais o programa. Ele passou por
                diversas reformulações e atualizações de layout e nomes (como{" "}
                <em>A vero</em> e <em>Verify-ID</em>), muitas delas guiadas por
                sugestões de quem usava o sistema no dia a dia.
              </p>
              <p>
                Assim, surgiu o <strong>DAVVERO System</strong>. O nome "Davvero"
                vem do italiano e significa <em>"Verdadeiro"</em>, ou expressa
                uma surpresa como: <em>"Sério?"</em>. Foi exatamente assim que
                me senti quando pude perceber que a ferramenta podia ir muito
                além do que eu imaginava. Por isso, essa homenagem. O sistema
                hoje tem como objetivo auxiliar no processo de identificação e
                na organização de eventos da FAJOPA. Foram diversos passos para
                chegar a este resultado, que não foi fácil e exigiu muito tempo,
                mas deixo aqui como um presente meu para a faculdade, para o
                seminário e para as futuras gerações: de que nada é impossível
                quando se faz com amor e quando construímos juntos, em união.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-8">
              Agradecimentos Especiais
            </h3>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-justify mb-6">
              <p>
                Quero expressar minha gratidão à Deus, por dar-me a vocação e os
                dons necessários à serviço do povo de Deus, também, pela graça
                de concluir este aplicativo.
              </p>
              <p>
                Louvo também a Santíssima Virgem Maria, e aos meus santos de
                devoção (São Francisco, São Miguel e Santa Teresinha do Menino
                Jesus), por terem me acompanhado ternamente no desenvolvimento
                deste aplicativo, bem como em todos os meus caminhos, tornando
                minha jornada mais alegre e segura.
              </p>
              <p>
                Agradeço a minha família, e à Diocese de Assis, a qual pertenço,
                na pessoa do Exmo. Revmo. Dom Argemiro de Azevedo, Bispo
                Diocesano de Assis, bem como os formadores, ao clero e todo povo
                de Deus, por nos proporcionarem uma formação integral, em vista
                de nossas vocações e pela Igreja.
              </p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-justify mb-4">
              Nossa profunda gratidão a todas as pessoas que ajudaram direta e
              indiretamente na criação desta plataforma:
            </p>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Reitor Geral da FAJOPA:
                </strong>{" "}
                Pe. Dr. Reginaldo Marcolino
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Vice-Reitor:
                </strong>{" "}
                Pe. Dr. Anderson Santana Cunha
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Retiro do Seminário:
                </strong>{" "}
                Padre Altair Gaiquer
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Orientador e Coordenador da Teologia:
                </strong>{" "}
                Prof. Dr. Pe. Danilo Nobre dos Santos
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Bibliotecária:
                </strong>{" "}
                Juliana Mendonça
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Suporte Técnico:
                </strong>{" "}
                Danilo Chaves e Adriano Matilha
              </p>
            </div>

            <div className="mt-8 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Equipe de Testadores
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    iOS
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    João Roberto Valencio, Pe. Dr. Anderson Santana Cunha
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Android
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    Jonatas Mário Cunha, Carlos Eduardo Dias da Silva, Maicon Luiis, Luan Balbino Lopes, Danilo Chaves
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                    Windows
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    Juliana Mendonça, Alison Fernando Rodrigues dos Santos
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider text-slate-500">
                Referências
              </h4>
              <div className="space-y-4 text-xs text-slate-500 dark:text-slate-400 break-words text-justify">
                <p>
                  VATICAN NEWS. Leão XIV: uma educação desarmante e desarmada
                  cria igualdade e crescimento para todos. Vatican News, 30 out.
                  2025. Disponível em:{" "}
                  <a
                    href="https://www.vaticannews.va/pt/papa/news/2025-10/papa-leao-educacao-desarmante-desarmada-jubileu-mundo-educativo.html"
                    className="text-indigo-500 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.vaticannews.va/pt/papa/news/2025-10/papa-leao-educacao-desarmante-desarmada-jubileu-mundo-educativo.html
                  </a>
                  . Acesso em: 26 abr. 2026.
                </p>
                <p>
                  CONCÍLIO VATICANO II. Constituição Pastoral Gaudium et Spes.
                  Vaticano, 1965. Disponível em:{" "}
                  <a
                    href="https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_po.html"
                    className="text-indigo-500 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_po.html
                  </a>
                  . Acesso em: 26 abr. 2026.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
