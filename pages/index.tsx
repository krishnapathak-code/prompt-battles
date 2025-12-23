"use client";

import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react"; // Added useRef
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion"; // Added AnimatePresence
import { 
  Plus, Users, Swords, Zap, Loader2, 
  Menu, User, Settings, History, LogOut, X // Added new icons
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* ---------------- UTILS ---------------- */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // New State for Menu

  /* ---------------- AUTH PROTECTION ---------------- */
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        router.replace("/auth");
      } else {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [router]);

  /* ---------------- HANDLERS ---------------- */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  /* ---------------- LOADING STATE ---------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  /* ---------------- MAIN DASHBOARD ---------------- */
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col relative overflow-hidden">
      {/* GLOBAL NOISE TEXTURE */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: noiseBg }}></div>
      
      {/* BACKGROUND BLOBS */}
      <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-zinc-800/20 blur-[150px] rounded-full pointer-events-none animate-pulse" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-orange-900/10 blur-[150px] rounded-full pointer-events-none animate-pulse delay-1000" />

      {/* NAVBAR */}
      <header className="relative z-50 w-full px-6 md:px-8 py-6 flex justify-between items-center max-w-7xl mx-auto">
        
        {/* LEFT SECTION: MENU + LOGO */}
        <div className="flex items-center gap-4 md:gap-6">
            
            {/* MENU DROPDOWN */}
            <div className="relative">
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="relative z-50 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </Button>

                {/* ANIMATED DROPDOWN */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <>
                            {/* Invisible Backdrop to close on click outside */}
                            <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setIsMenuOpen(false)} 
                            />
                            
                            {/* Dropdown Content */}
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-12 left-0 w-56 bg-[#09090b]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-40 p-2"
                            >
                                <div className="space-y-1">
                                    <MenuItem icon={<User size={18}/>} label="Profile" onClick={() => router.push('/profile')} />
                                    <MenuItem icon={<History size={18}/>} label="Battle History" onClick={() => router.push('/history')} />
                                    <MenuItem icon={<Settings size={18}/>} label="Settings" onClick={() => router.push('/settings')} />
                                    
                                    <div className="h-px bg-white/10 my-2 mx-2" />
                                    
                                    <MenuItem 
                                        icon={<LogOut size={18}/>} 
                                        label="Sign Out" 
                                        onClick={handleLogout}
                                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                    />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* LOGO */}
            <div className="flex items-center gap-3 select-none">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Swords className="text-white" size={20} />
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:block">Prompt<span className="text-zinc-500">Wars</span></span>
            </div>
        </div>
        
        {/* RIGHT SECTION: BETA & ACTION */}
        <div className="flex items-center gap-4">
             <div className="hidden md:block px-4 py-2 rounded-full bg-white/5 border border-white/5 text-sm font-medium text-zinc-400">
                Beta v1.0
            </div>
            {/* Quick Sign Out (Can remove if redundant, but good for UX) */}
            <Button 
                variant="ghost" 
                className="hidden md:flex text-zinc-400 hover:text-white"
                onClick={handleLogout}
            >
                Sign Out
            </Button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
        
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center max-w-3xl space-y-6 mb-16"
        >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold tracking-wider uppercase mb-4">
                <Zap size={12} className="fill-orange-400" /> AI-Powered Battles
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-600 leading-[1.1]">
                WRITE.<br/>
                GENERATE.<br/>
                CONQUER.
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 font-light max-w-xl mx-auto leading-relaxed">
                Compete against friends to write the best AI prompts. <br className="hidden md:block"/>
                The AI Judge decides who has the ultimate creative control.
            </p>
        </motion.div>

        {/* ACTION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {/* CARD 1: CREATE ROOM */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="group relative"
            >
                <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
                <div 
                    onClick={() => router.push("/room/create")}
                    className="relative h-full bg-[#09090b]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl cursor-pointer hover:bg-white/5 transition-all flex flex-col justify-between gap-8 group-hover:translate-y-[-4px]"
                >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Plus size={28} strokeWidth={3} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Create Room</h3>
                        <p className="text-zinc-400 text-sm">Host a new battle. You control the rounds and settings.</p>
                    </div>
                    <div className="flex items-center gap-2 text-orange-400 text-sm font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
                        Launch Arena <ArrowIcon />
                    </div>
                </div>
            </motion.div>

            {/* CARD 2: JOIN ROOM */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="group relative"
            >
                <div className="absolute -inset-0.5 bg-gradient-to-br from-zinc-600 to-zinc-400 rounded-3xl opacity-10 group-hover:opacity-30 blur transition duration-500"></div>
                <div 
                    onClick={() => router.push("/room/join")}
                    className="relative h-full bg-[#09090b]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl cursor-pointer hover:bg-white/5 transition-all flex flex-col justify-between gap-8 group-hover:translate-y-[-4px]"
                >
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-100 group-hover:scale-110 transition-transform duration-300">
                        <Users size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Join Room</h3>
                        <p className="text-zinc-400 text-sm">Enter a room code to join an existing lobby.</p>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300 text-sm font-bold uppercase tracking-wider group-hover:gap-4 transition-all">
                        Enter Code <ArrowIcon />
                    </div>
                </div>
            </motion.div>

        </div>

        {/* FOOTER STATS */}
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-20 flex gap-8 md:gap-16 text-center"
        >
            <div>
                <div className="text-3xl font-black text-white">10k+</div>
                <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Images Generated</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div>
                <div className="text-3xl font-black text-white">2.5k</div>
                <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Battles Won</div>
            </div>
        </motion.div>

      </main>
    </div>
  );
}

// ---------------- SUB-COMPONENTS ---------------- //

function MenuItem({ icon, label, onClick, className }: { icon: React.ReactNode, label: string, onClick: () => void, className?: string }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left",
                className
            )}
        >
            {icon}
            {label}
        </button>
    )
}

const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);