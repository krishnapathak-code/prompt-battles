"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function JoinRoom() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth");
      setUserId(data.user?.id || null);
    });
  }, []);

  const joinRoom = async () => {
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("Room code must be 6 digits.");
      return;
    }

    if (!userId) {
      setError("You must be logged in.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: code,
          user_id: userId,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Failed to join room.");
      } else {
        router.push(`/room/${json.roomId}`);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-bold">Join a Room</h1>

      <input
        className="border rounded p-2"
        placeholder="Enter 6‑digit room code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={joinRoom} disabled={loading}>
        {loading ? "Joining..." : "Join Room"}
      </Button>
    </div>
  );
}

