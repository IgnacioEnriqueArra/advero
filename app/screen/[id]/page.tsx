'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, Rocket, Cloud, Newspaper, Clock, Activity, Terminal } from 'lucide-react';

type MediaUpload = {
  id: string;
  file_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number;
  status: string;
  expires_at?: string;
  created_at?: string;
};

type VenueProfile = {
  venue_name: string;
  category: string;
  location: string;
};

export default function ScreenPage() {
  const { id } = useParams();
  const screenId = Array.isArray(id) ? id[0] : id;
  
  // State
  const [currentMedia, setCurrentMedia] = useState<MediaUpload | null>(null);
  const [playlist, setPlaylist] = useState<MediaUpload[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [venue, setVenue] = useState<VenueProfile | null>(null);
  const [screenDetails, setScreenDetails] = useState<{name: string} | null>(null);

  // Refs
  const playlistRef = useRef(playlist);
  const currentIndexRef = useRef(currentIndex);
  const isProcessingRef = useRef(isProcessing);
  
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Fetch Data
  useEffect(() => {
    if (!screenId) return;

    const fetchScreenDetails = async () => {
      try {
        const { data: screen } = await supabase
          .from('screens')
          .select('owner_id, name')
          .eq('id', screenId)
          .single();
        
        if (screen) {
          setScreenDetails({ name: screen.name });
          if (screen.owner_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('venue_name, category, location')
              .eq('id', screen.owner_id)
              .single();
            if (profile) setVenue(profile);
          }
        }
      } catch (err) {
        console.error('Error:', err);
      }
    };

    fetchScreenDetails();
  }, [screenId]);

  // Supabase Realtime Subscription (Replaces WebSocket)
  useEffect(() => {
    if (!screenId) return;

    console.log('🔌 Connecting to Supabase Realtime for Screen:', screenId);

    const channel = supabase
      .channel(`screen-${screenId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'media_uploads',
          filter: `screen_id=eq.${screenId}`
        },
        (payload) => {
          const newMedia = payload.new as MediaUpload;
          console.log('⚡ Realtime Update:', newMedia);

          // Only process PAID or APPROVED media
          if (newMedia.status !== 'paid' && newMedia.status !== 'active') return;

          // 1. PRELOAD IMMEDIATELY (Ultra-Fast)
          if (newMedia.media_type === 'image') {
            const img = new Image();
            img.src = newMedia.file_url;
          } else if (newMedia.media_type === 'video') {
             const vid = document.createElement('video');
             vid.preload = 'auto';
             vid.src = newMedia.file_url;
          }

          // 2. FORCE PLAYBACK START IF IDLE
          if (!currentMedia && !isProcessingRef.current) {
             console.log('🚀 Force starting playback from idle state');
             setCurrentMedia(newMedia);
             setIsProcessing(true);
          }

          setPlaylist(prev => {
             if (prev.some(p => p.id === newMedia.id)) return prev;
             const newPlaylist = [...prev, newMedia];
             playlistRef.current = newPlaylist; 
             return newPlaylist;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime Subscribed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screenId]);

  // Preload Helper
  const preloadMedia = (media: MediaUpload) => {
    if (media.media_type === 'image') {
      const img = new Image();
      img.src = media.file_url;
    } else if (media.media_type === 'video') {
       const vid = document.createElement('video');
       vid.preload = 'auto';
       vid.src = media.file_url;
       vid.load(); // Force load
    }
  };

  // Real-time Subscription & Sync (Robust & Consolidated)
  useEffect(() => {
    if (!screenId) return;

    const syncPlaylist = async () => {
      try {
        const now = new Date().toISOString();
        // Fetch ALL active ads (paid/playing) and filter expiration in JS to handle NULLs safely
        const { data } = await supabase
          .from('media_uploads')
          .select('*')
          .eq('screen_id', screenId)
          .in('status', ['paid', 'playing'])
           .order('created_at', { ascending: true });
        
          if (data) {
          // Filter valid ads (not expired)
          const validData = data.filter(m => !m.expires_at || new Date(m.expires_at) > new Date());

          // Update Playlist (Source of Truth)
          setPlaylist(prev => {
            // Only update if changed to avoid re-renders
            const isSame = prev.length === validData.length && prev.every((p, i) => p.id === validData[i].id);
            if (isSame) return prev;
            
            console.log('🔄 Playlist updated:', validData.length, 'items');
            
            // Preload new items
            validData.forEach(m => {
               if (!prev.some(p => p.id === m.id)) preloadMedia(m);
            });
            
            return validData;
          });
        }
      } catch (err) {
        console.error('Sync Error:', err);
      }
    };

    // Initial Sync
    syncPlaylist();

    // Safety Polling (Every 2s - User Request)
    const pollInterval = setInterval(() => {
       // console.log('🔄 Screen Sync Poll'); // Reduce noise
       syncPlaylist();
    }, 2000);

    // Realtime Subscription
    const channel = supabase.channel(`screen_sync_${screenId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'media_uploads', 
        filter: `screen_id=eq.${screenId}` 
      }, (payload) => {
        console.log('⚡ Realtime Update:', payload);
        syncPlaylist();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [screenId]);

  // Watch for Current Media Validity
  useEffect(() => {
    // Only check validity if it's a real ad from the playlist, not the promo
    if (currentMedia && currentMedia.status !== 'promo' && playlist.length > 0) {
       const stillValid = playlist.some(p => p.id === currentMedia.id);
       if (!stillValid) {
          console.warn('Current media removed from playlist, stopping...');
          // Optional: Finish current playback or stop immediately. 
          // User requested "sincronización en tiempo real", implying immediate reflection of deletion.
          setCurrentMedia(null);
          setIsProcessing(false);
       }
    }
  }, [playlist, currentMedia]);

  // Playback Logic
  useEffect(() => {
    if (playlist.length > 0 && !isProcessing) processPlaylist();
  }, [playlist, isProcessing]);

  const adsPlayedCountRef = useRef(0);
  // Removed useState sync to avoid re-renders causing loop interruptions
  // useEffect(() => { adsPlayedCountRef.current = adsPlayedCount; }, [adsPlayedCount]);

  const processPlaylist = async () => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);

    try {
      while (playlistRef.current.length > 0) {
        // INJECTION LOGIC: Every 3 ads, show AdVero Promo
        // Check if we just finished a set of 3
        if (adsPlayedCountRef.current > 0 && adsPlayedCountRef.current % 3 === 0) {
           console.log('📢 Injecting AdVero Promo');
           
           const promoMedia: MediaUpload = {
             id: 'advero-promo',
             file_url: '', 
             media_type: 'image', 
             duration_seconds: 10, // 10s Promo
             status: 'promo', 
             created_at: new Date().toISOString()
           };

           setCurrentMedia(promoMedia);
           
           // Wait for promo duration
           await new Promise(r => setTimeout(r, promoMedia.duration_seconds * 1000));
           
           adsPlayedCountRef.current += 1;
           // Transition directly to next ad without null state
           continue; 
        }

        let index = currentIndexRef.current;
        
        // Safety check: if index is out of bounds (e.g. playlist shrank), reset to 0
        if (index >= playlistRef.current.length) {
            index = 0;
            currentIndexRef.current = 0; // Immediate update
            setCurrentIndex(0);
        }

        const media = playlistRef.current[index];
        if (media.expires_at && new Date(media.expires_at) < new Date()) {
            setPlaylist(prev => prev.filter(m => m.id !== media.id));
            continue; 
        }

        // PRELOAD NEXT for smooth transition
        const nextIdx = (index + 1) % playlistRef.current.length;
        if (playlistRef.current[nextIdx]) {
            preloadMedia(playlistRef.current[nextIdx]);
        }

        console.log(`🎬 Playing [${index + 1}/${playlistRef.current.length}]:`, media.id);
        setCurrentMedia(media);
        
        if (media.status !== 'playing') {
            await supabase.from('media_uploads').update({ status: 'playing' }).eq('id', media.id);
        }

        const durationMs = Math.max((Number(media.duration_seconds) || 10) * 1000, 5000); // Min 5s
        const startTime = Date.now();
        
        await new Promise<void>(resolve => {
           const interval = setInterval(() => {
             const elapsed = Date.now() - startTime;
             // Ensure we check against isProcessingRef in case of forced stop
             if (!isProcessingRef.current) {
                 clearInterval(interval);
                 resolve();
                 return;
             }
             setProgress(Math.min((elapsed / durationMs) * 100, 100));
             if (elapsed >= durationMs) {
               clearInterval(interval);
               resolve();
             }
           }, 50);
        });
        
        // Double check before advancing
        if (!isProcessingRef.current) break;

        // Advance Index (Source of Truth)
        const nextIndex = (index + 1) % playlistRef.current.length;
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        
        adsPlayedCountRef.current += 1;
      }
    } catch (err) {
      console.error('Playback error:', err);
    } finally {
      setIsProcessing(false);
      setCurrentMedia(null);
      setProgress(0);
    }
  };

  const [uploadUrl, setUploadUrl] = useState('');
  const [hostOverride, setHostOverride] = useState<string | null>(null);
  const [weather, setWeather] = useState<{ temp: number; wind: number } | null>(null);
  const [news, setNews] = useState<{ title: string; url: string }[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [ctaIndex, setCtaIndex] = useState(0);
  const ctaMessages = [
    "Anuncia aquí ahora",
    "Sube tu video en 30s",
    "Toma el control de la pantalla"
  ];

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const ctaTimer = setInterval(() => setCtaIndex(prev => (prev + 1) % ctaMessages.length), 10000);
    return () => { clearInterval(timer); clearInterval(ctaTimer); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !screenId) return;
    const params = new URLSearchParams(window.location.search);
    const override = params.get('host');
    if (override) setHostOverride(override);
    const portPart = window.location.port ? `:${window.location.port}` : '';
    const host = override || window.location.hostname;
    const protocol = window.location.protocol;
    setUploadUrl(`${protocol}//${host}${portPart}/upload/${screenId}`);
  }, [screenId]);
  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const json = await res.json();
        if (json?.current_weather) {
          setWeather({ temp: json.current_weather.temperature, wind: json.current_weather.windspeed });
        }
      } catch {}
    };
    const fetchNews = async () => {
      try {
        const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page');
        const json = await res.json();
        const items = (json?.hits || []).slice(0, 5).map((it: any) => ({ title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${it.objectID}` }));
        setNews(items);
      } catch {}
    };
    if (typeof window !== 'undefined') {
      const fallback = () => fetchWeather(-34.6, -58.38);
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => fallback(),
          { enableHighAccuracy: false, timeout: 2000, maximumAge: 600000 }
        );
      } catch { fallback(); }
    }
    fetchNews();
  }, []);

  if (!screenId) return null;

  return (
    <div className="flex h-screen w-full bg-[#02040a] overflow-hidden relative font-sans text-white selection:bg-amber-500/30">
      
      {/* Background Ambience - Corporate/Premium */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-30%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-600/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay" />
      </div>

      {/* COMBINED DISPLAY STATE - HANDLES BOTH IDLE AND PLAYBACK */}
      <AnimatePresence mode="wait">
        {( !currentMedia || currentMedia.status === 'promo' ) ? (
          <motion.div 
            key="idle-promo"
            className="relative z-10 w-full h-full flex flex-col md:flex-row p-6 md:p-12 gap-8 md:gap-16 items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
             
             {/* Left: Value Proposition */}
             <div className="flex-1 flex flex-col justify-center items-start space-y-6 md:space-y-8 max-w-2xl">
                <div className="space-y-4">
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-widest"
                  >
                    <Zap className="w-3 h-3" />
                    Espacio Disponible
                  </motion.div>
                  
                  <motion.h1 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] text-white"
                  >
                    TU NEGOCIO <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600">
                      EN ESTA PANTALLA
                    </span> <br />
                    AHORA MISMO.
                  </motion.h1>
                  
                  <motion.p 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg md:text-2xl text-zinc-300 max-w-xl leading-relaxed font-normal"
                  >
                    Deja de perder clientes. 
                    <strong className="text-white font-bold"> Escanea, sube tu anuncio y vende más.</strong> Sin complicaciones.
                  </motion.p>
                </div>

                {/* Features / Trust - Repositioned & Larger */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col gap-4 pt-2"
                >
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <Zap className="w-6 h-6 fill-amber-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-lg leading-tight">Sin Apps ni Registros</span>
                        <span className="text-zinc-400 text-sm">Escanea y publica directo desde la web</span>
                      </div>
                   </div>

                   {/* Speed Feature - Minimalist Big Typography */}
                   <div className="mt-8">
                       <h3 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white leading-[1.1] tracking-tight">
                         Tu anuncio en vivo <br/>
                         en <span className="font-bold text-amber-500">menos de 60s.</span>
                       </h3>
                   </div>
                </motion.div>
             </div>

             {/* Right: Transaction Card */}
             <div className="flex-1 w-full max-w-md">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 50 }}
                  className="relative flex flex-col items-center justify-center"
                >
                  
                  <div className="flex flex-col items-center text-center">
                    
                    {/* QR Code with Extra Padding */}
                    <div className="relative bg-white p-6 rounded-3xl shadow-2xl mb-10 w-[420px] h-[420px] flex items-center justify-center overflow-hidden ring-4 ring-white/10 ring-offset-4 ring-offset-black">
                       {uploadUrl && <QRCodeSVG value={uploadUrl} className="w-full h-full relative z-10" level="H" />}
                       
                       {/* Scanning Animation - Subtler */}
                       <motion.div 
                         className="absolute top-0 left-0 w-full h-1 bg-amber-500/50 z-20"
                         animate={{ top: ["0%", "100%", "0%"] }}
                         transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                       />
                    </div>

                    <h2 className="text-5xl font-extrabold mb-4 text-white tracking-tight">ANUNCIA AQUÍ</h2>
                    <p className="text-zinc-400 text-2xl font-bold tracking-widest uppercase opacity-80 hover:opacity-100 transition-opacity pb-12">
                        WWW.ADVERO.COM
                    </p>

                  </div>
                </motion.div>
             </div>

          </motion.div>
        ) : (
          <motion.div 
            key={currentMedia.id}
            className="absolute inset-0 z-50 bg-black flex overflow-hidden items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* 1. Background Layer - Ambient Blur */}
            <div className="absolute inset-0 z-0">
               {currentMedia.media_type === 'video' ? (
                 <video src={currentMedia.file_url} autoPlay muted loop className="w-full h-full object-cover filter blur-[30px] brightness-[0.3] scale-110" />
               ) : (
                 <img src={currentMedia.file_url} className="w-full h-full object-cover filter blur-[30px] brightness-[0.3] scale-110" />
               )}
            </div>

            {/* 2. Main Layer - Optimized Fit (No Distractions) */}
            <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
               {currentMedia.media_type === 'video' ? (
                 <video 
                    src={currentMedia.file_url} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="max-w-full max-h-full w-auto h-auto object-contain shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg" 
                    onError={(e) => console.error('Video Error:', e)}
                 />
               ) : (
                 <img 
                    src={currentMedia.file_url} 
                    className="max-w-full max-h-full w-auto h-auto object-contain shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg" 
                    onError={(e) => console.error('Image Error:', e)}
                 />
               )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
