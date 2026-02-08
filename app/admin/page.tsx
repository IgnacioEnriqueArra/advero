'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Monitor, Image as ImageIcon, Settings, 
  Plus, Search, Bell, LogOut, DollarSign, 
  MapPin, PlayCircle, Loader2, Trash2, 
  BarChart3, User, Laptop2, Lock, Copy, Check, Clock, Activity,
  Filter, ArrowUpRight, ShieldCheck, AlertCircle, Zap,
  ChevronRight, MoreHorizontal, Calendar, CreditCard
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ActivityConsole from '@/app/components/ActivityConsole';
import { logger } from '@/lib/logger';

// --- Types ---
interface Profile {
  id: string;
  venue_name: string;
  full_name: string;
  location: string;
  category: string;
}

interface Screen {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive';
  created_at: string;
  total_revenue?: number;
}

interface MediaItem {
  id: string;
  file_url: string;
  media_type: 'image' | 'video';
  status: 'pending' | 'paid' | 'rejected' | 'playing' | 'played';
  duration_seconds: number;
  created_at: string;
  screen_id: string;
  screens?: { name: string };
  expires_at?: string;
  revenue?: number;
}

interface Transaction {
  amount: number;
  screen_id?: string;
  media_upload_id?: string;
  created_at: string;
  status?: string;
}

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-8 z-50 shadow-2xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition text-slate-400 hover:text-slate-900 dark:hover:text-white"><Plus className="w-6 h-6 rotate-45" /></button>
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const Card = ({ children, className = "", title, icon: Icon, action, headerColor = "bg-white" }: any) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl flex flex-col shadow-sm overflow-hidden ${className}`}>
    {(title || Icon) && (
      <div className={`${headerColor} px-6 py-4 flex justify-between items-center border-b border-slate-50 dark:border-zinc-800`}>
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-white/50 rounded-lg"><Icon className="w-5 h-5 text-slate-600 dark:text-zinc-400" /></div>}
          {title && <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider">{title}</h3>}
        </div>
        {action}
      </div>
    )}
    <div className="flex-1 flex flex-col p-6">{children}</div>
  </div>
);

const SimpleChart = ({ data, color = "emerald" }: { data: number[], color?: "emerald" | "indigo" | "rose" | "violet" }) => {
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  });

  const pathD = `M0,100 L0,${100 - ((data[0]-min)/range)*100} ` + 
    points.map((p, i) => i === 0 ? '' : `L${p}`).join(' ') + 
    ` L100,100 Z`;

  const linePath = `M0,${100 - ((data[0]-min)/range)*100} ` + 
    points.map((p, i) => i === 0 ? '' : `L${p}`).join(' ');

  const colors = {
    emerald: { stroke: '#000000', fill: '#facc15' }, // Yellow-400 fill, Black stroke
    indigo: { stroke: '#000000', fill: '#fef08a' }, // Yellow-200 fill
    rose: { stroke: '#000000', fill: '#fef9c3' }, // Yellow-100 fill
    violet: { stroke: '#000000', fill: '#eab308' }, // Yellow-500 fill
  };
  
  const c = colors[color];

  return (
    <div className="w-full h-16 mt-4 relative overflow-hidden rounded-xl">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <path d={pathD} fill={c.fill} stroke="none" />
        <path d={linePath} fill="none" stroke={c.stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, trend, subLabel, trendUp, chartData, colorStr = "blue", onClick }: any) => {
    const colorClasses: any = {
        emerald: "bg-yellow-400 text-black",
        blue: "bg-black text-white dark:bg-zinc-800",
        amber: "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white",
        rose: "bg-black text-white",
        violet: "bg-yellow-400 text-black",
    };
    
    return (
        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}>
                <Icon className={`w-24 h-24 text-black dark:text-white`} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${colorClasses[colorStr]}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">{label}</span>
                    </div>
                    {onClick && (
                        <button onClick={onClick} className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                            Retirar
                        </button>
                    )}
                </div>
                
                <div className="flex items-end gap-3">
                    <h3 className="text-3xl font-black text-black dark:text-white tracking-tight">{value}</h3>
                    {trend && (
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full mb-1 ${trendUp ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
                            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <Activity className="w-3 h-3" />} {trend}
                        </div>
                    )}
                </div>
                
                {chartData ? (
                    <SimpleChart data={chartData} color={colorStr} />
                ) : (
                    subLabel && <p className="text-sm text-zinc-400 mt-2 font-medium">{subLabel}</p>
                )}
            </div>
        </div>
    );
};

const MediaStatusBadge = ({ status, isExpired }: { status: string, isExpired: boolean }) => {
    const config = isExpired || status === 'played' 
        ? { color: 'slate', label: 'Finalizado', icon: Clock }
        : status === 'playing' ? { color: 'emerald', label: 'En Vivo', icon: Activity }
        : status === 'paid' ? { color: 'indigo', label: 'Aprobado', icon: ShieldCheck }
        : status === 'pending' ? { color: 'amber', label: 'Pendiente', icon: AlertCircle }
        : { color: 'rose', label: 'Rechazado', icon: Lock };

    const colors: Record<string, string> = {
        slate: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
        emerald: 'bg-yellow-400 text-black border-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.3)]',
        indigo: 'bg-black text-white border-black dark:bg-white dark:text-black',
        amber: 'bg-white text-yellow-600 border-yellow-400 border-dashed dark:bg-zinc-900',
        rose: 'bg-zinc-50 text-zinc-400 border-zinc-200 line-through decoration-zinc-400 dark:bg-zinc-900 dark:border-zinc-800',
    };

    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors[config.color]}`}>
            <Icon className="w-3.5 h-3.5" />
            {config.label}
        </span>
    );
};

