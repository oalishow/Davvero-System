import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, LayoutGrid, HelpCircle, Users, Trophy } from 'lucide-react';

export default function ToolsPanel() {
  const tools = [
    {
      name: 'Quiz Catequético',
      url: 'https://quizcatequetico.netlify.app',
      icon: HelpCircle,
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      description: 'Teste e aprimore seus conhecimentos catequéticos'
    },
    {
      name: 'Bingo Show',
      url: 'https://bingoshow.netlify.app',
      icon: LayoutGrid,
      color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
      description: 'Gerencie e jogue partidas animadas de bingo'
    },
    {
      name: 'Organizador de Equipes',
      url: 'https://organizadordeequipes.netlify.app',
      icon: Users,
      color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      description: 'Crie e organize equipes facilmente para seus eventos'
    },
    {
      name: 'Vou Ganhei!',
      url: 'https://vouganhei.netlify.app',
      icon: Trophy,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      description: 'Gerencie e realize sorteios de rifas e prêmios de forma prática'
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            Central de Ferramentas
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Acesse aplicativos e recursos adicionais. (Em desenvolvimento por Alison Fernando Rodrigues dos Santos)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, index) => (
            <motion.a
              key={tool.name}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-colors group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tool.color}`}>
                <tool.icon className="w-6 h-6" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center justify-between">
                {tool.name}
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              </h3>
              
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {tool.description}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  );
}
