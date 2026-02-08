'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export default function GlobalError({
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
    <html lang="en">
      <body className={`${inter.variable} ${robotoMono.variable} antialiased font-sans bg-[#02040a] text-white`}>
        <div className="flex h-screen w-full flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-6 p-12 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
                <div className="p-4 rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle className="w-12 h-12" />
                </div>
                
                <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">System Critical Error</h2>
                <p className="text-zinc-400 max-w-md text-sm font-mono">
                    {error.message || "A critical system error occurred preventing the application from loading."}
                </p>
                </div>

                <button
                onClick={() => reset()}
                className="group flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all active:scale-95"
                >
                <RefreshCw className="w-4 h-4 group-hover:animate-spin" />
                System Reboot
                </button>
            </div>
        </div>
      </body>
    </html>
  );
}
