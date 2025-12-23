"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Loader2, ArrowLeft, User, Mail, Trophy, 
  Target, Swords, Calendar, Edit2, Save, X, Eye, Sparkles,
  Layers
} from "lucide-react";

/* ---------------- TYPES ---------------- */
interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

interface BattleStat {
  battle_id: string;
  total_score: number;
  rank: number;
  room_title?: string; 
  battles: {
    started_at: string;
    status: string;
    room_id: string;
    total_rounds: number; 
  };
}

interface SafePromptDetail {
  prompt_text: string;
  justification: string;
  scores: number;       
  rounds: {
    images?: {
        url: string;
    } | null;
  } | any; 
}

/* ---------------- BACKGROUND COMPONENTS ---------------- */

const AnimatedBackground = () => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Base Dark Layer */}
            <div className="absolute inset-0 bg-[#050505]" />
            
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03]" 
                style={{ 
                    backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, 
                    backgroundSize: '30px 30px' 
                }} 
            />

            {/* Moving Gradient Orb 1 (Orange/Red) */}
            <motion.div 
                animate={{ 
                    x: [0, 100, -50, 0],
                    y: [0, -50, 50, 0],
                    scale: [1, 1.2, 1],
                    opacity: [0.15, 0.25, 0.15]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-orange-600 rounded-full blur-[120px] mix-blend-screen"
            />

            {/* Moving Gradient Orb 2 (Purple/Blue) - For Contrast */}
            <motion.div 
                animate={{ 
                    x: [0, -70, 30, 0],
                    y: [0, 60, -30, 0],
                    scale: [1, 1.1, 1],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
                className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-violet-900 rounded-full blur-[120px] mix-blend-screen"
            />
        </div>
    );
};

export default function Profile() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<BattleStat[]>([]);
  const [stats, setStats] = useState({ played: 0, wins: 0, avgScore: 0 });
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // Modal State
  const [selectedBattleId, setSelectedBattleId] = useState<string | null>(null);

  /* ---------------- DATA FETCHING ---------------- */
  const fetchData = async (sessionUser: any) => {
    try {
      const userId = sessionUser.id;
      const userEmail = sessionUser.email;

      // 1. Set Initial Data
      setUserProfile({
        id: userId,
        email: userEmail,
        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || "Anonymous",
      });

      // 2. Fetch User Profile
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, name, email, created_at')
        .eq('id', userId)
        .single();

      if (dbUser) {
        setUserProfile(dbUser);
        setEditName(dbUser.name || "Unknown Warrior");
      }

      // 3. Fetch Battle Stats
      const { data: battleData, error: battleError } = await supabase
        .from('battle_scores')
        .select(`
            battle_id,
            total_score,
            rank,
            battles (
                started_at,
                status,
                room_id,
                total_rounds 
            )
        `)
        .eq('user_id', userId)
        .limit(10);

      if (battleError) throw battleData;

      let enrichedHistory: BattleStat[] = [];

      if (battleData && battleData.length > 0) {
        const roomIds = battleData.map((b: any) => b.battles?.room_id).filter((id) => id); 
        const { data: roomsData } = await supabase.from('rooms').select('id, title').in('id', roomIds);

        enrichedHistory = battleData.map((item: any) => {
            const roomInfo = roomsData?.find(r => r.id === item.battles?.room_id);
            return {
                ...item,
                room_title: roomInfo?.title || "Unknown Room"
            };
        });

        enrichedHistory.sort((a: any, b: any) => 
            new Date(b.battles?.started_at || 0).getTime() - new Date(a.battles?.started_at || 0).getTime()
        );
      }

      setHistory(enrichedHistory);

      // 6. Calculate Aggregates
      const { count: totalPlayed } = await supabase.from('battle_scores').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      const { count: totalWins } = await supabase.from('battle_scores').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('rank', 1);

      if (battleData) {
        const totalScoreSum = battleData.reduce((acc, curr) => acc + (curr.total_score || 0), 0);
        const avg = battleData.length > 0 ? Math.round(totalScoreSum / battleData.length) : 0;
        
        setStats({ played: totalPlayed || 0, wins: totalWins || 0, avgScore: avg });
      }

    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth");
        return;
      }
      await fetchData(session.user);
    };
    init();
  }, [router]);

  /* ---------------- HANDLERS ---------------- */
  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setIsSaving(true);
    try {
        const { error } = await supabase
            .from('users')
            .upsert({ id: userProfile.id, email: userProfile.email, name: editName });
      if (error) throw error;
      setUserProfile({ ...userProfile, name: editName });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col relative overflow-hidden">
      
      {/* 1. ANIMATED BACKGROUND */}
      <AnimatedBackground />

      {/* HEADER */}
      <header className="relative z-10 w-full px-6 py-6 max-w-5xl mx-auto flex items-center gap-4">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-transform hover:scale-105 active:scale-95"
        >
            <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COL: USER IDENTITY */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="lg:col-span-1 h-fit"
            >
                {/* GLASS CARD */}
                <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                    
                    {/* Subtle Gradient Shine on Card */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-black/40 to-transparent" />

                    <div className="relative mb-6 mt-4 group cursor-default">
                        {/* Avatar Glow */}
                        <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full group-hover:bg-orange-500/30 transition-all duration-500" />
                        
                        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-[3px] shadow-lg">
                            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                                <User size={48} className="text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                            </div>
                        </div>
                        {/* Level Badge */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-xs font-bold px-3 py-1 rounded-full text-orange-400 shadow-xl whitespace-nowrap">
                            Lvl {Math.floor(stats.played / 5) + 1} Warrior
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        {isEditing ? (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                <input 
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)} 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-center text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 text-white transition-all"
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-center">
                                    <Button size="sm" variant="ghost" className="h-8 hover:bg-white/10" onClick={() => setIsEditing(false)}><X size={14}/></Button>
                                    <Button size="sm" className="h-8 bg-orange-600 hover:bg-orange-500 text-white" onClick={handleSaveProfile} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14}/>}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                                    {userProfile?.name}
                                    <Edit2 size={14} className="opacity-0 group-hover:opacity-100 transition-all text-zinc-500 -translate-x-2 group-hover:translate-x-0" />
                                </h2>
                                <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm mt-1 font-medium"><Mail size={12} />{userProfile?.email}</div>
                            </div>
                        )}
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />
                    
                    <div className="w-full grid grid-cols-2 gap-4">
                         <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="text-2xl font-black text-white">{stats.wins}</div>
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Wins</div>
                         </div>
                         <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="text-2xl font-black text-white">{stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%</div>
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Win Rate</div>
                         </div>
                    </div>
                </div>
            </motion.div>

            {/* RIGHT COL: STATS & HISTORY */}
            <div className="lg:col-span-2 space-y-8">
                {/* 3 STAT CARDS */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.1, duration: 0.5 }} 
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                >
                    <StatCard icon={<Swords className="text-orange-500" />} label="Battles" value={stats.played.toString()} delay={0.1} />
                    <StatCard icon={<Trophy className="text-yellow-500" />} label="Avg Rank" value={history.length > 0 ? `#${Math.round(history.reduce((a, b) => a + (b.rank || 0), 0) / history.length)}` : "-"} delay={0.2} />
                    <StatCard icon={<Target className="text-red-500" />} label="Avg Score" value={stats.avgScore.toString()} delay={0.3} />
                </motion.div>

                {/* HISTORY LIST */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center justify-between mb-5 px-1">
                        <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                            <Calendar size={18} className="text-orange-500" /> Battle Log
                        </h3>
                        <span className="text-xs text-zinc-500 font-mono">LAST 10 MATCHES</span>
                    </div>

                    <div className="bg-zinc-900/30 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                        {history.length > 0 ? (
                            history.map((match, index) => {
                                const isWin = match.rank === 1;
                                const dateObj = match.battles?.started_at ? new Date(match.battles.started_at) : new Date();
                                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                const roomName = match.room_title || "Untitled Room";
                                const totalRounds = match.battles?.total_rounds || 0;
                                const rawRoomId = match.battles?.room_id || "";
                                const displayRoomId = rawRoomId.length > 8 ? rawRoomId.slice(0, 8) : rawRoomId;

                                return (
                                    <motion.div 
                                        key={match.battle_id + index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + (index * 0.05) }}
                                        className={`group relative p-4 md:p-5 flex items-center justify-between hover:bg-white/5 transition-all duration-300 ${index !== history.length - 1 ? 'border-b border-white/5' : ''}`}
                                    >
                                        {/* Hover Highlight Line */}
                                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex items-center gap-4 w-full pl-2">
                                            {/* RANK BADGE */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-110 ${isWin ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-zinc-800 text-zinc-400 border border-white/10'}`}>
                                                #{match.rank || "-"}
                                            </div>
                                            
                                            <div className="flex flex-col gap-1 w-full min-w-0">
                                                {/* ROOM NAME */}
                                                <div className="font-medium text-zinc-200 text-base leading-tight truncate max-w-[200px] group-hover:text-orange-100 transition-colors">{roomName}</div>
                                                
                                                {/* METADATA GRID */}
                                                <div className="grid grid-cols-[70px_90px_1fr] gap-2 items-center text-xs text-zinc-500">
                                                    
                                                    {/* 1. ID */}
                                                    <span className="font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors cursor-help truncate" title={`Room ID: ${rawRoomId}`}>
                                                        #{displayRoomId}
                                                    </span>

                                                    {/* 2. Rounds */}
                                                    <span className="flex items-center gap-1.5 truncate text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                                        <Layers size={12} className="shrink-0" /> 
                                                        {totalRounds} Rnds
                                                    </span>

                                                    {/* 3. Date & Time Combined */}
                                                    <span className="flex items-center gap-2 truncate text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                                        <span className="font-medium">{dateStr}</span>
                                                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                        <span className="tabular-nums">{timeStr}</span>
                                                    </span>

                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 sm:gap-6 pl-4">
                                            <div className="text-right hidden sm:block">
                                                <div className="font-bold text-white text-lg group-hover:text-orange-400 transition-colors">{match.total_score}</div>
                                                <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">Score</div>
                                            </div>
                                            <Button 
                                                size="icon" 
                                                variant="outline" 
                                                className="rounded-full bg-transparent border-white/10 hover:bg-white/10 hover:text-orange-400 hover:border-orange-500/50 transition-all shrink-0 active:scale-95"
                                                onClick={() => setSelectedBattleId(match.battle_id)}
                                            >
                                                <Eye size={16} />
                                            </Button>
                                        </div>
                                    </motion.div>
                                )
                            })
                        ) : (
                             <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4"><Swords className="opacity-40" size={24} /></div>
                                <p>No battles recorded yet.</p>
                                <p className="text-xs text-zinc-600 mt-2">Go fight correctly!</p>
                             </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>

        {/* --- BATTLE DETAILS MODAL --- */}
        <AnimatePresence>
            {selectedBattleId && (
                <BattleDetailsModal 
                    battleId={selectedBattleId} 
                    onClose={() => setSelectedBattleId(null)} 
                />
            )}
        </AnimatePresence>

      </main>
    </div>
  );
}

