'use server';
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id, user_id } = req.body;

  // Validate input
  if (!room_id || !user_id) {
    return res.status(400).json({ error: "Missing room_id or user_id" });
  }

  try {
    // 1️⃣ Update ready state in DB
    const { error: updateError } = await supabaseAdmin
      .from("room_players")
      .update({ is_ready: true })
      .eq("room_id", room_id)
      .eq("user_id", user_id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // 2️⃣ Broadcast realtime update
    const realtime = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = realtime.channel(`room-${room_id}`);

    await channel.send({
      type: "broadcast",
      event: "player_ready",
      payload: { user_id },
    });

    // 3️⃣ Success response
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("READY API ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
