'use server';

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

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

  // 1️⃣ Update ready state in DB
  const { error } = await supabaseAdmin
    .from("room_players")
    .update({ is_ready: true })
    .eq("room_id", room_id)
    .eq("user_id", user_id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 2️⃣ Broadcast update so frontend updates instantly
  const realtime = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  await realtime.channel(`room-${room_id}`).send({
    type: "broadcast",
    event: "player_ready",
    payload: { user_id },
  });

  return res.status(200).json({ success: true });
}
