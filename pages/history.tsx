"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Loader2, ArrowLeft, Search, Filter, Trophy, 
  Clock, Calendar, ChevronDown, X, Sparkles, User, Layers, Swords
} from "lucide-react";

/* ---------------- TYPES ---------------- */
interface BattleHistoryItem {
  battle_id: string;
  total_score: number;
  rank: number;
  room_title?: string;
  room_id?: string;
  started_at: string;
  total_rounds: number;
}

// Loose type for the raw DB response to handle arrays/objects flexibly
interface SafePromptDetail {
  prompt_text: string;
  justification: string;
  scores: number;       
  rounds: any; // Using 'any' to handle Supabase single vs array returns safely
}

/* ---------------- ANIMATED BACKGROUND ---------------- */
const AnimatedBackground = () => (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050505]">
        <div className="absolute inset-0 opacity-[0.03]" 
            style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '30px 30px' }} 
        />
        <motion.div 
            animate={{ x: [0, 100, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] bg-orange-700 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div 
            animate={{ x: [0, -70, 30, 0], y: [0, 60, -30, 0], scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
            className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-red-900 rounded-full blur-[120px] mix-blend-screen"
        />
    </div>
);

export default function BattleHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [battles, setBattles] = useState<BattleHistoryItem[]>([]);
  const [displayedBattles, setDisplayedBattles] = useState<BattleHistoryItem[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "WINS" | "TOP3">("ALL");
  
  // Modal
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  /* ---------------- FETCH DATA ---------------- */
  const fetchBattles = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) { 
          router.replace("/auth"); 
          return; 
      }

      // 1. Fetch raw scores (Limit 50 for performance)
      const { data, error } = await supabase
        .from('battle_scores')
        .select(`
            battle_id, total_score, rank,
            battles ( started_at, room_id, total_rounds )
        `)
        .eq('user_id', session.user.id)
        .limit(50);

      if (error) {
          console.error("Supabase Error:", error);
          throw error;
      }

      if (data && data.length > 0) {
        // 2. Fetch Room Titles manually
        const roomIds = data.map((b:any) => b.battles?.room_id).filter(id => id);
        const { data: rooms } = await supabase.from('rooms').select('id, title').in('id', roomIds);

        // 3. Format Data
        const formatted: BattleHistoryItem[] = data.map((item: any) => {
            const room = rooms?.find(r => r.id === item.battles?.room_id);
            return {
                battle_id: item.battle_id,
                total_score: item.total_score,
                rank: item.rank,
                started_at: item.battles?.started_at,
                total_rounds: item.battles?.total_rounds,
                room_id: item.battles?.room_id,
                room_title: room?.title || "Unknown Arena"
            };
        });

        // 4. Sort Client-Side (Newest First)
        formatted.sort((a, b) => 
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );

        setBattles(formatted);
        setDisplayedBattles(formatted);
      }
    } catch (e) {
      console.error("Error loading history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBattles();
  }, []);

  /* ---------------- FILTER LOGIC ---------------- */
  useEffect(() => {
    let result = battles;

    // 1. Filter by Type
    if (filterType === "WINS") {
        result = result.filter(b => b.rank === 1);
    } else if (filterType === "TOP3") {
        result = result.filter(b => b.rank <= 3);
    }

    // 2. Search
    if (searchQuery.trim()) {
        const lowerQ = searchQuery.toLowerCase();
        result = result.filter(b => 
            (b.room_title || "").toLowerCase().includes(lowerQ) || 
            (b.room_id || "").toLowerCase().includes(lowerQ)
        );
    }

    setDisplayedBattles(result);
  }, [battles, filterType, searchQuery]);

  return (
    <div className="min-h-screen text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col relative">
      <AnimatedBackground />

      {/* HEADER */}
      <header className="relative z-10 w-full px-6 py-6 max-w-4xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()}
                className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-transform active:scale-95"
            >
                <ArrowLeft size={20} />
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Swords className="text-orange-500" /> Battle Archives
                </h1>
                <p className="text-zinc-500 text-sm">Review your past combat performance.</p>
            </div>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <Input 
                    placeholder="Search by room name..." 
                    className="pl-10 bg-zinc-900/50 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 rounded-xl text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="flex gap-2 p-1 bg-zinc-900/50 border border-white/5 rounded-xl backdrop-blur-md w-fit">
                {(["ALL", "WINS", "TOP3"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilterType(tab)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filterType === tab 
                            ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" 
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        }`}
                    >
                        {tab === "ALL" ? "All Battles" : tab === "TOP3" ? "Top 3" : "Wins Only"}
                    </button>
                ))}
            </div>
        </div>
      </header>

      {/* LIST CONTENT */}
      <main className="relative z-10 flex-1 px-6 pb-20 max-w-4xl mx-auto w-full space-y-4">
        
        {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
                <Loader2 className="animate-spin text-orange-500" size={32} />
                <p className="text-sm animate-pulse">Retrieving archives...</p>
            </div>
        ) : displayedBattles.length > 0 ? (
            <div className="space-y-3">
                {displayedBattles.map((battle, i) => (
                    <HistoryCard 
                        key={battle.battle_id + i} 
                        data={battle} 
                        onClick={() => setSelectedBattleId(battle.battle_id)} 
                        index={i}
                    />
                ))}
            </div>
        ) : (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/5">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4 text-zinc-600">
                    <Filter size={24} />
                </div>
                <h3 className="text-white font-bold mb-1">No battles found</h3>
                <p className="text-zinc-500 text-sm">
                    {battles.length === 0 ? "You haven't played any battles yet." : "No matches for these filters."}
                </p>
            </div>
        )}
      </main>

      {/* MODAL */}
      <AnimatePresence>
        {selectedBattleId && (
            <BattleDetailsModal 
                battleId={selectedBattleId} 
                onClose={() => setSelectedBattleId(null)} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- COMPONENT: HISTORY CARD ---------------- */

function HistoryCard({ data, onClick, index }: { data: BattleHistoryItem, onClick: () => void, index: number }) {
    const isWin = data.rank === 1;
    const isTop3 = data.rank <= 3;
    
    // Safely parse date
    let dateStr = "Unknown Date";
    let timeStr = "";
    if (data.started_at) {
        const d = new Date(data.started_at);
        dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={onClick}
            className="group relative flex items-center justify-between p-4 bg-zinc-900/40 backdrop-blur-md border border-white/5 hover:bg-zinc-800/60 hover:border-orange-500/30 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden"
        >
            {/* Left Accent Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${isWin ? 'bg-yellow-500' : isTop3 ? 'bg-orange-500/50' : 'bg-transparent group-hover:bg-zinc-700'}`} />

            <div className="flex items-center gap-5 pl-3">
                {/* Rank Box */}
                <div className={`
                    w-12 h-12 rounded-xl flex flex-col items-center justify-center border shrink-0
                    ${isWin 
                        ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]" 
                        : isTop3 
                            ? "bg-orange-500/5 border-orange-500/10 text-orange-400" 
                            : "bg-zinc-800/50 border-white/5 text-zinc-500"}
                `}>
                    <span className="text-xs font-bold uppercase tracking-wider scale-75">Rank</span>
                    <span className="text-lg font-black leading-none">#{data.rank}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <h3 className="text-zinc-200 font-bold group-hover:text-orange-200 transition-colors truncate max-w-[180px] sm:max-w-xs">
                        {data.room_title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                        <span className="flex items-center gap-1"><Calendar size={12}/> {dateStr}</span>
                        {timeStr && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                <span className="flex items-center gap-1"><Clock size={12}/> {timeStr}</span>
                            </>
                        )}
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span className="flex items-center gap-1 text-zinc-400"><Layers size={12}/> {data.total_rounds || 0} Rnds</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 pr-2">
                <div className="text-right hidden sm:block">
                    <div className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">{data.total_score}</div>
                    <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Score</div>
                </div>
                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 group-hover:bg-white/10 group-hover:text-white transition-all">
                    <Sparkles size={14} />
                </div>
            </div>
        </motion.div>
    )
}

/* ---------------- MODAL (Updated Logic) ---------------- */
function BattleDetailsModal({ battleId, onClose }: { battleId: string, onClose: () => void }) {
    const [prompts, setPrompts] = useState<SafePromptDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Fetch nested data
            const { data, error } = await supabase
                .from('prompts') 
                .select(`prompt_text, justification, scores, rounds ( images ( url ) )`)
                .eq('battle_id', battleId)
                .eq('user_id', session.user.id);

            if (error) {
                setError(error.message);
            } else {
                setPrompts(data as SafePromptDetail[] || []);
            }
            setLoading(false);
        };
        fetchDetails();
    }, [battleId]);

    // Helper to extract image regardless of Array vs Object structure
    const getImageUrl = (item: SafePromptDetail) => {
        if (!item.rounds) return null;
        
        // 1. Unwrap 'rounds' (could be array or object)
        const roundData = Array.isArray(item.rounds) ? item.rounds[0] : item.rounds;
        if (!roundData || !roundData.images) return null;

        // 2. Unwrap 'images' (could be array or object)
        const imageData = Array.isArray(roundData.images) ? roundData.images[0] : roundData.images;
        
        return imageData?.url || null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} 
            />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-[#09090b] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2"><Trophy size={18} className="text-orange-500"/> Battle Report</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-full" onClick={onClose}><X size={16}/></Button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-orange-500"/></div>
                    ) : error ? (
                        <div className="text-red-400 text-center py-10">Error loading data</div>
                    ) : prompts.length > 0 ? (
                        <div className="space-y-8">
                            {prompts.map((item, i) => {
                                const imgUrl = getImageUrl(item);
                                    
                                return (
                                    <div key={i} className="space-y-4">
                                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span> Round {i + 1}
                                        </div>
                                        <div className="w-full aspect-video bg-black rounded-xl border border-white/10 overflow-hidden relative group">
                                            {imgUrl ? (
                                                <img src={imgUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs gap-2 flex-col">
                                                    <div className="bg-white/5 p-2 rounded-full"><Swords size={16} /></div>
                                                    No Image
                                                </div>
                                            )}
                                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                                                {item.scores} pts
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-sm text-zinc-300 italic">"{item.prompt_text}"</div>
                                            <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/10 text-sm text-zinc-400">{item.justification}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center text-zinc-500 py-10">No data available for this battle.</div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}