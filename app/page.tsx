'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const opacityHero = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <div className="relative min-h-screen bg-white text-black overflow-x-hidden selection:bg-yellow-400 selection:text-black font-sans">
      
      {/* 1. Dynamic Background (Subtle Grain & Ambient Light) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <motion.div 
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-yellow-300/10 rounded-full blur-[150px] mix-blend-multiply"
         />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* --- NAVBAR (Sticky Glass) --- */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-white/70 border-b border-black/5 supports-[backdrop-filter]:bg-white/50"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
          </div>
          <span className="font-bold text-lg tracking-tight">AdVero</span>
        </div>
        <div className="flex items-center gap-4">
           <Link href="/login" className="text-sm font-medium hover:text-zinc-600 transition-colors hidden md:block">
             Log In
           </Link>
           <Link href="/login">
             <button className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-zinc-800 transition-colors">
               Empezar
             </button>
           </Link>
        </div>
      </motion.nav>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* --- HERO SECTION --- */}
        <section className="min-h-screen flex flex-col items-center justify-center py-20 relative">
          
          <motion.div
             style={{ opacity: opacityHero, y: y1 }}
             initial={{ opacity: 0, y: 40 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
             className="text-center w-full max-w-5xl pt-16"
          >


            {/* Massive Typography */}
            <h1 className="text-[14vw] md:text-[160px] leading-[0.85] font-black tracking-tighter text-black mb-8 select-none relative z-10">
              AdVero<span className="text-yellow-400">.</span>
            </h1>

            {/* Hero Description */}
            <p className="max-w-3xl mx-auto text-2xl md:text-4xl text-black font-bold leading-tight text-balance mb-8 tracking-tight">
              La infraestructura definitiva para <br/>
              <span className="bg-yellow-300 px-2 box-decoration-clone">publicidad en el mundo real.</span>
            </p>

            <p className="max-w-xl mx-auto text-lg text-zinc-600 font-medium mb-12 leading-relaxed">
              Sin intermediarios. Sin esperas. Conecta tu marca con pantallas físicas en segundos y escala globalmente.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <Link href="/login" className="w-full md:w-auto">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full md:w-auto group relative px-8 py-4 bg-black text-white rounded-full font-bold text-lg shadow-xl shadow-black/10 hover:shadow-2xl transition-all flex items-center justify-center gap-3"
                >
                  Ingresar a la Plataforma
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            </div>

          </motion.div>

        </section>

      </div>

    </div>
  );
}
