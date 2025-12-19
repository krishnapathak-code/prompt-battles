"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/* ---------------- TYPES ---------------- */

type Player = {
  user_id: string;
  is_host?: boolean;
  is_ready?: boolean;
  name?: string;
};

type PromptResult = {
  id: string;
  prompt_text: string;
  scores?: number;
  justification?: string;
  user_id: string;
};

/* ---------------- COMPONENT ---------------- */

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const roomId = typeof id === "string" ? id : null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [battlePhase, setBattlePhase] = useState<
    "waiting" | "submission" | "results"
  >("waiting");
  const [timeLeft, setTimeLeft] = useState(60);
  const [imageURL, setImageURL] = useState<string | null>(null);

  const [promptText, setPromptText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [results, setResults] = useState<PromptResult[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);

  /* ---------------- AUTH ---------------- */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  /* ---------------- ENSURE PLAYER ROW ---------------- */

  useEffect(() => {
    if (!roomId || !userId) return;

    const ensurePlayer = async () => {
      const { data } = await supabase
        .from("room_players")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (!data) {
        await supabase.from("room_players").insert({
          room_id: roomId,
          user_id: userId,
          is_ready: false,
          is_host: false,
        });
      }
    };

    ensurePlayer();
  }, [roomId, userId]);

  /* ---------------- PLAYERS + REALTIME ---------------- */

  useEffect(() => {
    if (!roomId) return;

    const loadPlayers = async () => {
      const { data } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomId);
      setPlayers(data || []);
    };

    loadPlayers();

    const playersChannel = supabase
      .channel(⁠ room-${roomId} ⁠)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: ⁠ room_id=eq.${roomId} ⁠,
        },
        (payload) => {
          const updated = payload.new as Player;
          setPlayers((prev) => [
            ...prev.filter((p) => p.user_id !== updated.user_id),
            updated,
          ]);
        }
      )
      .subscribe();

    const phaseChannel = supabase
      .channel(⁠ room-phase-${roomId} ⁠)
      .on("broadcast", { event: "phase_update" }, (payload) => {
        setBattlePhase(payload.payload.phase);
        setTimeLeft(payload.payload.time);
        setImageURL(payload.payload.image_url);
        setCurrentRoundId(payload.payload.round_id);
        setPromptText("");
        setSubmitted(false);
      })
      .on("broadcast", { event: "results_ready" }, async (payload) => {
        setLoadingEval(false);

        const { data } = await supabase
          .from("prompts")
          .select("id, prompt_text, scores, justification, user_id")
          .eq("round_id", payload.payload.round_id)
          .order("scores", { ascending: false });

        setResults((data as PromptResult[]) || []);
        setBattlePhase("results");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(phaseChannel);
    };
  }, [roomId]);

  /* ---------------- DERIVED STATE ---------------- */

  const me = players.find((p) => p.user_id === userId);
  const isHost = me?.is_host === true;
  const isReady = me?.is_ready === true;

  const nonHostPlayers = players.filter((p) => !p.is_host);
  const allPlayersReady =
    nonHostPlayers.length > 0 &&
    nonHostPlayers.every((p) => p.is_ready === true);

  const myResult = results.find((r) => r.user_id === userId);

  /* ---------------- TIMER ---------------- */

  useEffect(() => {
    if (battlePhase === "waiting") return;

    setTimeLeft(60);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          if (battlePhase === "submission") {
            setLoadingEval(true);
            fetch("/api/battle/score-prompts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                room_id: roomId,
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
  }, [battlePhase, roomId, currentRoundId, imageURL]);

  /* ---------------- UI ---------------- */

  return (
    <div className="p-6 max-w-6xl mx-auto flex gap-6">
      {/* PLAYERS */}
      <div className="w-64 border rounded-lg p-4 h-fit">
        <h2 className="font-semibold mb-3 text-lg">Players</h2>
        {players.map((p) => (
          <div
            key={p.user_id}
            className="flex items-center gap-2 mb-2 border p-2 rounded"
          >
            <div className="w-8 h-8 rounded-full bg-gray-300" />
            <span>
              {p.name || "Player"} {p.is_host && "(host)"} {p.is_ready && "✔"}
            </span>
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div className="flex-1 border rounded-lg p-6 flex flex-col items-center">
        {battlePhase !== "results" && (
          <div className="text-4xl font-bold mb-4">{timeLeft}s</div>
        )}

        {imageURL && (
          <img
            src={imageURL}
            alt="Round"
            className="w-full max-w-md rounded-lg border mb-4"
          />
        )}

        {/* WAITING */}
        {battlePhase === "waiting" && (
          <div className="flex flex-col items-center gap-3">
            {!isHost && (
              <Button
                disabled={isReady}
                onClick={() =>
                  fetch("/api/room/ready", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ room_id: roomId, user_id: userId }),
                  })
                }
              >
                {isReady ? "Ready ✔" : "Mark Ready"}
              </Button>
            )}

            {isHost && (
              <>
                <Button
                  disabled={!allPlayersReady}
                  onClick={() =>
                    fetch("/api/room/start", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ room_id: roomId, user_id: userId }),
                    })
                  }
                >
                  Start Battle
                </Button>

                {!allPlayersReady && (
                  <p className="text-sm text-gray-500">
                    Waiting for all players to be ready…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* SUBMISSION */}
        {battlePhase === "submission" && (
          <div className="w-full max-w-xl flex flex-col gap-3">
            <textarea
              className="border rounded p-3 w-full min-h-[120px]"
              placeholder="Write your prompt here..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />

            <Button
              disabled={!promptText || submitted}
              onClick={() => {
                setSubmitted(true);
                fetch("/api/battle/submit-prompt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    room_id: roomId,
                    round_id: currentRoundId,
                    user_id: userId,
                    prompt_text: promptText,
                  }),
                });
              }}
            >
              {submitted ? "Submitted ✔" : "Submit Prompt"}
            </Button>
          </div>
        )}

        {/* RESULTS */}
        {battlePhase === "results" && !loadingEval && (
          <div className="w-full max-w-xl">
            <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>

            {results.map((r, i) => (
              <div
                key={r.id}
                className="p-3 border rounded mb-3 flex justify-between"
              >
                <span>{i + 1}. Player</span>
                <span className="font-bold">{r.scores}</span>
              </div>
            ))}

            {myResult && (
              <>
                <h3 className="text-xl font-semibold mt-6 mb-2">
                  Your Feedback
                </h3>
                <div className="p-3 border rounded">
                  <p className="font-semibold">Score: {myResult.scores}</p>
                  <p>{myResult.justification}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
