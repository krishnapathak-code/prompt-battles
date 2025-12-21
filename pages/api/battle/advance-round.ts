import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id } = req.body; // user_id not strictly needed if we remove host check

  if (!room_id) {
    return res.status(400).json({ error: "Missing room_id" });
  }

  try {
    /* ---------------- 1. READ ROOM STATE ---------------- */
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("current_round, total_rounds")
      .eq("id", room_id)
      .single();

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // 🔥 SAFETY CHECK:
    // Check if a round for 'current_round + 1' ALREADY exists.
    // This prevents 4 players from creating 4 identical rounds.
    const nextRoundNum = room.current_round + 1;
    
    const { data: existingRound } = await supabaseAdmin
      .from("rounds")
      .select("id")
      .eq("room_id", room_id)
      .eq("round_number", nextRoundNum)
      .single();

    if (existingRound) {
      console.log("Round already created by another player, skipping...");
      return res.status(200).json({ message: "Round already advanced" });
    }

    /* ---------------- 2. CHECK GAME FINISHED ---------------- */
    if (nextRoundNum > room.total_rounds) {
      await supabaseAdmin.channel(`room-phase-${room_id}`).send({
        type: "broadcast",
        event: "game_finished",
        payload: {},
      });
      return res.status(200).json({ finished: true });
    }

    /* ---------------- 3. GET IMAGE ---------------- */
    const { data: images } = await supabaseAdmin
      .from("images")
      .select("id, url");

    if (!images || images.length === 0) {
      return res.status(500).json({ error: "No images available" });
    }

    const image = images[Math.floor(Math.random() * images.length)];

    /* ---------------- 4. UPDATE ROOM ---------------- */
    // We increment the room counter here
    await supabaseAdmin
      .from("rooms")
      .update({ current_round: nextRoundNum })
      .eq("id", room_id);

    /* ---------------- 5. CREATE ROUND ---------------- */
    const { data: round, error: roundError } = await supabaseAdmin
      .from("rounds")
      .insert({
        room_id,
        round_number: nextRoundNum,
        image_id: image.id,
      })
      .select()
      .single();

    if (roundError) {
      // If error is unique constraint violation, it means another player beat us to it.
      // That is fine, we just ignore it.
      return res.status(200).json({ message: "Race condition handled" });
    }

    /* ---------------- 6. BROADCAST ---------------- */
    await supabaseAdmin.channel(`room-phase-${room_id}`).send({
      type: "broadcast",
      event: "phase_update",
      payload: {
        phase: "submission",
        time: 60,
        image_url: image.url,
        round_id: round.id,
        round_number: nextRoundNum,
      },
    });

    return res.status(200).json({ success: true, round: nextRoundNum });

  } catch (err: any) {
    console.error("ADVANCE_ROUND: Critical Error", err);
    return res.status(500).json({ error: err.message });
  }
}
