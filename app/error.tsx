'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#02040a] text-white">
      <div className="flex flex-col items-center gap-6 p-12 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500">
          <AlertTriangle className="w-12 h-12" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Algo salió mal</h2>
          <p className="text-zinc-400 max-w-md text-sm font-mono">
            {error.message || "Se ha producido un error inesperado en el sistema de visualización."}
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="group flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4 group-hover:animate-spin" />
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
