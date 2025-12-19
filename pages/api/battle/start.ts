import { createClient } from "@supabase/supabase-js";
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

  // 1️⃣ Check host permission
  const { data: player } = await supabaseAdmin
    .from("room_players")
    .select("is_host")
    .eq("room_id", room_id)
    .eq("user_id", user_id)
    .single();

  if (!player || !player.is_host) {
    return res.status(403).json({ error: "Only host can start the battle" });
  }

  // 2️⃣ Check readiness
  const { data: players } = await supabaseAdmin
    .from("room_players")
    .select("is_ready, is_host")
    .eq("room_id", room_id);

  const nonHostPlayers = players.filter((p) => !p.is_host);
  const allReady = nonHostPlayers.every((p) => p.is_ready);

  if (!allReady) {
    return res.status(400).json({
      error: "All non-host players must be ready before starting",
    });
  }

  // 3️⃣ Pick random image
  const { data: images } = await supabaseAdmin.from("images").select("*");

  const randomImage = images[Math.floor(Math.random() * images.length)];

  // 4️⃣ Create new round
  const { data: roundData, error: roundErr } = await supabaseAdmin
    .from("rounds")
    .insert({
      room_id,
      image_id: randomImage.id,
    })
    .select()
    .single();

  if (roundErr) {
    return res.status(400).json({ error: roundErr.message });
  }

  // 5️⃣ Update room status
  await supabaseAdmin
    .from("rooms")
    .update({ status: "submission" })
    .eq("id", room_id);

  // 6️⃣ Realtime broadcast (FIXED)
  const realtime = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const channel = realtime.channel(`room-phase-${room_id}`);
  await channel.subscribe();

  await channel.send({
    type: "broadcast",
    event: "phase_update",
    payload: {
      phase: "submission",
      time: 30,
      image_url: randomImage.url,
      round_id: roundData.id,
    },
  });

  // 7️⃣ Response
  return res.status(200).json({
    message: "Battle started",
    round_id: roundData.id,
    image_url: randomImage.url,
  });
}
