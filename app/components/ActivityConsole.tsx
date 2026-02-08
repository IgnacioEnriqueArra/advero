'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, AlertCircle, CheckCircle2, DollarSign, Info, Activity, Pause, Play, Trash2, ShieldAlert } from 'lucide-react';

interface LogEntry {
  id: string;
  created_at: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'REVENUE' | 'SYSTEM' | 'SECURITY';
  event: string;
  message: string;
  metadata?: any;
}

export default function ActivityConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'REVENUE' | 'SECURITY'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial Fetch
  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Console Fetch Error:', error);
        // Add a local system error log to visible console if DB fails
        setLogs(prev => [...prev, {
          id: 'sys-err',
          created_at: new Date().toISOString(),
          type: 'ERROR',
          event: 'CONSOLE_INIT_FAILED',
          message: 'Error connecting to logs table. Please run SQL migration.',
          metadata: error
        }]);
      }
      
      if (data) setLogs(data.reverse());
    };
    fetchLogs();
  }, []);

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('activity_logs_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          if (!isPaused) {
            setLogs((prev) => [...prev, payload.new as LogEntry].slice(-100)); // Keep last 100
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPaused]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const filteredLogs = logs.filter(l => filter === 'ALL' || l.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'ERROR': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'REVENUE': return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'SECURITY': return <ShieldAlert className="w-4 h-4 text-purple-500" />;
      case 'SYSTEM': return <Activity className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'ERROR': return 'text-red-400';
      case 'WARNING': return 'text-amber-400';
      case 'REVENUE': return 'text-emerald-400';
      case 'SECURITY': return 'text-purple-400';
      default: return 'text-zinc-300';
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#0c0c0e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black rounded-lg border border-white/10">
            <Terminal className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">System Console</h3>
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] text-zinc-500">Live Stream</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'ERROR', 'REVENUE', 'SECURITY'].map((f) => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                 filter === f 
                   ? 'bg-white text-black' 
                   : 'bg-black text-zinc-500 hover:text-white border border-white/5'
               }`}
             >
               {f}
             </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-2" />
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-400 hover:text-white'}`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setLogs([])}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="group flex items-start gap-3 py-1.5 hover:bg-white/[0.02] px-2 rounded transition-colors"
            >
              <span className="text-zinc-600 text-[10px] shrink-0 pt-0.5">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
              <div className={`shrink-0 pt-0.5 ${getColor(log.type)}`}>
                 {log.type === 'REVENUE' ? '$' : log.type === 'SECURITY' ? '!' : '>'}
              </div>
              <div className="min-w-0 flex-1 break-all">
                <span className={`font-bold mr-2 ${getColor(log.type)}`}>[{log.type}]</span>
                <span className="text-zinc-400 mr-2">{log.event}:</span>
                <span className="text-zinc-300">{log.message}</span>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <span className="text-zinc-600 ml-2 text-[10px] hidden group-hover:inline">
                    {JSON.stringify(log.metadata)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
          {filteredLogs.length === 0 && (
             <div className="text-zinc-700 text-center py-10 italic">Waiting for events...</div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
