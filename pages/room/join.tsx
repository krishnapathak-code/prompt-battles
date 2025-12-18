"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

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

    // ✅ Alphanumeric validation
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Room code must be 6 characters (A–Z, 0–9).");
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
        placeholder="Enter 6‑character room code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          const value = e.target.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, ""); // ✅ allow letters + numbers only
          setCode(value);
        }}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={joinRoom} disabled={loading}>
        {loading ? "Joining..." : "Join Room"}
      </Button>
    </div>
  );
}

