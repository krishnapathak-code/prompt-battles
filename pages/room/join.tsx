"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Hash, ArrowRight, Loader2, AlertCircle } from "lucide-react"; 

/* ---------------- UTILS ---------------- */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

export default function JoinRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/auth");
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  const joinRoom = async () => {
    setError("");

    // Validation: 6 chars, alphanumeric
    // (Note: Backend uses UUID, but often room codes are shortened. 
    // If your room ID is a full UUID, remove the length check or adjust regex.)
    if (!userId) {
      setError("You must be logged in.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: code,
          user_id: userId,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to join room.");
      } else {
        router.push(`/room/${json.roomId}`);
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-orange-500/30 flex items-center justify-center p-6 overflow-hidden relative">
      {/* GLOBAL NOISE TEXTURE */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: noiseBg }}></div>
      
      {/* BACKGROUND BLOBS */}
      <div className="fixed top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-zinc-800/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-orange-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* CARD CONTAINER */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }} 
        className="relative z-10 w-full max-w-sm"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-3xl opacity-50 blur-sm"></div>
        <div className="relative bg-[#09090b]/90 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          
          {/* HEADER */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 mb-2">
              Join Arena
            </h1>
            <p className="text-zinc-500 text-sm">Enter the battle code to engage.</p>
          </div>

          <div className="flex flex-col gap-6">
            
            {/* INPUT FIELD */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors">
                  <Hash size={20} />
                </div>
                <input
                  className="w-full bg-[#121214] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-2xl text-white font-mono tracking-widest placeholder:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all shadow-inner uppercase"
                  placeholder="CODE"
                  maxLength={36} // Adjusted for UUIDs if necessary, strict regex checks alphanumeric content below
                  value={code}
                  onChange={(e) => {
                    // Allow only alphanumeric, force uppercase
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); 
                    setCode(val);
                    setError(""); // Clear error on type
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code) joinRoom();
                  }}
                />
              </div>
            </div>

            {/* ERROR MESSAGE */}
            <div className="h-6">
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -5 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -5 }}
                            className="flex items-center justify-center gap-2 text-red-400 text-xs font-medium"
                        >
                            <AlertCircle size={14} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={joinRoom} 
                disabled={loading || !code}
                className="w-full h-14 text-lg font-bold rounded-xl bg-zinc-100 text-black hover:bg-white hover:scale-[1.02] transition-all shadow-lg disabled:opacity-50 disabled:scale-100"
              >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        Connecting...
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        Enter Room <ArrowRight size={20} strokeWidth={2.5} />
                    </span>
                )}
              </Button>
              
              <button 
                onClick={() => router.back()}
                className="text-zinc-500 text-sm hover:text-white transition-colors py-2"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}