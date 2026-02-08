'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, Image as ImageIcon, Video as VideoIcon, Loader2, X, MapPin, ShieldAlert, Utensils, Dumbbell, Bus, Monitor, Store } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import * as nsfwjs from 'nsfwjs';
import { calculateAdPrice, formatPrice } from '@/lib/pricing';

const CATEGORIES = [
  { id: 'Restaurante', label: 'Restaurantes', icon: Utensils, description: 'Llega a comensales en momentos de relax.' },
  { id: 'Gimnasio', label: 'Gimnasios', icon: Dumbbell, description: 'Audiencia activa y enfocada en salud.' },
  { id: 'Transporte', label: 'Transporte', icon: Bus, description: 'Pantallas en movimiento, gran alcance.' },
  { id: 'Vía Pública', label: 'Vía Pública', icon: MapPin, description: 'Cartelería gigante y pantallas urbanas.' },
  { id: 'Retail', label: 'Retail / Tiendas', icon: Store, description: 'Puntos de venta y centros comerciales.' },
];

export default function AdvertisePage() {
  const router = useRouter();
  
  // Steps: 'category' -> 'upload' -> 'success'
  const [step, setStep] = useState<'category' | 'upload' | 'success'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [targetScreens, setTargetScreens] = useState<any[]>([]);
  const [loadingScreens, setLoadingScreens] = useState(false);

  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Config State
  const [days, setDays] = useState(1);
  const [duration, setDuration] = useState(10);
  
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

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setLoadingScreens(true);
    
    try {
      // Fetch profiles with this category
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('category', `%${categoryId}%`); // Use ILIKE for partial match/case insensitive

      if (profileError) throw profileError;

      const ownerIds = profiles.map(p => p.id);

      if (ownerIds.length === 0) {
         setTargetScreens([]);
         toast.error('No se encontraron pantallas en esta categoría.');
         setLoadingScreens(false);
         return;
      }

      // Fetch screens owned by these profiles
      const { data: screens, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .in('owner_id', ownerIds)
        .eq('status', 'active');
      
      if (screenError) throw screenError;
      
      setTargetScreens(screens || []);
      if (screens && screens.length > 0) {
        setTimeout(() => setStep('upload'), 500); 
      } else {
        toast.error('No hay pantallas activas en esta categoría por el momento.');
      }
    } catch (err) {
      console.error('Error fetching screens:', err);
      toast.error('Error al buscar pantallas disponibles.');
    } finally {
      setLoadingScreens(false);
    }
  };

  const analyzeImage = async (imgElement: HTMLImageElement) => {
    if (!model) {
       toast.error('El sistema de seguridad IA se está iniciando. Por favor espera unos segundos.');
       return false;
    }
    
    setIsAnalyzing(true);
    try {
      const predictions = await model.classify(imgElement);
      setIsAnalyzing(false);
      console.log('AI Analysis:', predictions);

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
          screen_id: 'campaign'
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Analysis error:', err);
      setIsAnalyzing(false);
      toast.error('Error al analizar la imagen.');
      return false;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (Máx 50MB)');
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setFile(selectedFile);

    // If image, analyze it
    if (selectedFile.type.startsWith('image/')) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = async () => {
        const isSafe = await analyzeImage(img);
        if (!isSafe) {
          setFile(null);
          setPreviewUrl(null);
          toast.error('Contenido no permitido por nuestras políticas de seguridad.');
        }
      };
    }
  };

  const handleUpload = async () => {
    if (!file || targetScreens.length === 0) return;

    setUploading(true);
    const toastId = toast.loading('Procesando campaña masiva...');

    try {
      // 1. Upload file to Storage (once)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `campaigns/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ad-content')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ad-content')
        .getPublicUrl(filePath);

      // 2. Create media_uploads for EACH target screen
      const uploadsData = targetScreens.map(screen => ({
        screen_id: screen.id,
        file_url: publicUrl,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        duration_seconds: duration,
        status: 'pending', // Pending payment/approval
        user_id: null // Anonymous for now, or link to logged in user if available
      }));

      const { data: insertedUploads, error: dbError } = await supabase
        .from('media_uploads')
        .insert(uploadsData)
        .select();

      if (dbError) throw dbError;

      // 3. Create Transactions (Simulated for now)
      // In a real app, we would create one transaction for the total amount
      // For MVP, we create one transaction per upload to match existing schema
      const pricePerScreen = calculateAdPrice(duration, days);
      
      const transactionsData = insertedUploads.map(upload => ({
        media_upload_id: upload.id,
        amount: pricePerScreen,
        currency: 'USD',
        status: 'pending' // Wait for payment
      }));

      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactionsData);

      if (txError) throw txError;

      toast.success('¡Campaña creada con éxito!', { id: toastId });
      setStep('success');

    } catch (error) {
      console.error('Error uploading campaign:', error);
      toast.error('Error al crear la campaña', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const totalPrice = calculateAdPrice(duration, days) * targetScreens.length;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-400 selection:text-black">
      <Toaster position="top-center" theme="dark" />
      
      {/* Navbar Simple */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          </div>
          <span className="font-bold text-xl tracking-tight">AdVero Network</span>
        </div>
      </nav>

      <main className="pt-24 px-6 pb-20 max-w-4xl mx-auto">
        
        <AnimatePresence mode="wait">
          {step === 'category' && (
            <motion.div 
              key="category"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  Elige tu audiencia
                </h1>
                <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                  Selecciona dónde quieres que aparezca tu anuncio. Nosotros nos encargamos de distribuirlo en todas las pantallas de esa categoría.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    disabled={loadingScreens}
                    className="group relative p-6 rounded-2xl bg-zinc-900 border border-white/10 hover:border-yellow-400/50 hover:bg-zinc-800 transition-all text-left flex items-start gap-4 overflow-hidden"
                  >
                    <div className="p-3 bg-zinc-800 rounded-xl group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                      <cat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1 group-hover:text-yellow-400 transition-colors">{cat.label}</h3>
                      <p className="text-sm text-zinc-400">{cat.description}</p>
                    </div>
                    {loadingScreens && selectedCategory === cat.id && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 text-sm text-zinc-400 mb-8">
                <button onClick={() => setStep('category')} className="hover:text-white transition-colors">
                  ← Volver a categorías
                </button>
                <span>/</span>
                <span className="text-yellow-400 font-medium">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</span>
              </div>

              <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Sube tu anuncio</h2>
                    <p className="text-zinc-400">
                      Se mostrará en <span className="text-white font-bold">{targetScreens.length} pantallas</span> seleccionadas.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-yellow-400">{formatPrice(totalPrice)}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Presupuesto Total</div>
                  </div>
                </div>

                {/* File Upload Area */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                    ${file ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'}
                  `}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*,video/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />

                  {previewUrl ? (
                    <div className="relative inline-block rounded-lg overflow-hidden shadow-2xl">
                      {file?.type.startsWith('video/') ? (
                        <video src={previewUrl} className="max-h-64 rounded-lg" controls />
                      ) : (
                        <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg object-contain" />
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setFile(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-lg font-medium">Haz click para subir</p>
                        <p className="text-sm text-zinc-500">Imágenes o Videos (Max 50MB)</p>
                      </div>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm rounded-2xl z-10">
                      <Loader2 className="w-10 h-10 animate-spin text-yellow-400 mb-4" />
                      <p className="font-medium text-yellow-400 animate-pulse">Analizando contenido con IA...</p>
                    </div>
                  )}
                </div>

                {/* Duration & Days Config */}
                <div className="grid grid-cols-2 gap-6 mt-8">
                   <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Duración del anuncio</label>
                      <select 
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      >
                        <option value={10}>10 segundos</option>
                        <option value={15}>15 segundos (+50%)</option>
                        <option value={30}>30 segundos (+100%)</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Días de campaña</label>
                      <select 
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      >
                        <option value={1}>1 Día</option>
                        <option value={3}>3 Días</option>
                        <option value={7}>1 Semana</option>
                        <option value={30}>1 Mes</option>
                      </select>
                   </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10">
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading || isAnalyzing}
                    className="w-full bg-yellow-400 text-black font-bold text-lg py-4 rounded-xl hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-yellow-400/20"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Lanzando Campaña...
                      </span>
                    ) : (
                      `Pagar y Lanzar ($${formatPrice(totalPrice)})`
                    )}
                  </button>
                  <p className="text-center text-xs text-zinc-500 mt-4">
                    Al continuar aceptas nuestros términos de servicio. El contenido será revisado antes de publicarse.
                  </p>
                </div>

              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-black mb-4">¡Campaña Enviada!</h2>
              <p className="text-xl text-zinc-400 max-w-lg mx-auto mb-12">
                Tu anuncio ha sido enviado a <span className="text-white font-bold">{targetScreens.length} pantallas</span>.
                <br/>Comenzará a reproducirse una vez procesado el pago.
              </p>
              <button 
                onClick={() => {
                  setStep('category');
                  setFile(null);
                  setPreviewUrl(null);
                  setTargetScreens([]);
                  setSelectedCategory(null);
                }}
                className="bg-zinc-800 text-white px-8 py-3 rounded-full font-bold hover:bg-zinc-700 transition-colors"
              >
                Crear otra campaña
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
