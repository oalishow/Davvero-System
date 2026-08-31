import { useState, useEffect, useCallback } from "react";
import { collection, query, getDocs, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { getFullTelemetryData, TelemetryStats } from "../lib/telemetry";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  Users, Calendar, Activity, Loader2, TrendingUp, UserCheck, Shield, Printer,
  QrCode, Eye, Database, Radio, RefreshCw, Smartphone, Laptop, CheckCircle2,
  Clock, Award, MessageSquare, Car, Server, ArrowUpRight, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#ef4444'];
const SCAN_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];
const DEVICE_COLORS = ['#10b981', '#0ea5e9', '#6366f1'];

export default function DashboardPanel({ allMembers }: { allMembers: any[] }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [activeRange, setActiveRange] = useState<"7d" | "14d" | "all">("14d");

  const [telemetry, setTelemetry] = useState<TelemetryStats | null>(null);
  const [stats, setStats] = useState<{
    totalMembers: number;
    activeMembers: number;
    totalAppointments: number;
    totalEvents: number;
    totalAttendances: number;
    totalMuralPosts: number;
    totalDobloLogs: number;
    peakUsageDate: string;
    peakUsageCount: number;
    rolesDistribution: { name: string; value: number }[];
    seminaryDistribution: { name: string; value: number }[];
    recentActivity: { date: string; membersAdded: number; events: number; appointments: number }[];
  } | null>(null);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      
      // 1. Fetch appointments
      const appointmentsQuery = query(collection(db, `artifacts/${appId}/public/data/appointments`));
      const appointmentsSnapshot = await getDocs(appointmentsQuery);

      // 2. Fetch events
      const eventsQuery = query(collection(db, `artifacts/${appId}/public/data/events`));
      const eventsSnapshot = await getDocs(eventsQuery);

      // 3. Fetch attendances count
      let attendancesCount = 0;
      try {
        const attSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/attendances`));
        attendancesCount = attSnap.size;
      } catch (e) {}

      // 4. Fetch mural posts count
      let muralCount = 0;
      try {
        const muralSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/mural_posts`));
        muralCount = muralSnap.size;
      } catch (e) {}

      // 5. Fetch doblo logs count
      let dobloCount = 0;
      try {
        const dobloSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/doblo_logs`));
        dobloCount = dobloSnap.size;
      } catch (e) {}

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
        if (data.isTrash) return;

        total++;
        if (data.isActive) active++;

        if (data.roles && Array.isArray(data.roles)) {
          data.roles.forEach((r: string) => {
            roleCounts[r] = (roleCounts[r] || 0) + 1;
          });
        }

        if (data.seminary) {
          seminaryCounts[data.seminary] = (seminaryCounts[data.seminary] || 0) + 1;
        }

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
        totalAttendances: attendancesCount,
        totalMuralPosts: muralCount,
        totalDobloLogs: dobloCount,
        peakUsageDate: peakDate,
        peakUsageCount: peakVal,
        rolesDistribution,
        seminaryDistribution,
        recentActivity: recentActivity.slice(-14)
      });

      // 6. Fetch Telemetry Stats
      const teleData = await getFullTelemetryData(total, totalEvts, totalAppts);
      setTelemetry(teleData);
      setLastRefreshedAt(new Date());

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allMembers]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh interval (every 30s when enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Realtime listener for online presence
  useEffect(() => {
    try {
      const presenceQuery = query(collection(db, `artifacts/${appId}/public/data/online_presence`));
      const unsubscribe = onSnapshot(presenceQuery, (snap) => {
        const now = Date.now();
        let online = 0;
        snap.forEach((d) => {
          const data = d.data();
          if (data.lastActive) {
            const diff = now - new Date(data.lastActive).getTime();
            if (diff < 90 * 1000) online++;
          }
        });
        setTelemetry((prev) => prev ? { ...prev, onlineUsersCount: Math.max(1, online) } : prev);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn("Realtime presence listener fallback:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando métricas e telemetria do sistema...</p>
      </div>
    );
  }

  if (!stats || !telemetry) return null;

  // Prepare chart data for QR Scans by Type
  const scanTypesData = [
    { name: "Crachás de Membros", value: telemetry.scansByType.badge },
    { name: "Check-in Eventos", value: telemetry.scansByType.event },
    { name: "Certificados", value: telemetry.scansByType.certificate },
    { name: "Visitantes", value: telemetry.scansByType.visitor },
  ].filter(d => d.value > 0);

  // Prepare device breakdown data
  const deviceData = [
    { name: "PWA Instalado", value: telemetry.deviceBreakdown.mobilePwa },
    { name: "Navegador Mobile", value: telemetry.deviceBreakdown.mobileBrowser },
    { name: "Desktop / Web", value: telemetry.deviceBreakdown.desktop },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 text-sky-600 dark:text-sky-400 p-3 rounded-2xl ring-1 ring-sky-500/20 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Painel & Telemetria em Tempo Real
              </h2>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20 animate-pulse">
                <Radio className="w-3 h-3" /> Ao Vivo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Métricas de leituras QR, acessos, operações Firestore e fluxo de usuários
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              autoRefresh 
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/30" 
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700"
            }`}
            title="Alternar atualização automática"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-emerald-500" : ""}`} />
            <span>{autoRefresh ? "Auto-refresh Ativo" : "Auto-refresh Pausado"}</span>
          </button>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all active:scale-95 disabled:opacity-50"
            title="Atualizar dados agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky-500" : ""}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Relatório</span>
          </button>
        </div>
      </div>

      {/* --- TELEMETRY HIGHLIGHT BAR (Solicitado: Usuários Online, Leituras QR, Acessos App, Leituras/Escritas) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        
        {/* 1. Usuários Online Agora */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-slate-800/60 dark:to-slate-800/40 rounded-3xl p-5 shadow-sm ring-1 ring-emerald-500/20 relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Em Tempo Real
              </span>
              <h3 className="font-bold text-slate-600 dark:text-slate-300 text-xs mt-2 uppercase tracking-wider">
                Usuários Online
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                {telemetry.onlineUsersCount}
              </p>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {telemetry.onlineUsersCount === 1 ? "sessão ativa" : "sessões ativas"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Dispositivos conectados e sincronizados
            </p>
          </div>
        </motion.div>

        {/* 2. Leituras de QR Code */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-500/20 dark:via-slate-800/60 dark:to-slate-800/40 rounded-3xl p-5 shadow-sm ring-1 ring-sky-500/20 relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-700 dark:text-sky-300">
                <QrCode className="w-3 h-3" /> Scanner & Validador
              </span>
              <h3 className="font-bold text-slate-600 dark:text-slate-300 text-xs mt-2 uppercase tracking-wider">
                Leituras de QR Code
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                {telemetry.totalQrScans}
              </p>
              {telemetry.todayQrScans > 0 && (
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/20 px-2 py-0.5 rounded-md">
                  +{telemetry.todayQrScans} hoje
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Crachás, eventos, certificados e visitantes
            </p>
          </div>
        </motion.div>

        {/* 3. Acessos do Aplicativo */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-slate-800/60 dark:to-slate-800/40 rounded-3xl p-5 shadow-sm ring-1 ring-indigo-500/20 relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                <Smartphone className="w-3 h-3" /> PWA & Web
              </span>
              <h3 className="font-bold text-slate-600 dark:text-slate-300 text-xs mt-2 uppercase tracking-wider">
                Acessos do App
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                {telemetry.totalAppAccesses}
              </p>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
                {telemetry.todayAppAccesses} hoje
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Visualizações e sessões de participantes
            </p>
          </div>
        </motion.div>

        {/* 4. Leituras e Escritas no Banco (Firestore) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-slate-800/60 dark:to-slate-800/40 rounded-3xl p-5 shadow-sm ring-1 ring-amber-500/20 relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300">
                <Database className="w-3 h-3" /> Firestore I/O
              </span>
              <h3 className="font-bold text-slate-600 dark:text-slate-300 text-xs mt-2 uppercase tracking-wider">
                Leituras & Escritas
              </h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Leituras</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{telemetry.totalDbReads}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Escritas</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{telemetry.totalDbWrites}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Operações sincronizadas em nuvem
            </p>
          </div>
        </motion.div>
      </div>

      {/* --- CARDS DE OPERAÇÃO GERAL (Membros, Eventos, Presenças, Agendamentos, etc.) --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Cadastros */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Cadastros</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalMembers}</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.activeMembers} ativos ({stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}%)
            </p>
          </div>
        </div>

        {/* Eventos Criados */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Eventos</span>
            <Calendar className="w-4 h-4 text-fuchsia-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalEvents}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Atividades cadastradas
            </p>
          </div>
        </div>

        {/* Presenças Registradas */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Presenças</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalAttendances}</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              Check-ins validados
            </p>
          </div>
        </div>

        {/* Agendamentos */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Atendimentos</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalAppointments}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Slots e horários
            </p>
          </div>
        </div>

        {/* Mural & Comunidade */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Mural</span>
            <MessageSquare className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalMuralPosts}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Posts da comunidade
            </p>
          </div>
        </div>

        {/* Doblo & Veículos */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Veículo Doblò</span>
            <Car className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalDobloLogs}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Viagens registradas
            </p>
          </div>
        </div>
      </div>

      {/* --- GRÁFICOS PRINCIPAIS DE FLUXO & OPERAÇÕES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        
        {/* Gráfico: Leituras de QR Code vs Acessos ao App (Evolução Diária) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="bg-sky-100 dark:bg-sky-500/20 p-2 rounded-xl text-sky-600 dark:text-sky-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">
                  Fluxo de Acessos & Leituras de QR Code
                </h3>
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Histórico Diário
                </p>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry.dailyMetrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="accessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="scansGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="accesses" name="Acessos ao App" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#accessGrad)" />
                <Area type="monotone" dataKey="scans" name="Leituras de QR Code" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#scansGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Gráfico: Leituras vs. Escritas no Firestore (Operações) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-500/20 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">
                  Volume de Operações Firestore
                </h3>
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Leituras vs. Escritas por Dia
                </p>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetry.dailyMetrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="reads" name="Leituras (Reads)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="writes" name="Escritas (Writes)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* --- GRÁFICOS DE SEGMENTAÇÃO (Tipos de Leituras QR & Meios de Acesso) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        
        {/* Tipos de Leituras QR Realizadas */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-sky-100 dark:bg-sky-500/20 p-2 rounded-xl text-sky-600 dark:text-sky-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm">
                Finalidade das Leituras QR
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Distribuição de Escaneamentos
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scanTypesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {scanTypesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SCAN_COLORS[index % SCAN_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Dispositivos e Meios de Acesso */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm">
                Plataforma de Acesso
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                PWA / Navegador / Desktop
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-dev-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Últimas Leituras em Tempo Real (Feed) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col md:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-3 mb-4 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-fuchsia-100 dark:bg-fuchsia-500/20 p-2 rounded-xl text-fuchsia-600 dark:text-fuchsia-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm">
                Últimas Leituras de QR
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                Auditoria ao Vivo
              </p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2 pr-1 custom-scrollbar">
            {telemetry.recentScans.length > 0 ? (
              telemetry.recentScans.map((scan) => (
                <div 
                  key={scan.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-100 dark:ring-slate-700/40 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                    <div className="truncate">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {scan.codeSummary || "QR Code"}
                      </p>
                      <span className="text-[10px] font-medium text-slate-400 capitalize">
                        {scan.type === "badge" ? "Crachá" : scan.type === "event" ? "Evento" : scan.type === "certificate" ? "Certificado" : "Visitante"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                    {scan.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center text-slate-400">
                <QrCode className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-medium">Nenhum escaneamento recente registrado no momento.</p>
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* --- DISTRIBUIÇÃO INSTITUCIONAL (Cargos & Seminários) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Distribuição por Cargo */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-sky-100 dark:bg-sky-500/20 p-2 rounded-xl text-sky-600 dark:text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Distribuição por Cargo</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Top funções e categorias</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.rolesDistribution.slice(0, 8)} margin={{ top: 10, right: 30, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={45} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" name="Membros" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Distribuição por Seminário / Local */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
               <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Seminário / Local de Origem</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Origem dos Membros</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.seminaryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
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
                    <Cell key={`cell-sem-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p>DAVVERO System Telemetry • Sincronização direta com Firestore</p>
        <p className="mt-1 sm:mt-0">
          Última atualização: {lastRefreshedAt.toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
