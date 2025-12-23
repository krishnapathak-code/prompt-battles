"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { 
  ArrowLeft, Save, LogOut, User, Mail, 
  Bell, Volume2, ShieldAlert, Check, Loader2, Settings as SettingsIcon
} from "lucide-react";

/* ---------------- ANIMATED BACKGROUND (Same as before) ---------------- */
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
    </div>
);

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  
  // Toggles
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // Feedback
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/auth"); return; }
        
        setUser(session.user);
        setEmail(session.user.email || "");

        // FETCH: specific to 'users' table in public schema
        const { data, error } = await supabase
          .from('users') 
          .select('username')
          .eq('id', session.user.id)
          .single();

        if (data) {
            setUsername(data.username || "");
        }
      } catch (e) {
        console.error("Error loading settings:", e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);
/* ---------------- SAVE ACTION ---------------- */
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    try {
        const { error } = await supabase
            .from('users') 
            .upsert({ 
                id: user.id, 
                username: username,
                email: user.email, // <--- ADDED THIS LINE
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        
        setMessage({ text: "Profile updated successfully.", type: 'success' });
        setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
        console.error("Save Error:", e);
        setMessage({ text: "Failed to save. " + e.message, type: 'error' });
    } finally {
        setSaving(false);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  return (
    <div className="min-h-screen text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col relative">
      <AnimatedBackground />

      {/* HEADER */}
      <header className="relative z-10 w-full px-6 py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <Button 
                variant="ghost" size="icon" onClick={() => router.back()}
                className="rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
            >
                <ArrowLeft size={20} />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <SettingsIcon className="text-orange-500" /> Settings
            </h1>
        </div>

        {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" /></div>
        ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                
                {/* PROFILE SECTION */}
                <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <User size={18} className="text-orange-400"/> Account Info
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <Input disabled value={email} className="pl-12 bg-black/40 border-white/5 text-zinc-400 cursor-not-allowed rounded-xl h-12"/>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Display Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-orange-500 transition-colors" size={16} />
                                <Input 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-12 bg-zinc-900/50 border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20 rounded-xl h-12 text-white"
                                    placeholder="Enter your username"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                         <AnimatePresence>
                            {message && (
                                <motion.span 
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                    className={`text-sm flex items-center gap-2 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
                                >
                                    {message.type === 'success' ? <Check size={14}/> : <ShieldAlert size={14}/>} {message.text}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        
                        <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-zinc-200 font-bold rounded-xl px-6 ml-auto">
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} className="mr-2"/> Save Changes</>}
                        </Button>
                    </div>
                </section>

                {/* VISUAL PREFERENCES */}
                <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><SettingsIcon size={18} className="text-orange-400"/> Preferences</h2>
                    <div className="space-y-1">
                        <ToggleRow icon={<Volume2 size={18} />} label="Sound Effects" active={soundEnabled} onToggle={() => setSoundEnabled(!soundEnabled)} />
                        <div className="h-[1px] bg-white/5 mx-4"/>
                        <ToggleRow icon={<Bell size={18} />} label="Notifications" active={notifications} onToggle={() => setNotifications(!notifications)} />
                    </div>
                </section>

                {/* DANGER ZONE */}
                <section className="bg-red-500/5 border border-red-500/10 rounded-3xl p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold text-red-400 flex items-center gap-2"><ShieldAlert size={18} /> Danger Zone</h2>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-zinc-500 text-sm">Sign out of your account on this device.</p>
                        <Button variant="outline" onClick={handleSignOut} className="w-full sm:w-auto border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white">
                            <LogOut size={16} className="mr-2"/> Sign Out
                        </Button>
                    </div>
                </section>
            </motion.div>
        )}
      </header>
    </div>
  );
}

function ToggleRow({ icon, label, active, onToggle }: { icon: any, label: string, active: boolean, onToggle: () => void }) {
    return (
        <div onClick={onToggle} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group">
            <div className="flex items-center gap-4 text-zinc-300 group-hover:text-white transition-colors">
                <div className="text-zinc-500 group-hover:text-orange-500 transition-colors">{icon}</div>
                <span className="font-medium">{label}</span>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${active ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                <motion.div initial={false} animate={{ x: active ? 20 : 0 }} className="w-5 h-5 bg-white rounded-full shadow-md" />
            </div>
        </div>
    )
}