import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, getDocs, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, appId } from "../lib/firebase";
import { getFullTelemetryData, TelemetryStats } from "../lib/telemetry";
import { useSettings } from "../context/SettingsContext";
import DavveroLogo from "./DavveroLogo";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  Users, Calendar, Activity, Loader2, TrendingUp, UserCheck, Shield, Printer,
  QrCode, Eye, Database, Radio, RefreshCw, Smartphone, Laptop, CheckCircle2,
  Clock, Award, Bell, Car, Server, ArrowUpRight, Sparkles, BookOpen, ShieldCheck,
  CheckCheck, Globe, MapPin, Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#ef4444'];
const SCAN_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];
const DEVICE_COLORS = ['#10b981', '#0ea5e9', '#6366f1'];
const FORMAT_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6'];

// Global in-memory cache to prevent Firebase quota burnout
interface DashboardCache {
  timestamp: number;
  eventsStats: {
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    eventHoursMap: Record<string, number>;
    formats: { name: string; value: number }[];
    dateCounts: Record<string, number>;
  };
  attendanceStats: {
    totalAttendances: number;
    validPresentCount: number;
    totalAccumulatedHours: number;
    attendanceRate: number;
    dateCounts: Record<string, number>;
  };
  pushDevicesCount: number;
  notificationsCount: number;
  dobloCount: number;
  telemetry: TelemetryStats;
}

let globalDashboardCache: DashboardCache | null = null;

