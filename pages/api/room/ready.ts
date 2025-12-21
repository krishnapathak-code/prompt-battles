import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id, user_id, is_ready } = req.body;

  if (!room_id || !user_id || typeof is_ready !== "boolean") {
    return res.status(400).json({ error: "Missing params" });
  }

  // ❗ Never allow host readiness to change
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("is_host")
    .eq("room_id", room_id)
    .eq("user_id", user_id)
    .single();

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  if (player.is_host) {
    return res.status(200).json({ success: true });
  }

  const { error } = await supabaseAdmin
    .from("room_players")
    .update({ is_ready })
    .eq("room_id", room_id)
    .eq("user_id", user_id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    is_ready,
  });
}
