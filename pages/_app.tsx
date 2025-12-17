// pages/_app.tsx
import type { AppProps } from "next/app";
import "../styles/globals.css";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase"; // adjust if named differently

export default function App({ Component, pageProps }: AppProps) {
	const router = useRouter();

	useEffect(() => {
		const check = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			const protectedRoutes = ["/room/create"];

			if (!session && protectedRoutes.includes(router.pathname)) {
				router.push("/auth");
			}
		};

		check();
	}, [router.pathname]);

	return <Component {...pageProps} />;
}
