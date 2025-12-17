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

  // 1️⃣ Fetch room
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id, ends_at")
    .eq("id", room_id)
    .single();

  if (!room) {
    return res.status(400).json({ error: "Room not found" });
  }

  // 2️⃣ Check expiration
  if (room.ends_at && new Date(room.ends_at) < new Date()) {
    return res.status(410).json({ error: "Room has expired" });
  }

  // 3️⃣ Upsert player
  await supabaseAdmin.from("room_players").upsert({
    room_id,
    user_id,
    is_host: false,
    last_active_at: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, roomId: room_id });
}
