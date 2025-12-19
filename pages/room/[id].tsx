"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/* ---------------- TYPES ---------------- */

type Player = {
  id: string;
  user_id: string;
  is_host: boolean;
  is_ready: boolean;
};

type BattlePhase = "waiting" | "submission" | "results";

export default function RoomPage() {
  const router = useRouter();
  const roomId = typeof router.query.id === "string" ? router.query.id : null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>("waiting");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth");
      setUserId(data.user?.id || null);
    });
  }, [router]);

  useEffect(() => {
    if (!roomId) return;

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", roomId);

      setPlayers((data as Player[]) || []);
    };

    fetchPlayers();

    const playersChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Player | null;
          if (!row) return;

          setPlayers((prev) => {
            const existing = prev.find((p) => p.user_id === row.user_id);
            return [
              ...prev.filter((p) => p.user_id !== row.user_id),
              { ...existing, ...row },
            ];
          });
        }
      )
      .subscribe();

    const phaseChannel = supabase
      .channel(`room-phase-${roomId}`)
      .on("broadcast", { event: "phase_update" }, (payload) => {
        setBattlePhase(payload.payload.phase);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(phaseChannel);
    };
  }, [roomId]);

  const me = players.find((p) => p.user_id === userId);
  const isHost = !!me?.is_host;

  const nonHostPlayers = players.filter((p) => !p.is_host);

  // 🔥 FIXED: host can start when all non-hosts are ready
  const allReady = nonHostPlayers.every((p) => p.is_ready);

  const markReady = async () => {
    if (!roomId || !userId) return;

    await fetch("/api/room/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, user_id: userId }),
    });
  };

  const startBattle = async () => {
    if (!roomId || !userId) return;

    await fetch(`/api/room/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, user_id: userId }),
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Room</h1>
          <p className="text-gray-500 text-sm">Room ID: {roomId}</p>
        </div>
        <Button variant="destructive" onClick={() => router.push("/auth")}>
          Leave Room
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="w-64 border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Players</h2>
          {players.map((p) => (
            <div
              key={p.user_id}
              className="flex justify-between items-center mb-2 border p-2 rounded"
            >
              <span>Player {p.is_host && "⭐"}</span>
              <span>{p.is_ready ? "✅ Ready" : "⏳ Not Ready"}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 border rounded-lg p-6">
          {battlePhase === "waiting" && (
            <div className="flex gap-4">
              {!isHost && (
                <Button onClick={markReady} disabled={me?.is_ready}>
                  {me?.is_ready ? "Ready ✔" : "Mark Ready"}
                </Button>
              )}

              {isHost && (
                <Button onClick={startBattle} disabled={!allReady}>
                  Start Battle
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
