import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id, battle_id } = req.body;

  if (!room_id || !battle_id) {
    return res.status(400).json({ error: "Missing room_id or battle_id" });
  }

  try {
    /* ---------------- 1. READ BATTLE STATE ---------------- */
    const { data: battle } = await supabaseAdmin
      .from("battles")
      .select("current_round, total_rounds")
      .eq("id", battle_id)
      .single();

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    const nextRoundNum = battle.current_round + 1;

    // Race Condition Check
    const { data: existingRound } = await supabaseAdmin
      .from("rounds")
      .select("id")
      .eq("battle_id", battle_id)
      .eq("round_number", nextRoundNum)
      .single();

    if (existingRound) {
      return res.status(200).json({ message: "Round already advanced" });
    }

    /* ---------------- 2. CHECK GAME FINISHED ---------------- */
    if (nextRoundNum > battle.total_rounds) {
      
      // A. Mark battle as finished
      await supabaseAdmin
        .from("battles")
        .update({ status: 'finished' })
        .eq("id", battle_id);

      // B. [NEW] ARCHIVE SCORES TO HISTORY (battle_scores)
      // 1. Fetch current scores from the room
      const { data: currentScores } = await supabaseAdmin
        .from("player_scores")
        .select("user_id, total_score")
        .eq("room_id", room_id);

      if (currentScores && currentScores.length > 0) {
        // 2. Sort by score descending to determine Rank
        const sortedPlayers = currentScores.sort((a, b) => b.total_score - a.total_score);
        
        // 3. Prepare rows for insertion
        const historyRows = sortedPlayers.map((p, index) => ({
            battle_id: battle_id,
            user_id: p.user_id,
            total_score: p.total_score,
            rank: index + 1 // Rank 1 is highest score
        }));

        // 4. Insert into battle_scores
        const { error: historyError } = await supabaseAdmin
            .from("battle_scores")
            .insert(historyRows);

        if (historyError) console.error("Error saving history:", historyError);
      }

      // C. Broadcast Finish
      await supabaseAdmin.channel(`room-phase-${room_id}`).send({
        type: "broadcast",
        event: "game_finished",
        payload: { battle_id },
      });
      return res.status(200).json({ finished: true });
    }

    /* ---------------- 3. NEXT ROUND LOGIC (If not finished) ---------------- */
    
    // Get Image
    const { data: images } = await supabaseAdmin.from("images").select("id, url");
    const image = images![Math.floor(Math.random() * images!.length)];

    // Update Battle Counter
    await supabaseAdmin
      .from("battles")
      .update({ current_round: nextRoundNum })
      .eq("id", battle_id);

    // Create Round
    const { data: round } = await supabaseAdmin
      .from("rounds")
      .insert({
        room_id,
        battle_id,
        round_number: nextRoundNum,
        image_id: image.id,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Broadcast
    await supabaseAdmin.channel(`room-phase-${room_id}`).send({
      type: "broadcast",
      event: "phase_update",
      payload: {
        phase: "submission",
        time: 60,
        image_url: image.url,
        round_id: round.id,
        round_number: nextRoundNum,
        battle_id,
        total_rounds: battle.total_rounds
      },
    });

    return res.status(200).json({ success: true, round: nextRoundNum });

  } catch (err: any) {
    console.error("ADVANCE_ROUND Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
