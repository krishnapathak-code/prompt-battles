"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Minus, Plus } from "lucide-react"; 

/* ---------------- UTILS ---------------- */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

export default function CreateRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [totalRounds, setTotalRounds] = useState<number>(3);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/auth");
      setUserId(data.session?.user?.id || null);
    });
  }, []);

  const handleRoundsChange = (amount: number) => {
    setTotalRounds((prev) => {
      const newValue = prev + amount;
      if (newValue < 1) return 1;
      if (newValue > 10) return 10;
      return newValue;
    });
  };

  const createRoom = async () => {
    if (!userId || !title.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          user_id: userId,
          total_rounds: totalRounds,
        }),
      });

      const json = await res.json();
      
      if (json.roomId) {
        // ✨ NEW: AUTO-COPY LOGIC
        try {
            await navigator.clipboard.writeText(json.roomId);
            console.log("Room ID copied to clipboard automatically.");
        } catch (err) {
            console.error("Could not auto-copy room ID:", err);
        }

        router.push(`/room/${json.roomId}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-orange-500/30 flex items-center justify-center p-6 overflow-hidden relative">
      {/* GLOBAL NOISE TEXTURE */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: noiseBg }}></div>
      
      {/* BACKGROUND BLOBS */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-zinc-800/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-orange-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* CARD CONTAINER */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }} 
        className="relative z-10 w-full max-w-md"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-3xl opacity-50 blur-sm"></div>
        <div className="relative bg-[#09090b]/90 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          
          {/* HEADER */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 mb-2">
              Create Room
            </h1>
            <p className="text-zinc-500 text-sm">Configure your battle arena settings.</p>
          </div>

          <div className="flex flex-col gap-8">
            
            {/* INPUT: ROOM NAME */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 pl-1">Room Name</label>
              <input
                className="w-full bg-[#121214] border border-white/10 rounded-xl px-4 py-4 text-lg text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all shadow-inner"
                placeholder="e.g. The Late Night Battle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* INPUT: ROUNDS (CUSTOM +/- CONTROLS) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total Rounds</label>
                <span className="text-xs font-mono text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                    Max: 10
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* DECREMENT BUTTON */}
                <button
                  onClick={() => handleRoundsChange(-1)}
                  className="w-14 h-14 flex items-center justify-center rounded-xl border border-white/10 bg-[#121214] hover:bg-white/5 active:scale-95 transition-all text-zinc-400 hover:text-white"
                >
                  <Minus size={24} />
                </button>

                {/* NUMBER DISPLAY */}
                <div className="flex-1 h-14 bg-[#121214] border border-white/10 rounded-xl flex items-center justify-center text-xl font-mono font-bold text-white shadow-inner">
                  {totalRounds}
                </div>

                {/* INCREMENT BUTTON */}
                <button
                  onClick={() => handleRoundsChange(1)}
                  className="w-14 h-14 flex items-center justify-center rounded-xl border border-white/10 bg-[#121214] hover:bg-white/5 active:scale-95 transition-all text-zinc-400 hover:text-white"
                >
                  <Plus size={24} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 pl-1">Determines how long the game lasts.</p>
            </div>

            {/* ACTIONS */}
            <div className="pt-4 flex flex-col gap-3">
              <Button 
                onClick={createRoom} 
                disabled={loading || !title}
                className="w-full h-14 text-lg font-bold rounded-xl bg-zinc-100 text-black hover:bg-white hover:scale-[1.02] transition-all shadow-lg disabled:opacity-50 disabled:scale-100"
              >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Creating Arena...
                    </span>
                ) : (
                    "Create Room"
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