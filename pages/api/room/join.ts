import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id, user_id } = req.body;

  if (!room_id || !user_id) {
    return res.status(400).json({ error: "Missing room_id or user_id" });
  }

  // ✅ Validate 6‑char alphanumeric room code
  const roomCodeRegex = /^[A-Z0-9]{6}$/;
  if (!roomCodeRegex.test(room_id)) {
    return res.status(400).json({ error: "Invalid room code format" });
  }

  // 1️⃣ Check if room exists
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id")
    .eq("id", room_id)
    .single();

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  // 2️⃣ Upsert player into room
  await supabaseAdmin.from("room_players").upsert({
    room_id,
    user_id,
    is_host: false,
    last_active_at: new Date().toISOString(),
  });

  return res.status(200).json({
    success: true,
    roomId: room_id,
  });
}
