import { useRouter } from "next/router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
	const router = useRouter();

	useEffect(() => {
		let ignore = false;

		const checkSession = async () => {
			await new Promise((r) => setTimeout(r, 150));
			const { data } = await supabase.auth.getSession();
			if (!ignore && data.session) {
				router.push("/room/create");
			}
		};

		checkSession();

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				if (!ignore && session) {
					router.push("/room/create");
				}
			},
		);

		return () => {
			ignore = true;
			listener.subscription.unsubscribe();
		};
	}, [router]);

	return (
		<div className="flex h-screen items-center justify-center">
			<Button
				onClick={() =>
					supabase.auth.signInWithOAuth({
						provider: "google",
						options: { redirectTo: "http://localhost:3000/auth/callback" },
					})
				}
			>
				Continue with Google
			</Button>
		</div>
	);
}