const getLast7DaysRevenue = (mediaItems: MediaItem[]) => {
    const days = 7;
    const revenueByDay = new Array(days).fill(0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    mediaItems.forEach(item => {
        if (!item.revenue) return;
        const itemDate = new Date(item.created_at);
        itemDate.setHours(0,0,0,0);
        const diffTime = today.getTime() - itemDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < days) {
            revenueByDay[days - 1 - diffDays] += item.revenue;
        }
    });
    return revenueByDay;
};

export default function AdminDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Data State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, activeScreens: 0, pendingReview: 0 });
  const [revenueTrend, setRevenueTrend] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSynced, setIsSynced] = useState(true);  
  
  // UI State
  const [mediaFilter, setMediaFilter] = useState('all');
  
  // New Screen Form
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenLocation, setNewScreenLocation] = useState('');

  // Withdrawal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAlias, setWithdrawAlias] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const [prof, scr] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('screens').select('*').eq('owner_id', user.id)
        ]);

        if (prof.data) setProfile(prof.data);
        const screensData = scr.data || [];
        setScreens(screensData);

        // Fetch Media & Transactions
        const fetchMediaAndRevenue = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: currentScreens } = await supabase.from('screens').select('*').eq('owner_id', user.id);
          const activeScreensData = currentScreens || [];

          if (activeScreensData.length === 0) {
             setScreens([]);
             setStats({ revenue: 0, activeScreens: 0, pendingReview: 0 });
             return;
          }
          
          const { data: mData } = await supabase
            .from('media_uploads')
            .select('*, screens(name)')
            .in('screen_id', activeScreensData.map(s => s.id))
            .order('created_at', { ascending: false });
          
          const mediaItems = mData || [];

          try {
            const screenIds = activeScreensData.map(s => s.id);
            const { data: txData } = await supabase
                .from('transactions')
                .select('amount, screen_id, media_upload_id, created_at, status')
                .in('screen_id', screenIds)
                .in('status', ['succeeded', 'completed']);
            
            if (txData) {
               const sorted = [...txData].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
               setTransactions(sorted.slice(0, 50));
            }

            let totalRevenue = 0;
            const screenRevenueMap: Record<string, number> = {};
            const mediaRevenueMap: Record<string, number> = {};

            if (txData) {
                txData.forEach(tx => {
                    const amt = tx.amount || 0;
                    totalRevenue += amt;
                    if (tx.screen_id) screenRevenueMap[tx.screen_id] = (screenRevenueMap[tx.screen_id] || 0) + amt;
                    if (tx.media_upload_id) mediaRevenueMap[tx.media_upload_id] = (mediaRevenueMap[tx.media_upload_id] || 0) + amt;
                });
            }
            
            setMedia(mediaItems.map(m => ({ ...m, revenue: mediaRevenueMap[m.id] || 0 })));
            setScreens(activeScreensData.map(s => ({ ...s, total_revenue: screenRevenueMap[s.id] || 0 })));
            
            const mediaWithRevenue = mediaItems.map(m => ({ ...m, revenue: mediaRevenueMap[m.id] || 0 }));
            setRevenueTrend(getLast7DaysRevenue(mediaWithRevenue));

            setStats({
              revenue: totalRevenue,
              activeScreens: activeScreensData.filter(s => s.status === 'active').length,
              pendingReview: mediaItems.filter(m => m.status === 'pending').length
            });
          } catch (err) {
            console.warn('Revenue fetch error', err);
            setMedia(mediaItems);
          }
        };

        await fetchMediaAndRevenue();

        // --- REALTIME SUBSCRIPTIONS ---
        const channel = supabase.channel('admin_dashboard')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads' }, async () => {
             setIsSynced(false);
             await fetchMediaAndRevenue();
             setIsSynced(true);
             toast.info('Actualización recibida', { icon: <Activity className="w-4 h-4 text-blue-500" /> });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, async () => {
             setIsSynced(false);
             const { data: newScreens } = await supabase.from('screens').select('*').eq('owner_id', user.id);
             if (newScreens) {
                setScreens(newScreens);
                await fetchMediaAndRevenue();
             }
             setIsSynced(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
             setIsSynced(false);
             await fetchMediaAndRevenue();
             setIsSynced(true);
             toast.success('Nuevo ingreso registrado', { icon: <DollarSign className="w-4 h-4 text-emerald-500" /> });
          })
          .subscribe((status) => {
             if (status === 'SUBSCRIBED') setIsSynced(true);
             if (status === 'CHANNEL_ERROR') setIsSynced(false);
          });

        const pollingInterval = setInterval(async () => {
           console.log('🔄 Dashboard Safety Poll');
           await fetchMediaAndRevenue();
        }, 5000);

        return () => {
          supabase.removeChannel(channel);
          clearInterval(pollingInterval);
        };

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleCreateScreen = async () => {
    if (!newScreenName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('screens')
      .insert([{ 
        owner_id: user.id, 
        name: newScreenName, 
        location: newScreenLocation || profile?.location,
        status: 'active' 
      }])
      .select().single();
      
    if (data) {
      setScreens([data, ...screens]);
      setStats(prev => ({ ...prev, activeScreens: prev.activeScreens + 1 }));
      
      logger.log({ type: 'SYSTEM', event: 'SCREEN_REGISTERED', message: `Nueva pantalla: ${newScreenName}`, screen_id: data.id, owner_id: user.id });
      toast.success('Pantalla creada correctamente');
      setIsModalOpen(false);
      setNewScreenName('');
      setNewScreenLocation('');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAlias || !withdrawAmount) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    
    // Simulate withdrawal
    toast.loading('Procesando retiro...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.dismiss();
    toast.success(`Retiro de $${withdrawAmount} solicitado a ${withdrawAlias}`);
    setIsWithdrawModalOpen(false);
    setWithdrawAlias('');
    setWithdrawAmount('');
    
    logger.log({ type: 'INFO', event: 'WITHDRAWAL_REQUESTED', message: `Retiro de $${withdrawAmount} a ${withdrawAlias}`, metadata: { amount: withdrawAmount, alias: withdrawAlias } });
  };

  const handleMediaAction = async (id: string, action: string) => {
    setMedia(prev => prev.map(m => m.id === id ? { ...m, status: action as any } : m));
    setStats(prev => ({ ...prev, pendingReview: Math.max(0, prev.pendingReview - 1) }));
    
    logger.log({ type: 'INFO', event: `MEDIA_${action.toUpperCase()}`, message: `Solicitud ${action === 'paid' ? 'aprobada' : 'rechazada'}`, metadata: { media_id: id } });
    
    const promise = supabase.from('media_uploads').update({ status: action }).eq('id', id).then();
    
    toast.promise(
      promise as unknown as Promise<any>,
      { loading: 'Procesando...', success: action === 'paid' ? 'Solicitud aprobada' : 'Solicitud rechazada', error: 'Error al actualizar' }
    );
  };

  const handleDeleteMedia = async (id: string) => {
    if (!confirm('¿Eliminar definitivamente?')) return;
    setMedia(prev => prev.filter(m => m.id !== id));
    await supabase.from('media_uploads').delete().eq('id', id);
    toast.success('Eliminado');
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-zinc-500 text-sm font-mono animate-pulse">CARGANDO DASHBOARD...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-zinc-200 font-sans p-6 md:p-12">
      <Toaster theme="system" position="bottom-right" />
      
      <div className="max-w-6xl mx-auto space-y-10">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div>
              <h1 className="text-3xl font-black tracking-tight text-black dark:text-white mb-1">Panel de Control</h1>
              <p className="text-zinc-500 font-medium">{profile?.venue_name || 'Cargando...'} • {profile?.location || '...'}</p>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                 <p className="text-sm font-bold text-black dark:text-white">{profile?.full_name}</p>
                 <p className="text-xs text-zinc-500 font-medium">Propietario</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden ring-4 ring-zinc-50 dark:ring-zinc-900 shadow-sm">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.full_name}`} alt="Avatar" className="w-full h-full" />
              </div>
              <button onClick={() => router.push('/login')} className="p-3 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-500 shadow-sm border border-zinc-200 dark:border-zinc-800" title="Cerrar Sesión">
                 <LogOut className="w-5 h-5" />
              </button>
           </div>
        </header>

        {/* STATS ROW */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <StatCard label="Ingresos Totales" value={`$${stats.revenue}`} icon={DollarSign} trend="+12.5%" trendUp={true} chartData={revenueTrend} colorStr="emerald" onClick={() => setIsWithdrawModalOpen(true)} />
           <StatCard label="Pantallas Activas" value={stats.activeScreens} icon={Monitor} subLabel="Dispositivos conectados" colorStr="blue" />
           <StatCard label="Solicitudes Pendientes" value={stats.pendingReview} icon={Bell} subLabel="Requieren atención" colorStr="amber" />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-10">
              {/* SCREENS SECTION */}
        <section>
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-black dark:text-white">Mis Pantallas</h2>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-yellow-400 text-black px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-yellow-500 transition shadow-lg shadow-yellow-400/20 dark:shadow-none">
                 <Plus className="w-4 h-4" /> Nueva Pantalla
              </button>
           </div>
           
           <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Dispositivo</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Ubicación</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {screens.map(screen => (
                    <tr key={screen.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-black dark:bg-zinc-800 flex items-center justify-center text-white dark:text-white flex-shrink-0">
                             <Monitor className="w-5 h-5" />
                          </div>
                          <div>
                             <h3 className="font-bold text-sm text-black dark:text-white">{screen.name}</h3>
                             <p className="text-xs text-zinc-400 font-mono">ID: {screen.id.slice(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{screen.location}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${screen.status === 'active' ? 'bg-yellow-400 text-black border border-yellow-500' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${screen.status === 'active' ? 'bg-black' : 'bg-zinc-400'}`} />
                          {screen.status === 'active' ? 'En Línea' : 'Desconectado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a href={`/screen/${screen.id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-black hover:text-yellow-600 dark:text-white dark:hover:text-yellow-400 hover:underline">
                          Ver Pantalla <ArrowUpRight className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {screens.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                            <Monitor className="w-8 h-8" />
                        </div>
                        <p className="text-zinc-500 font-medium">No tienes pantallas registradas.</p>
                        <button onClick={() => setIsModalOpen(true)} className="mt-4 text-black dark:text-white font-bold hover:underline">Crear la primera</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
             </div>
           </div>
        </section>

        {/* MEDIA REQUESTS SECTION */}
        <section>
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-black dark:text-white">Solicitudes de Anuncios</h2>
              <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex gap-1">
                 {['all', 'pending', 'active'].map(f => (
                    <button key={f} onClick={() => setMediaFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${mediaFilter === f ? 'bg-black text-white shadow-md dark:bg-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                       {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Pendientes'}
                    </button>
                 ))}
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Media</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">Ingreso</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {media.filter(m => mediaFilter === 'all' ? true : mediaFilter === 'active' ? (m.status === 'playing' || m.status === 'paid') : m.status === mediaFilter).map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-100 dark:border-zinc-700">
                             {item.media_type === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400"><PlayCircle className="w-6 h-6" /></div>
                             ) : (
                                <img src={item.file_url} className="w-full h-full object-cover" />
                             )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black dark:text-white">Campaña {item.id.slice(0,6)}</p>
                            <p className="text-xs text-zinc-500 font-medium">{item.screens?.name} • {new Date(item.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <MediaStatusBadge status={item.status} isExpired={item.expires_at ? new Date(item.expires_at) < new Date() : false} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-black dark:text-white">${item.revenue || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.status === 'pending' ? (
                           <div className="flex justify-end gap-2">
                              <button onClick={() => handleMediaAction(item.id, 'paid')} className="p-2 rounded-xl bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 transition" title="Aprobar"><Check className="w-4 h-4" /></button>
                              <button onClick={() => handleMediaAction(item.id, 'rejected')} className="p-2 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 transition" title="Rechazar"><LogOut className="w-4 h-4" /></button>
                           </div>
                        ) : (
                           <button onClick={() => handleDeleteMedia(item.id)} className="text-zinc-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {media.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">No hay solicitudes para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
             </div>
           </div>
        </section>
           </div>

           <div className="lg:col-span-1">
              <Card title="Historial" icon={DollarSign} headerColor="bg-zinc-50 dark:bg-zinc-900/50" className="h-full">
                 <div className="flex flex-col h-full">
                    <div className="flex-1 space-y-6 overflow-y-auto pr-2 max-h-[600px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-300">
                       {transactions.map((tx, i) => (
                          <div key={i} className="flex items-center justify-between group p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-yellow-400 dark:bg-yellow-500 flex items-center justify-center text-black dark:text-black shadow-sm">
                                   <DollarSign className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="font-bold text-black dark:text-white text-sm">Pago Recibido</p>
                                   <p className="text-xs text-zinc-400 font-medium">{new Date(tx.created_at).toLocaleDateString()}</p>
                                </div>
                             </div>
                             <span className="font-black text-black dark:text-yellow-400 text-sm">+${tx.amount}</span>
                          </div>
                       ))}
                       {transactions.length === 0 && (
                          <div className="text-center py-12">
                             <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                                <DollarSign className="w-8 h-8" />
                             </div>
                             <p className="text-zinc-400 text-sm font-medium">Sin movimientos recientes.</p>
                          </div>
                       )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800">
                       <button className="w-full py-3 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 group">
                          Ver Todo el Historial <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-white dark:text-zinc-500 dark:group-hover:text-black transition" />
                       </button>
                    </div>
                 </div>
              </Card>
           </div>
        </div>

      </div>

      {/* MODAL (Reused) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Pantalla">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Nombre del Dispositivo</label>
              <input 
                value={newScreenName}
                onChange={(e) => setNewScreenName(e.target.value)}
                placeholder="Ej. Pantalla Principal"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Ubicación (Opcional)</label>
              <input 
                value={newScreenLocation}
                onChange={(e) => setNewScreenLocation(e.target.value)}
                placeholder="Ej. Entrada"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-white transition"
              />
            </div>
            <button 
              onClick={handleCreateScreen}
              disabled={!newScreenName.trim()}
              className="w-full py-3.5 bg-black text-white font-bold rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-zinc-200 dark:shadow-none"
            >
              Crear Pantalla
            </button>
          </div>
      </Modal>

      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Retirar Fondos">
         <div className="space-y-6">
            <div className="p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl flex items-start gap-3">
               <div className="p-2 bg-yellow-400 rounded-lg text-black"><DollarSign className="w-5 h-5" /></div>
               <div>
                  <h4 className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">Información de Retiro</h4>
                  <p className="text-xs text-yellow-700/80 dark:text-yellow-500/80 mt-1 leading-relaxed">
                     Los fondos serán transferidos a la cuenta asociada al alias proporcionado. El proceso puede tomar hasta 24 horas hábiles.
                  </p>
               </div>
            </div>

            <div>
               <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide text-xs">Alias de Transferencia</label>
               <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                  <input 
                     value={withdrawAlias}
                     onChange={(e) => setWithdrawAlias(e.target.value)}
                     placeholder="Ej. usuario@banco"
                     className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-white transition font-medium"
                  />
               </div>
            </div>

            <div>
               <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide text-xs">Monto a Retirar</label>
               <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 w-5 h-5 text-zinc-400" />
                  <input 
                     type="number"
                     value={withdrawAmount}
                     onChange={(e) => setWithdrawAmount(e.target.value)}
                     placeholder="0.00"
                     className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:focus:ring-white transition font-medium"
                  />
               </div>
               <p className="text-right text-xs text-zinc-400 mt-2 font-medium">Disponible: ${stats.revenue.toFixed(2)}</p>
            </div>

            <button 
               onClick={handleWithdraw}
               disabled={!withdrawAlias || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > stats.revenue}
               className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center gap-2"
            >
               <Check className="w-5 h-5" /> Confirmar Retiro
            </button>
         </div>
      </Modal>

    </div>
  );
}
