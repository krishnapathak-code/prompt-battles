"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function CreateRoom() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [title, setTitle] = useState("");
	const [userId, setUserId] = useState<string | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => {
			if (!data.session) router.push("/auth");
			setUserId(data.session?.user?.id || null);
		});
	}, []);

	const createRoom = async () => {
		if (!userId) return;

		setLoading(true);

		const res = await fetch("/api/room/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title, user_id: userId }),
		});

		const json = await res.json(); //hello

		if (json.roomId) router.push(`/room/${json.roomId}`);

		setLoading(false);
	};

	return (
		<div className="flex flex-col gap-4 max-w-md mx-auto mt-20">
			<input
				className="border rounded p-2"
				placeholder="Enter room name..."
				value={title}
				onChange={(e) => setTitle(e.target.value)}
			/>

			<Button onClick={createRoom} disabled={loading}>
				{loading ? "Creating..." : "Create Room"}
			</Button>
		</div>
	);
}
