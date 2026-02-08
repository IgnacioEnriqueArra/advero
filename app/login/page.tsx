'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight, User, MapPin, Store, Tag } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration Fields
  const [fullName, setFullName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // 1. Sign Up with Metadata
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              venue_name: venueName,
              location: location,
              category: category
            }
          }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('No se pudo crear el usuario');

        toast.success('¡Cuenta creada! ' + (authData.session ? 'Bienvenido.' : 'Revisa tu email si es necesario.'));
        
        if (authData.session) {
          router.push('/admin');
        } else {
           setIsSignUp(false);
        }

      } else {
        // Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) throw signInError;
        
        toast.success('Bienvenido de vuelta');
        router.push('/admin');
      }

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <Toaster theme="dark" position="bottom-center" />
      
      {/* Background Noise - Consistent with Landing */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_70%)]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
             <div className="w-4 h-4 bg-black rounded-full" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight mb-2 text-white">
            {isSignUp ? 'Crear cuenta de Local' : 'Iniciar Sesión'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isSignUp ? 'Únete a la red de AdVero.' : 'Accede a tu panel de control.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          
          <div className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-white placeholder:text-gray-600"
                placeholder="Email corporativo"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-white placeholder:text-gray-600"
                placeholder="Contraseña"
                minLength={6}
              />
            </div>
          </div>

          {/* EXTRA FIELDS FOR SIGNUP */}
          <AnimatePresence>
            {isSignUp && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="pt-2 pb-1">
                   <div className="h-px bg-white/5 w-full" />
                </div>
                
                <div className="relative group">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                  <input 
                    type="text" 
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-white placeholder:text-gray-600"
                    placeholder="Nombre del Dueño"
                  />
                </div>

                <div className="relative group">
                  <Store className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                  <input 
                    type="text" 
                    required={isSignUp}
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-white placeholder:text-gray-600"
                    placeholder="Nombre del Local"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                      <input 
                        type="text" 
                        required={isSignUp}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-white placeholder:text-gray-600"
                        placeholder="Ciudad"
                      />
                    </div>
                    <div className="relative group">
                      <select 
                        required={isSignUp}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-white/30 focus:bg-[#111] transition text-gray-400 appearance-none"
                      >
                        <option value="" disabled>Categoría</option>
                        <option value="bar">Bar</option>
                        <option value="restaurant">Restaurante</option>
                        <option value="cafe">Café</option>
                        <option value="gym">Gimnasio</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-2 active:scale-95 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Completar Registro' : 'Continuar'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-gray-500 hover:text-white transition"
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>

      </motion.div>
      
      <div className="absolute bottom-6 text-[10px] text-gray-700 font-mono uppercase tracking-widest">
        AdVero Secure System
      </div>
    </div>
  );
}
