'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, Image as ImageIcon, Video as VideoIcon, Loader2, X, MapPin, ShieldAlert } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import { calculateAdPrice, formatPrice } from '@/lib/pricing';

export default function UploadPage() {
  const params = useParams();
  const screenId = Array.isArray(params.screen_id) ? params.screen_id[0] : params.screen_id;
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Model State
  const [model, setModel] = useState<nsfwjs.NSFWJS | null>(null);

  // Load Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const _model = await nsfwjs.load();
        setModel(_model);
        console.log('NSFW Model Loaded');
      } catch (err) {
        console.error('Failed to load NSFW model:', err);
      }
    };
    loadModel();
  }, []);

  // Config State
  const [days, setDays] = useState(1);
  const [duration, setDuration] = useState(10);

  // Fetch Venue Info
  useEffect(() => {
    if (!screenId) return;
    const fetchVenue = async () => {
      const { data: screen } = await supabase.from('screens').select('owner_id').eq('id', screenId).single();
      if (screen?.owner_id) {
        const { data: profile } = await supabase.from('profiles').select('venue_name').eq('id', screen.owner_id).single();
        if (profile) setVenueName(profile.venue_name);
      }
    };
    fetchVenue();
  }, [screenId]);

  const analyzeImage = async (imgElement: HTMLImageElement) => {
    if (!model) {
       toast.error('El sistema de seguridad IA se está iniciando. Por favor espera unos segundos.');
       return false; // Fail closed
    }
    
    setIsAnalyzing(true);
    try {
      const predictions = await model.classify(imgElement);
      setIsAnalyzing(false);
      console.log('AI Analysis:', predictions);

      // Filter: Block if Porn or Hentai probability is high
      // Porn/Hentai: > 10% (Extremely strict)
      // Sexy: > 40% (Strict for suggestive content)
      const unsafe = predictions.find(p => 
        (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && 
        ((p.className === 'Sexy' && p.probability > 0.40) || 
         ((p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.10))
      );

      if (unsafe) {
        console.warn('NSFW Detected:', unsafe);
        logger.log({
          type: 'SECURITY',
          event: 'NSFW_BLOCKED',
          message: `Contenido bloqueado por IA: ${unsafe.className} (${(unsafe.probability * 100).toFixed(1)}%)`,
          metadata: { prediction: unsafe },
          screen_id: screenId
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Analysis error:', err);
      setIsAnalyzing(false);
      toast.error('Error al analizar la imagen. Intenta con otra.');
      return false; // Fail closed on error
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Basic validation
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('El archivo es demasiado grande (máx 50MB)');
        return;
      }

      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);

      // Analyze immediately if it's an image
      if (selectedFile.type.startsWith('image/')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = async () => {
          const isSafe = await analyzeImage(img);
          if (!isSafe) {
            toast.error('Contenido inapropiado detectado. Por favor sube una imagen apta para todo público.');
            setFile(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          } else {
            toast.success('Contenido verificado: Apto', { icon: <ShieldAlert className="w-4 h-4 text-green-500" /> });
          }
        };
      }
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAndPay = async () => {
    if (!file || !screenId) return;

    setUploading(true);
    const toastId = toast.loading('Subiendo contenido...');

    try {
      // 1. Upload File
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${screenId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // 2. Create Record (Simulating Payment)
      const mediaType = file.type.startsWith('video') ? 'video' : 'image';
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const { data: mediaData, error: dbError } = await supabase
        .from('media_uploads')
        .insert([
          {
            screen_id: screenId,
            file_url: publicUrl,
            media_type: mediaType,
            status: 'paid', // Simulate instant payment success
            duration_seconds: duration,
            expires_at: expiresAt.toISOString(),
          },
        ])
        .select()
        .single();

      if (dbError) {
        console.error('DB Error:', dbError);
        throw new Error(`Error de base de datos: ${dbError.message} (${dbError.details || 'Revisa los permisos/RLS'})`);
      }

      // Log Transaction & Event
      const amount = calculateAdPrice(days, duration);
      
      // Helper for robust insert with retries
      const robustInsertTransaction = async (retries = 3) => {
         // 1. Safety Check: Verify if transaction already exists
         const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('media_upload_id', mediaData.id)
            .in('status', ['succeeded', 'completed'])
            .maybeSingle();
            
         if (existing) {
             console.log('Transaction already exists for this media. Skipping duplicate.');
             return true;
         }

         for (let i = 0; i < retries; i++) {
            const { error } = await supabase.from('transactions').insert([{
                screen_id: screenId,
                media_upload_id: mediaData.id,
                amount: amount,
                currency: 'USD',
                status: 'succeeded',
                owner_commission: amount * 0.7,
                platform_commission: amount * 0.3,
                created_at: new Date().toISOString()
            }]);
            
            if (!error) return true;
            console.warn(`Transaction attempt ${i+1} failed:`, error);
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
         }
         return false;
      };

      const txSuccess = await robustInsertTransaction();
      
      if (!txSuccess) {
         // Critical Error: Media created but payment record failed
         // In a real app, we might want to refund or flag for manual review
         logger.log({
            type: 'ERROR',
            event: 'TX_CREATION_FAILED_FINAL',
            message: 'Error fatal: No se pudo registrar la transacción después de 3 intentos',
            metadata: { mediaId: mediaData.id, amount },
            screen_id: screenId
         });
         toast.error('Error registrando el pago. Contacte a soporte.');
      } else {
         // Log Success
          logger.log({
            type: 'REVENUE',
            event: 'PAYMENT_RECEIVED',
            message: `Pago exitoso: $${formatPrice(amount)}`,
            metadata: { amount, mediaId: mediaData.id, days, duration },
            screen_id: screenId
          });
          
          // WS Notify removed - Supabase Realtime handles this automatically via database triggers
          console.log('✅ Content uploaded and transaction recorded. Realtime subscribers will be notified automatically.');
      }
        
      // Cleanup removed
      
      toast.dismiss(toastId);
      setIsSuccess(true);
      toast.success('¡Publicidad activa!', { icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> });
      
      // Reset after delay
      setTimeout(() => {
        setIsSuccess(false);
        setFile(null);
        setPreviewUrl(null);
        setUploading(false);
      }, 3000);

    } catch (error: any) {
      console.error('Error:', error);
      toast.dismiss(toastId);
      toast.error('Hubo un error al subir el contenido: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-green-500/20 p-8 rounded-full mb-6"
        >
          <CheckCircle2 className="w-24 h-24 text-green-500" />
        </motion.div>
        
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold mb-2"
        >
          ¡Listo!
        </motion.h2>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 max-w-xs mx-auto mb-8"
        >
          Tu contenido aparecerá en la pantalla de <span className="text-white font-bold">{venueName || 'AdVero'}</span> en unos segundos.
        </motion.p>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => {
             setIsSuccess(false);
             clearFile();
          }}
          className="w-full max-w-sm bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition active:scale-95"
        >
          Subir otro
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-4 md:p-6 font-sans">
      <Toaster theme="dark" position="top-center" />
      
      <header className="flex items-center justify-between mb-8 pt-2">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
             <span className="font-bold text-white text-xs">AV</span>
           </div>
           <div>
             <span className="font-bold text-lg tracking-tight block leading-none">AdVero</span>
             {venueName && <span className="text-xs text-gray-400 block leading-none mt-0.5">en {venueName}</span>}
           </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Sube tu contenido</h1>
        <p className="text-gray-400 mb-8">
          Comparte tu foto o video en la pantalla de <span className="text-white font-medium">{venueName || 'este local'}</span>.
        </p>

        <div className="flex-1 flex flex-col gap-6">
          
          {/* File Selector Area */}
          <div className="relative">
            {!file ? (
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 hover:border-blue-500/50 transition-all cursor-pointer group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="mb-2 text-sm text-gray-300 font-medium">Toca para seleccionar</p>
                  <p className="text-xs text-gray-500">JPG, PNG o MP4 (max 50MB)</p>
                </div>
                <input 
                  id="file-upload" 
                  type="file" 
                  accept="image/*,video/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </label>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full h-64 bg-gray-900 rounded-2xl overflow-hidden border border-gray-800"
              >
                {isAnalyzing && (
                  <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                     <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
                     <p className="text-sm font-medium">Analizando contenido con IA...</p>
                  </div>
                )}

                {file.type.startsWith('video') ? (
                  <video src={previewUrl!} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
                )}
                
                <button 
                  onClick={clearFile}
                  className="absolute top-3 right-3 p-2 bg-black/50 backdrop-blur rounded-full text-white hover:bg-black/70 transition"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg flex items-center gap-2">
                   {file.type.startsWith('video') ? <VideoIcon className="w-4 h-4 text-blue-400" /> : <ImageIcon className="w-4 h-4 text-green-400" />}
                   <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Configuration & Pricing */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 space-y-4">
             {/* Days Selection */}
             <div>
               <label className="text-gray-400 text-sm mb-2 block">Días de campaña</label>
               <div className="flex gap-2">
                  {[1, 3, 7].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        days === d 
                          ? 'bg-white text-black border-white' 
                          : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      {d} {d === 1 ? 'Día' : 'Días'}
                    </button>
                  ))}
               </div>
             </div>

             {/* Duration per pass Selection */}
             <div>
                <label className="text-gray-400 text-sm mb-2 block">Duración por pase (segundos)</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5s</span>
                  <span className="text-white font-bold">{duration}s</span>
                  <span>30s</span>
                </div>
             </div>
             
             {/* Total Price */}
             <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
                <span className="text-gray-300">Total a pagar</span>
                <span className="text-xl font-bold text-white">{formatPrice(calculateAdPrice(days, duration))}</span>
             </div>
          </div>

        </div>

        {/* Action Button */}
        <div className="mt-8 mb-4">
          <button
            onClick={handleUploadAndPay}
            disabled={!file || uploading || isAnalyzing}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
              ${!file || uploading || isAnalyzing
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-900/20'
              }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando...
              </>
            ) : isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analizando con IA...
              </>
            ) : (
              <>
                Pagar y Mostrar
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-600 mt-3">
            Pagos seguros simulados para demo.
          </p>
        </div>

      </main>
    </div>
  );
}