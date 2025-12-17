import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finish = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        console.error("No OAuth code found.");
        router.push("/auth");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(error);
        router.push("/auth");
        return;
      }

      router.push("/room/create");
    };

    finish();
  }, []);

  return <p>Completing sign-in…</p>;
}
