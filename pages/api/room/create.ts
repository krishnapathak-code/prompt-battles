import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 6‑char alphanumeric generator
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, user_id, total_rounds } = req.body;

  if (!title || !user_id) {
    return res.status(400).json({ error: "Missing title or user_id" });
  }

  // ✅ Clamp total_rounds (server‑side safety)
  const rounds =
    typeof total_rounds === "number"
      ? Math.min(10, Math.max(1, total_rounds))
      : 3;

  let roomId: string | null = null;
  const now = new Date().toISOString();

  // Retry a few times in the extremely rare case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();

    const { data, error } = await supabaseAdmin
      .from("rooms")
      .insert({
        id: roomCode,
        title,
        host_id: user_id,
        current_round: 1,
        total_rounds: rounds, // 👈 IMPORTANT LINE
        started_at: now,
      })
      .select()
      .single();

    if (!error && data) {
      roomId = data.id;

      // Insert host into room_players
      await supabaseAdmin.from("room_players").insert({
        room_id: roomCode,
        user_id,
        is_host: true,
        is_ready: true,
        last_active_at: now,
      });

      break;
    }
  }

  if (!roomId) {
    return res.status(500).json({ error: "Failed to create room" });
  }

  return res.status(200).json({ roomId });
}
