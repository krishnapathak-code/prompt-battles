"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Sparkles, Zap, Trophy, ArrowRight, Loader2 } from "lucide-react";

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

export default function AuthPage() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // 1. Check Session on Load
    useEffect(() => {
        let ignore = false;

        const checkSession = async () => {
            // Tiny delay to prevent flash if session exists
            await new Promise((r) => setTimeout(r, 500));
            
            const { data } = await supabase.auth.getSession();
            if (!ignore) {
                if (data.session) {
                    // Redirect to Home (Dashboard) if already logged in
                    router.replace("/");
                } else {
                    setIsChecking(false);
                }
            }
        };

        checkSession();

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (!ignore && session) {
                    // Redirect to Home (Dashboard) on auth change
                    router.replace("/");
                }
            },
        );

        return () => {
            ignore = true;
            listener.subscription.unsubscribe();
        };
    }, [router]);

    // 2. Login Handler
    const handleLogin = async () => {
        setIsLoggingIn(true);
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                // Redirect to callback, which will then send user to "/"
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    /* ---------------- RENDER ---------------- */

    if (isChecking) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-orange-500/30 overflow-hidden relative flex flex-col">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0 mix-blend-overlay opacity-40" style={{ backgroundImage: noiseBg }}></div>
            <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-orange-900/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Navbar */}
            <nav className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/20">
                        <span className="font-bold text-white text-sm">P</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight text-zinc-200">Prompt Battles</span>
                </div>
                {/* Navbar Sign In Button (Scrolls to main button or just triggers login) */}
                <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={handleLogin}>
                    Sign In
                </Button>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto w-full mb-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-orange-400 mb-8 backdrop-blur-sm">
                        <Sparkles size={12} />
                        <span>AI-Powered Competitive Creativity</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-600 mb-6 drop-shadow-sm leading-[1.1]">
                        Battle with <br /> Your Imagination.
                    </h1>

                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Compete against friends to generate the most accurate AI images.
                        Write prompts, outsmart the algorithm, and climb the leaderboard.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="h-14 px-8 text-lg rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] group"
                        >
                            {isLoggingIn ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <img src="https://authjs.dev/img/providers/google.svg" className="w-5 h-5 mr-3" alt="Google" />
                            )}
                            Continue with Google
                            <ArrowRight className="ml-2 w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="h-14 px-8 text-lg rounded-full border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white bg-black/50 backdrop-blur-md"
                        >
                            How it works
                        </Button>
                    </div>
                </motion.div>

                {/* Feature Grid */}
                <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full text-left"
                >
                    <FeatureCard 
                        icon={<Zap className="text-yellow-400" />}
                        title="Real-time Battles"
                        desc="Face off in live lobbies. 60 seconds to craft the perfect prompt for the hidden image."
                    />
                    <FeatureCard 
                        icon={<Sparkles className="text-purple-400" />}
                        title="AI Judging"
                        desc="No human bias. Our advanced AI critic analyzes your image semantic accuracy instantly."
                    />
                    <FeatureCard 
                        icon={<Trophy className="text-orange-400" />}
                        title="Global Rankings"
                        desc="Win matches to gain Elo. Climb from Script Kiddie to Prompt Engineer Grandmaster."
                    />
                </motion.div>
            </main>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
    return (
        <div className="p-6 rounded-2xl bg-[#121214] border border-white/5 hover:border-white/10 transition-colors group">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">{title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
        </div>
    );
}