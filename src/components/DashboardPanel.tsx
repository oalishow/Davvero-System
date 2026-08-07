import { useState, useEffect } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { Users, Calendar, Activity, Loader2, TrendingUp, UserCheck, Shield, Printer } from "lucide-react";
import { motion } from "motion/react";

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardPanel({ allMembers }: { allMembers: any[] }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalMembers: number;
    activeMembers: number;
    totalAppointments: number;
    totalEvents: number;
    peakUsageDate: string;
    peakUsageCount: number;
    rolesDistribution: { name: string; value: number }[];
    seminaryDistribution: { name: string; value: number }[];
    recentActivity: { date: string; membersAdded: number; events: number; appointments: number }[];
  } | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch appointments
        const appointmentsQuery = query(collection(db, `artifacts/${appId}/public/data/appointments`));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);

        // Fetch events
        const eventsQuery = query(collection(db, `artifacts/${appId}/public/data/events`));
        const eventsSnapshot = await getDocs(eventsQuery);

        let total = 0;
        let active = 0;
        const roleCounts: Record<string, number> = {};
        const seminaryCounts: Record<string, number> = {};
        const dateCounts: Record<string, { members: number; events: number; appointments: number }> = {};

        const trackDate = (dateStr: string, type: 'members' | 'events' | 'appointments') => {
            if (dateStr === 'Desconhecido') return;
            if (!dateCounts[dateStr]) {
                dateCounts[dateStr] = { members: 0, events: 0, appointments: 0 };
            }
            dateCounts[dateStr][type]++;
        };

        allMembers.forEach((data) => {
          // Filter out trash/deleted
          if (data.isTrash) return;

          total++;
          if (data.isActive) active++;

          // Roles
          if (data.roles && Array.isArray(data.roles)) {
            data.roles.forEach((r: string) => {
              roleCounts[r] = (roleCounts[r] || 0) + 1;
            });
          }

          // Seminary
          if (data.seminary) {
            seminaryCounts[data.seminary] = (seminaryCounts[data.seminary] || 0) + 1;
          }

          // Dates
          let dateAdded = 'Desconhecido';
          if (data.createdAt) {
            try {
              if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                dateAdded = data.createdAt.toDate().toISOString().split('T')[0];
              } else if (data.createdAt?.seconds) {
                dateAdded = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
              } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                dateAdded = new Date(data.createdAt).toISOString().split('T')[0];
              }
            } catch (err) {}
          }
          trackDate(dateAdded, 'members');
        });

        // Appts
        let totalAppts = 0;
        appointmentsSnapshot.forEach((doc) => {
            totalAppts++;
            const data = doc.data();
            let d = 'Desconhecido';
             if (data.createdAt) {
                try {
                  if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                    d = data.createdAt.toDate().toISOString().split('T')[0];
                  } else if (data.createdAt?.seconds) {
                    d = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
                  } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    d = new Date(data.createdAt).toISOString().split('T')[0];
                  }
                } catch (err) {}
            }
            trackDate(d, 'appointments');
        });

        // Events
        let totalEvts = 0;
        eventsSnapshot.forEach((doc) => {
            totalEvts++;
            const data = doc.data();
            let d = 'Desconhecido';
            if (data.createdAt) {
                try {
                  if (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') {
                    d = data.createdAt.toDate().toISOString().split('T')[0];
                  } else if (data.createdAt?.seconds) {
                    d = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
                  } else if (typeof data.createdAt === 'string' || typeof data.createdAt === 'number') {
                    d = new Date(data.createdAt).toISOString().split('T')[0];
                  }
                } catch (err) {}
            }
            trackDate(d, 'events');
        });

        // Format for charts
        const rolesDistribution = Object.entries(roleCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const seminaryDistribution = Object.entries(seminaryCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        const recentActivity = Object.entries(dateCounts)
          .map(([date, counts]) => ({ date, membersAdded: counts.members, events: counts.events, appointments: counts.appointments }))
          .sort((a, b) => a.date.localeCompare(b.date));

        let peakDate = 'N/A';
        let peakVal = 0;
        recentActivity.forEach(day => {
            const sum = day.appointments + day.events + day.membersAdded;
            if (sum > peakVal) {
                peakVal = sum;
                peakDate = day.date;
            }
        });

        setStats({
          totalMembers: total,
          activeMembers: active,
          totalAppointments: totalAppts,
          totalEvents: totalEvts,
          peakUsageDate: peakDate,
          peakUsageCount: peakVal,
          rolesDistribution,
          seminaryDistribution,
          recentActivity: recentActivity.slice(-14) // Limit to last 14 days
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [allMembers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando dados analíticos...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 p-3 rounded-2xl ring-1 ring-sky-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Dashboard Analítico</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Métricas e acompanhamento do uso do sistema</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all active:scale-95 print:hidden"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Imprimir</span>
        </button>
      </div>

      <div className="grid grid-cols-1 tracking-tight sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-sky-50 dark:bg-sky-500/10 p-3 rounded-2xl mb-3 ring-1 ring-sky-500/20">
            <Users className="w-6 h-6 text-sky-500" />
          </div>
          <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">{stats.totalMembers}</p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Total de Cadastros</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl mb-3 ring-1 ring-emerald-500/20">
            <UserCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">{stats.activeMembers}</p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Membros Ativos</h3>
          <p className="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-bold bg-emerald-50 dark:bg-emerald-500/20 px-2.5 py-1 rounded-full">
            {stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% ativos
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center col-span-2 md:col-span-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-2xl mb-3 ring-1 ring-indigo-500/20">
            <TrendingUp className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
            {stats.recentActivity.reduce((acc, curr) => acc + curr.membersAdded, 0)}
          </p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Novos Cadastros</h3>
          <p className="text-[10px] md:text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-bold bg-indigo-50 dark:bg-indigo-500/20 px-2.5 py-1 rounded-full">
            Últimos 14 dias
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-fuchsia-400 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-fuchsia-50 dark:bg-fuchsia-500/10 p-3 rounded-2xl mb-3 ring-1 ring-fuchsia-500/20">
            <Calendar className="w-6 h-6 text-fuchsia-500" />
          </div>
          <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">{stats.totalEvents}</p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Eventos Criados</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-2xl mb-3 ring-1 ring-amber-500/20">
            <Activity className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">{stats.totalAppointments}</p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Seminário</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col items-center text-center col-span-2 md:col-span-1 relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-400 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-2xl mb-3 ring-1 ring-rose-500/20">
            <Activity className="w-6 h-6 text-rose-500" />
          </div>
          <p className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight mt-1">{stats.peakUsageDate !== 'N/A' ? new Date(stats.peakUsageDate).toLocaleDateString('pt-BR') : '--'}</p>
          <h3 className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 uppercase tracking-wider">Pico de Atividade</h3>
          <p className="text-[10px] md:text-xs text-rose-600 dark:text-rose-400 mt-2 font-bold bg-rose-50 dark:bg-rose-500/20 px-2.5 py-1 rounded-full">
            {stats.peakUsageCount} interações
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 mt-6">
        {/* Distribuição por Cargo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-sky-100 dark:bg-sky-500/20 p-2 rounded-xl text-sky-600 dark:text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Distribuição por Cargo</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Top funções</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.rolesDistribution.slice(0, 8)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" name="Quantidade" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Distribuição por Seminário */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
               <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Seminário / Local</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Origem dos Membros</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.seminaryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                    return percent > 0.05 ? (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {stats.seminaryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        
        {/* Atividade de Registro Recente */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col col-span-1 lg:col-span-2"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Evolução de Uso</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Geral do Sistema (14 dias)</p>
            </div>
          </div>
          <div className="h-[250px] md:h-[300px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.recentActivity} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="membersAdded" name="Cadastros" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="events" name="Eventos" stroke="#d946ef" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="appointments" name="Seminário" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
