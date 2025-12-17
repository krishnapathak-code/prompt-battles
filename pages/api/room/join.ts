import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { room_id, user_id } = req.body;

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("id", room_id)
    .single();

  if (!room) return res.status(400).json({ error: "Room not found" });

  // Upsert player entry
  await supabaseAdmin.from("room_players").upsert({
    room_id,
    user_id,
    last_active_at: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, roomId: room_id });
}
