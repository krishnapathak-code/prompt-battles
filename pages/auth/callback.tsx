import { useRouter } from "next/router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function CallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const finish = async () => {
            const url = new URL(window.location.href);
            const code = url.searchParams.get("code");

            if (!code) {
                router.push("/"); // Redirect to home instead of /auth
                return;
            }

            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
                console.error("Auth Error:", error);
                router.push("/");
                return;
            }

            // Successfully logged in
            router.push("/");
        };

        finish();
    }, [router]);

    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white">
            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-2xl shadow-orange-900/30">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight mb-2">Authenticating</h2>
                    <p className="text-zinc-500">Securing your connection to the battle server...</p>
                </div>
            </div>
        </div>
    );
}