/* ---------------- SUB-COMPONENTS ---------------- */

function StatCard({ icon, label, value, delay }: { icon: React.ReactElement, label: string, value: string, delay: number }) {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.3 }}
            className="group bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-5 rounded-2xl flex flex-col justify-between gap-4 hover:bg-white/5 hover:border-white/10 transition-all hover:-translate-y-1 shadow-lg"
        >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                {React.cloneElement(icon as any, { size: 20 })}
            </div>
            <div>
                <div className="text-2xl font-black text-white tracking-tight group-hover:text-orange-200 transition-colors">{value}</div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">{label}</div>
            </div>
        </motion.div>
    )
}

function BattleDetailsModal({ battleId, onClose }: { battleId: string, onClose: () => void }) {
    const [prompts, setPrompts] = useState<SafePromptDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [debugError, setDebugError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('prompts') 
                .select(`
                    prompt_text,
                    justification,
                    scores,  
                    rounds (
                        images (
                            url
                        )
                    )
                `)
                .eq('battle_id', battleId)
                .eq('user_id', session.user.id);

            if (error) {
                setDebugError(`Database Error: ${error.message}`);
            } else if (!data || data.length === 0) {
                setDebugError("No prompts found.");
            } else {
                setPrompts(data as SafePromptDetail[]);
            }
            setLoading(false);
        };
        fetchDetails();
    }, [battleId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md" 
                onClick={onClose} 
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-zinc-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-white/10"
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950/50 backdrop-blur-sm">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                        <Sparkles size={18} className="text-orange-500"/> Battle Insights
                    </h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 hover:rotate-90 transition-transform duration-300" onClick={onClose}><X size={16}/></Button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                            <Loader2 className="animate-spin text-orange-500" />
                            <p className="text-sm">Retrieving battle data...</p>
                        </div>
                    ) : debugError ? (
                         <div className="text-center py-10 text-red-400 space-y-2">
                            <p className="font-bold">Something went wrong.</p>
                            <p className="text-xs font-mono bg-red-900/20 p-2 rounded">{debugError}</p>
                        </div>
                    ) : prompts.length > 0 ? (
                        <div className="space-y-8">
                            {prompts.map((item, i) => {
                                const roundData = Array.isArray(item.rounds) ? item.rounds[0] : item.rounds;
                                const imageData = Array.isArray(roundData?.images) ? roundData?.images[0] : roundData?.images;
                                const imageUrl = imageData?.url;

                                return (
                                    <div key={i} className="space-y-6">
                                        {/* Round Header */}
                                        {prompts.length > 1 && (
                                            <div className="flex items-center gap-2 text-zinc-400 text-sm font-bold uppercase tracking-wider">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 box-shadow-glow"></div> Round {i + 1}
                                            </div>
                                        )}

                                        {/* Image Section */}
                                        <div className="w-full aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-white/10 relative group shadow-2xl">
                                            {imageUrl ? (
                                                <img 
                                                    src={imageUrl} 
                                                    alt="Battle Context" 
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs gap-2"><p>Broken Image Link</p></div>';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                                    <div className="bg-white/5 p-3 rounded-full"><Swords size={20} /></div>
                                                    <div className="text-xs">No Image Available</div>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-1">
                                                <Trophy size={10} className="text-yellow-500" />
                                                Score: {item.scores}
                                            </div>
                                        </div>

                                        {/* Prompt Section */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <User size={12}/> Your Prompt
                                            </label>
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-zinc-200 text-sm italic">
                                                "{item.prompt_text || "No prompt recorded."}"
                                            </div>
                                        </div>

                                        {/* AI Feedback Section */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Sparkles size={12}/> AI Analysis
                                            </label>
                                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-zinc-300 text-sm leading-relaxed relative overflow-hidden">
                                                 <div className="absolute top-0 left-0 w-1 h-full bg-orange-500/50"></div>
                                                {item.justification || "No feedback available."}
                                            </div>
                                        </div>

                                        {i < prompts.length - 1 && <div className="w-full h-px bg-white/10 my-8"/>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-zinc-500">
                            <p>No details found.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}