export default function DashboardPanel({ allMembers }: { allMembers: any[] }) {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(!globalDashboardCache);
  const [refreshing, setRefreshing] = useState(false);
  // Default autoRefresh to false to protect Firebase Firestore read quota
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(
    globalDashboardCache ? new Date(globalDashboardCache.timestamp) : new Date()
  );
  const [activeRange, setActiveRange] = useState<"7d" | "14d" | "all">("14d");

  const [telemetry, setTelemetry] = useState<TelemetryStats | null>(
    globalDashboardCache ? globalDashboardCache.telemetry : null
  );

  const [dbData, setDbData] = useState<{
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    eventFormats: { name: string; value: number }[];
    totalAttendances: number;
    validPresentCount: number;
    totalAccumulatedHours: number;
    attendanceRate: number;
    totalPushDevices: number;
    totalNotifications: number;
    totalDobloLogs: number;
    eventDateCounts: Record<string, number>;
    attendanceDateCounts: Record<string, number>;
  } | null>(() => {
    if (!globalDashboardCache) return null;
    return {
      totalEvents: globalDashboardCache.eventsStats.totalEvents,
      activeEvents: globalDashboardCache.eventsStats.activeEvents,
      completedEvents: globalDashboardCache.eventsStats.completedEvents,
      eventFormats: globalDashboardCache.eventsStats.formats,
      totalAttendances: globalDashboardCache.attendanceStats.totalAttendances,
      validPresentCount: globalDashboardCache.attendanceStats.validPresentCount,
      totalAccumulatedHours: globalDashboardCache.attendanceStats.totalAccumulatedHours,
      attendanceRate: globalDashboardCache.attendanceStats.attendanceRate,
      totalPushDevices: globalDashboardCache.pushDevicesCount,
      totalNotifications: globalDashboardCache.notificationsCount,
      totalDobloLogs: globalDashboardCache.dobloCount,
      eventDateCounts: globalDashboardCache.eventsStats.dateCounts,
      attendanceDateCounts: globalDashboardCache.attendanceStats.dateCounts,
    };
  });

  // 1. Process allMembers data in-memory via useMemo (Zero Firestore reads!)
  const memberMetrics = useMemo(() => {
    let total = 0;
    let active = 0;
    let inactive = 0;
    const roleCounts: Record<string, number> = {};
    const seminaryCounts: Record<string, number> = {};
    const dioceseCounts: Record<string, number> = {};
    const memberDateCounts: Record<string, number> = {};

    (allMembers || []).forEach((data) => {
      if (data.isTrash || data.deletedAt) return;

      total++;
      if (data.isActive !== false) {
        active++;
      } else {
        inactive++;
      }

      if (data.roles && Array.isArray(data.roles)) {
        data.roles.forEach((r: string) => {
          if (r) roleCounts[r] = (roleCounts[r] || 0) + 1;
        });
      }

      if (data.seminary && typeof data.seminary === "string" && data.seminary.trim()) {
        const sem = data.seminary.trim();
        seminaryCounts[sem] = (seminaryCounts[sem] || 0) + 1;
      }

      if (data.diocese && typeof data.diocese === "string" && data.diocese.trim()) {
        const dio = data.diocese.trim();
        dioceseCounts[dio] = (dioceseCounts[dio] || 0) + 1;
      }

      let dateAdded = "Desconhecido";
      if (data.createdAt) {
        try {
          if (data.createdAt?.toDate && typeof data.createdAt.toDate === "function") {
            dateAdded = data.createdAt.toDate().toISOString().split("T")[0];
          } else if (data.createdAt?.seconds) {
            dateAdded = new Date(data.createdAt.seconds * 1000).toISOString().split("T")[0];
          } else if (typeof data.createdAt === "string" || typeof data.createdAt === "number") {
            dateAdded = new Date(data.createdAt).toISOString().split("T")[0];
          }
        } catch (err) {}
      }
      if (dateAdded !== "Desconhecido") {
        memberDateCounts[dateAdded] = (memberDateCounts[dateAdded] || 0) + 1;
      }
    });

    const rolesDistribution = Object.entries(roleCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const seminaryDistribution = Object.entries(seminaryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const dioceseDistribution = Object.entries(dioceseCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalMembers: total,
      activeMembers: active,
      inactiveMembers: inactive,
      rolesDistribution,
      seminaryDistribution,
      dioceseDistribution,
      memberDateCounts,
    };
  }, [allMembers]);

  // 2. Fetch server-side metrics with intelligent 2-minute in-memory caching
  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);

      // Check if cache is fresh (< 2 minutes old) and not a manual user click
      const nowMs = Date.now();
      if (!isManual && globalDashboardCache && nowMs - globalDashboardCache.timestamp < 120000) {
        setDbData({
          totalEvents: globalDashboardCache.eventsStats.totalEvents,
          activeEvents: globalDashboardCache.eventsStats.activeEvents,
          completedEvents: globalDashboardCache.eventsStats.completedEvents,
          eventFormats: globalDashboardCache.eventsStats.formats,
          totalAttendances: globalDashboardCache.attendanceStats.totalAttendances,
          validPresentCount: globalDashboardCache.attendanceStats.validPresentCount,
          totalAccumulatedHours: globalDashboardCache.attendanceStats.totalAccumulatedHours,
          attendanceRate: globalDashboardCache.attendanceStats.attendanceRate,
          totalPushDevices: globalDashboardCache.pushDevicesCount,
          totalNotifications: globalDashboardCache.notificationsCount,
          totalDobloLogs: globalDashboardCache.dobloCount,
          eventDateCounts: globalDashboardCache.eventsStats.dateCounts,
          attendanceDateCounts: globalDashboardCache.attendanceStats.dateCounts,
        });
        setTelemetry(globalDashboardCache.telemetry);
        setLastRefreshedAt(new Date(globalDashboardCache.timestamp));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fetch events
      const eventsQuery = query(collection(db, `artifacts/${appId}/public/data/events`));
      const eventsSnapshot = await getDocs(eventsQuery);
      let totalEvts = 0;
      let activeEvts = 0;
      let completedEvts = 0;
      const eventHoursMap: Record<string, number> = {};
      const formatCounts: Record<string, number> = {
        "Presencial": 0,
        "Online": 0,
        "Híbrido": 0
      };
      const eventDateCounts: Record<string, number> = {};

      eventsSnapshot.forEach((doc) => {
        totalEvts++;
        const data = doc.data();
        if (data.status === "closed" || data.status === "cancelled" || data.status === "concluido") {
          completedEvts++;
        } else {
          activeEvts++;
        }

        const formatRaw = String(data.format || "presencial").toLowerCase();
        if (formatRaw.includes("online") || formatRaw.includes("remoto") || formatRaw.includes("ead")) {
          formatCounts["Online"] = (formatCounts["Online"] || 0) + 1;
        } else if (formatRaw.includes("hibrid") || formatRaw.includes("híbrid")) {
          formatCounts["Híbrido"] = (formatCounts["Híbrido"] || 0) + 1;
        } else {
          formatCounts["Presencial"] = (formatCounts["Presencial"] || 0) + 1;
        }

        const rawHours = data.workloadHours || data.workload || data.hours || 0;
        const parsedH = parseFloat(String(rawHours).replace(",", ".")) || 0;
        if (parsedH > 0) {
          eventHoursMap[doc.id] = parsedH;
        }

        let d = "Desconhecido";
        if (data.createdAt) {
          try {
            if (data.createdAt?.toDate && typeof data.createdAt.toDate === "function") {
              d = data.createdAt.toDate().toISOString().split("T")[0];
            } else if (data.createdAt?.seconds) {
              d = new Date(data.createdAt.seconds * 1000).toISOString().split("T")[0];
            } else if (typeof data.createdAt === "string" || typeof data.createdAt === "number") {
              d = new Date(data.createdAt).toISOString().split("T")[0];
            }
          } catch (err) {}
        }
        if (d !== "Desconhecido") {
          eventDateCounts[d] = (eventDateCounts[d] || 0) + 1;
        }
      });

      const eventFormats = Object.entries(formatCounts)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0);

      // Fetch attendances & accurate check-in counts
      let totalAttendancesCount = 0;
      let validPresentCount = 0;
      let totalAccumulatedHours = 0;
      const attendanceDateCounts: Record<string, number> = {};

      try {
        const attSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/attendances`));
        attSnap.forEach((doc) => {
          const data = doc.data();
          if (data.status === "cancelado") return;

          totalAttendancesCount++;

          // Accurately detect presence and certificates across all status standards
          const isPresent = 
            data.status === "presente" || 
            data.status === "apto_para_certificado" || 
            data.status === "present" || 
            data.status === "confirmed" || 
            data.checkedIn === true || 
            Boolean(data.checkInTime) || 
            Boolean(data.digitalSignatureProtocol);

          if (isPresent) {
            validPresentCount++;
            if (data.eventId && eventHoursMap[data.eventId]) {
              totalAccumulatedHours += eventHoursMap[data.eventId];
            } else if (data.hours) {
              const h = parseFloat(String(data.hours).replace(",", ".")) || 0;
              totalAccumulatedHours += h;
            }
          }

          let d = "Desconhecido";
          const rawDate = data.createdAt || data.checkInTime || data.timestamp;
          if (rawDate) {
            try {
              if (rawDate?.toDate && typeof rawDate.toDate === "function") {
                d = rawDate.toDate().toISOString().split("T")[0];
              } else if (rawDate?.seconds) {
                d = new Date(rawDate.seconds * 1000).toISOString().split("T")[0];
              } else if (typeof rawDate === "string" || typeof rawDate === "number") {
                d = new Date(rawDate).toISOString().split("T")[0];
              }
            } catch (err) {}
          }
          if (d !== "Desconhecido") {
            attendanceDateCounts[d] = (attendanceDateCounts[d] || 0) + 1;
          }
        });
      } catch (e) {
        console.warn("[Dashboard] Error fetching attendances:", e);
      }

      const attendanceRate = totalAttendancesCount > 0 
        ? Math.round((validPresentCount / totalAttendancesCount) * 100) 
        : 0;

      // Fetch push subscriptions
      let pushDevicesCount = 0;
      try {
        const [pushSnap, fcmSnap] = await Promise.all([
          getDocs(collection(db, "push_subscriptions")).catch(() => null),
          getDocs(collection(db, "fcm_tokens")).catch(() => null),
        ]);
        const endpoints = new Set<string>();
        if (pushSnap) {
          pushSnap.docs.forEach(d => {
            const data = d.data();
            if (data.endpoint) endpoints.add(data.endpoint);
          });
        }
        if (fcmSnap) {
          fcmSnap.docs.forEach(d => {
            const data = d.data();
            if (data.endpoint) endpoints.add(data.endpoint);
            else if (data.token) endpoints.add(data.token);
          });
        }
        pushDevicesCount = Math.max(endpoints.size, pushSnap?.size || 0);
      } catch (e) {}

      // Fetch notifications count
      let notificationsCount = 0;
      try {
        const notifSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/notifications`));
        notificationsCount = notifSnap.size;
      } catch (e) {}

      // Fetch doblo logs count
      let dobloCount = 0;
      try {
        const dobloSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/doblo_logs`));
        dobloCount = dobloSnap.size;
      } catch (e) {}

      // Fetch telemetry stats (passing known attendance count to save Firebase reads)
      const teleData = await getFullTelemetryData(
        memberMetrics.totalMembers, 
        totalEvts, 
        validPresentCount,
        totalAttendancesCount
      );

      // Save to global cache
      globalDashboardCache = {
        timestamp: Date.now(),
        eventsStats: {
          totalEvents: totalEvts,
          activeEvents: activeEvts,
          completedEvents: completedEvts,
          eventHoursMap,
          formats: eventFormats,
          dateCounts: eventDateCounts,
        },
        attendanceStats: {
          totalAttendances: totalAttendancesCount,
          validPresentCount,
          totalAccumulatedHours,
          attendanceRate,
          dateCounts: attendanceDateCounts,
        },
        pushDevicesCount,
        notificationsCount,
        dobloCount,
        telemetry: teleData,
      };

      setDbData({
        totalEvents: totalEvts,
        activeEvents: activeEvts,
        completedEvents: completedEvts,
        eventFormats,
        totalAttendances: totalAttendancesCount,
        validPresentCount,
        totalAccumulatedHours,
        attendanceRate,
        totalPushDevices: pushDevicesCount,
        totalNotifications: notificationsCount,
        totalDobloLogs: dobloCount,
        eventDateCounts,
        attendanceDateCounts,
      });

      setTelemetry(teleData);
      setLastRefreshedAt(new Date());

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberMetrics.totalMembers]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh interval (every 180s / 3 minutes when explicitly enabled by user)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 180000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Realtime listener for online presence (listening on presence doesn't cause repeated full collection scans)
  useEffect(() => {
    try {
      const presenceQuery = query(
        collection(db, `artifacts/${appId}/public/data/online_presence`),
        limit(50)
      );
      const unsubscribe = onSnapshot(presenceQuery, (snap) => {
        const now = Date.now();
        let online = 0;
        snap.forEach((d) => {
          const data = d.data();
          if (data.lastActive) {
            const diff = now - new Date(data.lastActive).getTime();
            if (diff < 120 * 1000) online++;
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

  if (!dbData || !telemetry) return null;

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
      {/* Printable Header - Visible only when printing */}
      <div className="hidden print:flex items-center justify-between mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 p-1.5 border border-slate-800 overflow-hidden">
            <DavveroLogo
              src={settings.instLogo}
              color="#ffffff"
              className="w-full h-full object-contain"
              iconClassName="w-full h-full text-white"
            />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black uppercase tracking-wider text-black">Relatório Geral de Telemetria & Painel</h1>
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{settings.instName ? `${settings.instName.toUpperCase()} • AUDITORIA & MÉTRICAS EM TEMPO REAL` : "DAVVERO SYSTEM • AUDITORIA & MÉTRICAS EM TEMPO REAL"}</p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold text-black">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          <p className="text-[11px] text-slate-600 italic">DAVVERO System Analytics</p>
        </div>
      </div>

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

      {/* Quota & Optimization Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs shadow-sm">
        <div className="flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200 font-semibold">
          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span>
            <strong>Otimizador de Quota Firebase Ativo:</strong> Consultas utilizam cache inteligente de 2 minutos e agregação em memória para economizar leituras do plano gratuito.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Cache Seguro
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>{autoRefresh ? "Sync 3 min" : "Atualização Manual"}</span>
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

      {/* --- CARDS DE OPERAÇÃO GERAL (Membros, Eventos, Presenças, Certificados, Push, Doblò) --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Cadastros */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Cadastros</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{memberMetrics.totalMembers}</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {memberMetrics.activeMembers} ativos ({memberMetrics.totalMembers > 0 ? Math.round((memberMetrics.activeMembers / memberMetrics.totalMembers) * 100) : 0}%)
            </p>
            {memberMetrics.inactiveMembers > 0 && (
              <p className="text-[9px] text-slate-400 mt-0.5">
                {memberMetrics.inactiveMembers} inativos
              </p>
            )}
          </div>
        </div>

        {/* Eventos Criados */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Eventos</span>
            <Calendar className="w-4 h-4 text-fuchsia-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{dbData.totalEvents}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {dbData.activeEvents} ativos • {dbData.completedEvents} concluídos
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
            <p className="text-2xl font-black text-slate-800 dark:text-white">{dbData.totalAttendances}</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {dbData.attendanceRate}% taxa ({dbData.validPresentCount} validadas)
            </p>
          </div>
        </div>

        {/* Certificados & Horas Acadêmicas */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Certificados</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{dbData.validPresentCount}</p>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {dbData.totalAccumulatedHours}h complementares
            </p>
          </div>
        </div>

        {/* Dispositivos Push & Notificações */}
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-700/50 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Push & Alertas</span>
            <Bell className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 dark:text-white">{dbData.totalPushDevices}</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {dbData.totalNotifications > 0 ? `${dbData.totalNotifications} disparos efetuados` : 'Aparelhos conectados'}
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
            <p className="text-2xl font-black text-slate-800 dark:text-white">{dbData.totalDobloLogs}</p>
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

      {/* --- DISTRIBUIÇÃO INSTITUCIONAL (Cargos, Dioceses, Seminários e Modalidades) --- */}
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
            {memberMetrics.rolesDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberMetrics.rolesDistribution.slice(0, 8)} margin={{ top: 10, right: 30, left: -10, bottom: 25 }}>
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Nenhum cargo registrado nos cadastros.
              </div>
            )}
          </div>
        </motion.div>

        {/* Distribuição por Diocese */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.52 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Distribuição por Diocese</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Top dioceses de origem</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            {memberMetrics.dioceseDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberMetrics.dioceseDistribution.slice(0, 8)} margin={{ top: 10, right: 30, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={45} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" name="Membros" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Nenhuma diocese especificada nos membros cadastrados.
              </div>
            )}
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
            {memberMetrics.seminaryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={memberMetrics.seminaryDistribution}
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
                    {memberMetrics.seminaryDistribution.map((entry, index) => (
                      <Cell key={`cell-sem-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Nenhum seminário/casa de formação registrado.
              </div>
            )}
          </div>
        </motion.div>

        {/* Modalidades de Eventos (Presencial vs Online vs Híbrido) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.58 }}
          className="bg-white dark:bg-slate-800/40 rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-700/50">
            <div className="bg-purple-100 dark:bg-purple-500/20 p-2 rounded-xl text-purple-600 dark:text-purple-400">
               <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-sm md:text-base">Modalidades de Eventos</h3>
              <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Presencial / Online / Híbrido</p>
            </div>
          </div>
          <div className="h-[260px] w-full">
            {dbData.eventFormats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dbData.eventFormats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
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
                    {dbData.eventFormats.map((entry, index) => (
                      <Cell key={`cell-fmt-${index}`} fill={FORMAT_COLORS[index % FORMAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Nenhum evento registrado ainda.
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p>DAVVERO System Telemetry • Sincronização direta com Firestore (Otimizada)</p>
        <p className="mt-1 sm:mt-0">
          Última atualização: {lastRefreshedAt.toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
