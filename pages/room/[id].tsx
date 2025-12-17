"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type Player = {
	id: string;
	name?: string;
	user_id?: string;
};

type PromptResult = {
	id: string;
	prompt_text: string;
	scores?: number;
	justification?: string;
	user_id: string;
};

type Room = { title: string };

export default function RoomPage() {
	const router = useRouter();
	const { id } = router.query;

	const [room, setRoom] = useState<Room>({ title: "Loading..." });
	const [players, setPlayers] = useState<Player[]>([]);
	const [battlePhase, setBattlePhase] = useState("waiting");
	const [timeLeft, setTimeLeft] = useState(30);
	const [imageURL, setImageURL] = useState<string | null>(null);
	const [promptText, setPromptText] = useState("");
	const [results, setResults] = useState<PromptResult[]>([]);
	const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;

		setRoom({ title: "My Awesome Room" });

		const fetchUser = async () => {
			const { data } = await supabase.auth.getUser();
			setUserId(data.user?.id || null);
		};
		fetchUser();

		const playerChannel = supabase
			.channel(`room-${id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "room_players",
					filter: `room_id=eq.${id}`,
				},
				(payload) => {
					if (payload.eventType === "INSERT") {
						const newPlayer = payload.new as Player;
						setPlayers((prev) => [
							...prev.filter((p) => p.id !== newPlayer.id),
							newPlayer,
						]);
					}
				},
			)
			.subscribe();

		const phaseChannel = supabase
			.channel(`room-phase-${id}`)
			.on("broadcast", { event: "phase_update" }, (payload) => {
				setBattlePhase(payload.payload.phase);
				setTimeLeft(payload.payload.time);
				setImageURL(payload.payload.image_url);
				setCurrentRoundId(payload.payload.round_id);
			})
			.on("broadcast", { event: "results_ready" }, async (payload) => {
				const roundId = payload.payload.round_id;

				const { data } = await supabase
					.from("prompts")
					.select("id, prompt_text, scores, justification, user_id")
					.eq("round_id", roundId)
					.order("scores", { ascending: false });

				setResults((data as PromptResult[]) || []);
				setBattlePhase("results");
			})
			.subscribe();

		return () => {
			supabase.removeChannel(playerChannel);
			supabase.removeChannel(phaseChannel);
		};
	}, [id]);

	useEffect(() => {
		if (battlePhase === "waiting") return;

		setTimeLeft(30);

		const interval = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					clearInterval(interval);

					if (battlePhase === "submission") {
						fetch("/api/battle/score-prompts", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								room_id: id,
								round_id: currentRoundId,
								image_url: imageURL,
							}),
						});
					}

					return 0;
				}

				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [battlePhase]);

	return (
		<div className="p-6 max-w-5xl mx-auto">
			<div className="flex justify-between items-center border-b pb-4 mb-6">
				<div>
					<h1 className="text-3xl font-bold">Room: {room.title}</h1>
					<p className="text-gray-500 text-sm">Room ID: {id}</p>
				</div>

				<Button variant="destructive" onClick={() => router.push("/auth")}>
					Leave Room
				</Button>
			</div>

			<div className="flex gap-6">
				<div className="w-64 border rounded-lg p-4 h-fit">
					<h2 className="font-semibold mb-3 text-lg">Players</h2>

					{players.length === 0 ? (
						<p className="text-sm text-gray-500">Waiting for players…</p>
					) : (
						players.map((p) => (
							<div
								key={p.id}
								className="flex items-center gap-2 mb-2 border p-2 rounded"
							>
								<div className="w-8 h-8 rounded-full bg-gray-300" />
								<span>{p.name || "Unnamed Player"}</span>
							</div>
						))
					)}
				</div>

				<div className="flex-1 border rounded-lg p-6">
					{imageURL && (
						<img
							src={imageURL}
							alt="Round"
							className="w-full max-w-md rounded-lg border mb-4"
						/>
					)}

					{battlePhase === "submission" && (
						<div className="mb-6">
							<textarea
								className="w-full border rounded p-3 text-sm"
								rows={3}
								placeholder="Type your prompt here..."
								value={promptText}
								onChange={(e) => setPromptText(e.target.value)}
							/>

							<Button
								className="mt-3"
								onClick={async () => {
									if (!currentRoundId) return;
									if (!userId) return alert("User not logged in");

									await fetch("/api/battle/submit-prompt", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											room_id: id,
											round_id: currentRoundId,
											user_id: userId,
											prompt_text: promptText,
										}),
									});

									setPromptText("");
								}}
							>
								Submit Prompt
							</Button>
						</div>
					)}

					{battlePhase === "results" && (
						<div className="mb-6">
							{results.map((r, i) => (
								<div
									key={r.id}
									className={`p-3 border rounded mb-3 ${
										i === 0 ? "bg-yellow-100 border-yellow-400" : ""
									}`}
								>
									<p className="font-semibold">
										{i + 1}. Score: {r.scores}
									</p>
									<p>{r.prompt_text}</p>
									<p className="text-sm text-gray-500 mt-1">
										{r.justification}
									</p>
								</div>
							))}
						</div>
					)}

					<div className="mb-6 border rounded-lg p-4 bg-gray-50">
						<h3 className="font-semibold mb-2">Battle Status</h3>
						<p className="mb-2">
							Current Phase:{" "}
							<span className="font-medium">{battlePhase.toUpperCase()}</span>
						</p>
						<div className="text-4xl font-bold text-center py-4">
							{timeLeft}s
						</div>
					</div>

					<Button
						onClick={async () => {
							const response = await fetch(`/api/battle/start?room_id=${id}`, {
								method: "POST",
							});
							const result = await response.json();
							setCurrentRoundId(result.round_id);
						}}
					>
						Start Battle (Host only)
					</Button>
				</div>
			</div>
		</div>
	);
}
