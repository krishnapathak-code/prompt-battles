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

  /* ---------------- HOST CHECK ---------------- */
  const { data: hostRow } = await supabaseAdmin
    .from("room_players")
    .select("is_host")
    .eq("room_id", room_id)
    .eq("user_id", user_id)
    .single();

 /* if (!hostRow?.is_host) {
    return res.status(403).json({ error: "Only host can start the round" });
  }*/

  /* ---------------- ROOM STATE ---------------- */
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("current_round, total_rounds")
    .eq("id", room_id)
    .single();

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (room.current_round > room.total_rounds) {
    return res.status(400).json({ error: "Game already finished" });
  }

  /* ---------------- READINESS (ONLY ROUND 1) ---------------- */
  if (room.current_round === 1) {
    const { data: players } = await supabaseAdmin
      .from("room_players")
      .select("is_ready, is_host")
      .eq("room_id", room_id);

    const nonHostPlayers = players?.filter((p) => !p.is_host) ?? [];
    const allReady =
      nonHostPlayers.length === 0 ||
      nonHostPlayers.every((p) => p.is_ready);

    if (!allReady) {
      return res.status(400).json({
        error: "All non-host players must be ready before starting",
      });
    }
  }

  /* ---------------- RANDOM IMAGE ---------------- */
  const { data: images } = await supabaseAdmin
    .from("images")
    .select("id, url");

  const randomImage = images![Math.floor(Math.random() * images!.length)];

  /* ---------------- CREATE ROUND ---------------- */
  const { data: round } = await supabaseAdmin
    .from("rounds")
    .insert({
      room_id,
      round_number: room.current_round,
      image_id: randomImage.id,
    })
    .select()
    .single();

  /* ---------------- BROADCAST PHASE ---------------- */
  await supabaseAdmin.channel(`room-phase-${room_id}`).send({
    type: "broadcast",
    event: "phase_update",
    payload: {
      phase: "submission",
      time: 60,
      image_url: randomImage.url,
      round_id: round.id,
      round_number: room.current_round,
    },
  });

  return res.status(200).json({
    success: true,
    round_id: round.id,
    round_number: room.current_round,
    image_url: randomImage.url,
  });
}
