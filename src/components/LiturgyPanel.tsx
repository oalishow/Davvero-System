import React, { useState } from "react";
import { createPortal } from "react-dom";
import { BookHeart, ExternalLink, BookOpen, CalendarHeart, X, Youtube, Play } from "lucide-react";

export default function LiturgyPanel() {
  const [selectedHour, setSelectedHour] = useState<{ id: string, name: string, url: string, isYoutube?: boolean } | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");

  const hours = [
    { id: "liturgia-horas-completa", name: "Liturgia das Horas", icon: BookHeart, time: "Ofício Divino", url: "https://liturgiadashoras.online/" },
    { id: "liturgia-diaria", name: "Liturgia Diária (CNBB)", icon: BookOpen, time: "Missa do Dia", url: "https://www.cnbb.org.br/liturgia-diaria/", external: true },
    { id: "cnbb-sul1", name: "CNBB Sul 1", icon: BookOpen, time: "Igreja no Estado de SP", url: "https://cnbbsul1.org.br/", external: true },
    { id: "vaticano", name: "Vaticano", icon: BookOpen, time: "Igreja Católica", url: "https://www.vatican.va/content/vatican/pt.html", external: true },
    { id: "noticias-igreja", name: "Notícias da Igreja", icon: BookOpen, time: "Vatican News", url: "https://www.vaticannews.va/pt.html", external: true },
    { id: "oracoes", name: "Orações", icon: BookHeart, time: "Pocket Terço", url: "https://pocketterco.com.br/oracoes" },
    { id: "santo-do-dia", name: "Santo do Dia", icon: CalendarHeart, time: "Hagiografia", url: "https://santo.cancaonova.com/" },
    { id: "biblia-jerusalem", name: "Bíblia de Jerusalém", icon: BookOpen, time: "Escrituras Sagradas", url: "https://liturgiadashoras.online/biblia/biblia-jerusalem/" },
    { id: "catecismo-igreja", name: "Catecismo da Igreja", icon: BookHeart, time: "Doutrina Católica", url: "https://liturgiadashoras.online/catechismus/" },
    { id: "direito-canonico", name: "Direito Canônico", icon: BookOpen, time: "Iuris Canonici", url: "https://liturgiadashoras.online/iuris-canonici/" },
    { id: "calendario-liturgico", name: "Calendário Litúrgico", icon: CalendarHeart, time: "Ano Litúrgico", url: "https://liturgiadashoras.online/calendario-liturgia-da-missa-2023-ano-a/" },
  ];

  const getYoutubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`;
    }
    return url;
  };

  const handleOpenYoutube = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeLink) return;
    
    const embedUrl = getYoutubeEmbedUrl(youtubeLink);
    setSelectedHour({
      id: "youtube-custom",
      name: "Vídeo / Formação",
      url: embedUrl,
      isYoutube: true
    });
    setYoutubeLink("");
  };

  return (
    <div className="space-y-6">
      {selectedHour && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-900 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-lg">
                {selectedHour.isYoutube ? (
                   <Youtube className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                ) : (
                   <BookHeart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white leading-none mb-1">{selectedHour.name}</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {selectedHour.isYoutube ? "Modo Sem Anúncios (Embed)" : "Modo Leitura Sem Anúncios"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <a 
                 href={selectedHour.isYoutube ? selectedHour.url : `${selectedHour.url}?t=${Date.now()}`}
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
               >
                 Abrir no Navegador <ExternalLink className="w-3 h-3" />
               </a>
              <button
                onClick={() => {
                  setSelectedHour(null);
                }}
                className="p-2 bg-slate-200 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 rounded-full transition-colors text-slate-600 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center">
            {selectedHour.isYoutube ? (
              <iframe 
                src={selectedHour.url} 
                className="w-full h-full max-w-6xl aspect-video border-none shadow-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={selectedHour.name}
              />
            ) : (
              <iframe 
                src={`${selectedHour.url}?t=${Date.now()}`} 
                className="w-full h-full border-none"
                sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox"
                title={selectedHour.name}
              />
            )}
          </div>
        </div>, document.body
      )}

      <div className="bg-rose-600 dark:bg-rose-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-rose-500 dark:border-rose-600">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none mix-blend-overlay">
          <BookHeart className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <BookHeart className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black mb-2">
            Portal Católico
          </h2>
          <p className="text-rose-100 font-medium text-sm sm:text-base max-w-md">
            Acesse rapidamente notícias, a Liturgia Diária, orações e documentos da Igreja Católica.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-1">
            <Youtube className="w-4 h-4 text-rose-500" />
            Ver Vídeo (YouTube) sem Anúncios
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Aulas, homilias e formações</p>
        </div>
        <form onSubmit={handleOpenYoutube} className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <input 
            type="url" 
            placeholder="Cole o link do YouTube aqui..." 
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
            className="w-full sm:w-64 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none transition-all focus:border-rose-400 dark:focus:border-rose-500"
          />
          <button 
            type="submit"
            disabled={!youtubeLink}
            className="btn-modern bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shrink-0"
          >
            <Play className="w-4 h-4" /> Assistir
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {hours.map((hour) => (
          <button
            key={hour.id}
            onClick={() => {
              if (hour.external) {
                window.open(hour.url, '_blank');
              } else {
                setSelectedHour(hour as any);
              }
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-rose-400 dark:hover:border-rose-500 hover:shadow-md transition-all group flex flex-col items-center text-center gap-3"
          >
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <hour.icon className="w-6 h-6 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                {hour.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hour.time}
              </p>
            </div>
            <div className="mt-2 text-[10px] uppercase font-bold tracking-wider text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              Abrir Leitura <ExternalLink className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          "Sete vezes ao dia eu te louvo, pelas tuas justas decisões." <br/>
          <span className="text-xs font-bold mt-2 inline-block">— Salmo 119, 164</span>
        </p>
      </div>
    </div>
  );
}
