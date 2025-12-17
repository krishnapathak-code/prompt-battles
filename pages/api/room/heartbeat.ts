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

  await supabaseAdmin
    .from("room_players")
    .update({
      last_active_at: new Date().toISOString(),
    })
    .eq("room_id", room_id)
    .eq("user_id", user_id);

  return res.status(200).json({ success: true });
}
