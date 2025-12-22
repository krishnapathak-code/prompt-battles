import { GoogleGenAI } from "@google/genai";
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room_id, round_id, image_url } = req.body;

  if (!room_id || !round_id || !image_url) {
    return res.status(400).json({
      error: "Missing room_id, round_id or image_url",
    });
  }

  console.log("🔥 SCORE PROMPTS HIT", { room_id, round_id });

  /* ---------------- 1. FETCH ALL PROMPTS ---------------- */
  const { data: prompts, error: promptErr } = await supabaseAdmin
    .from("prompts")
    .select("id, prompt_text, user_id")
    .eq("round_id", round_id);

  if (promptErr) {
    return res.status(500).json({ error: promptErr.message });
  }

  if (!prompts || prompts.length === 0) {
    return res.status(200).json({ message: "No prompts to score." });
  }
  
  const validPrompts = prompts.filter(p => p.prompt_text && p.prompt_text.trim().length > 0);
  const emptyPrompts = prompts.filter(p => !p.prompt_text || p.prompt_text.trim().length === 0);

  let aiEvaluations: any[] = [];

  /* ---------------- 3. CALL GEMINI (Only for Valid Prompts) ---------------- */
  
  if (validPrompts.length > 0) {
    const promptList = validPrompts
      .map(
        (p, i) =>
          `Prompt ${i + 1}:\nID: ${p.id}\nUser: ${p.user_id}\nText: "${p.prompt_text}"`,
      )
      .join("\n\n");

    const instructions = `
Task: Given an image and multiple prompts, score each prompt 0–100 based on how well it matches the image.

Rules:
- Judge how likely the prompt would recreate a similar image in a text-to-image model
- Higher score = closer match
- Include constructive feedback with specific image details

Return ONLY valid JSON:
[
  {
    "user_id": "...",
    "prompt_id": "...",
    "score": 0-100,
    "reason": "short explanation"
  }
]
`;

    const contents = [
      {
        role: "user",
        parts: [
          { text: instructions },
          { fileData: { mimeType: "image/jpeg", fileUri: image_url } },
          { text: "Prompts:\n" + promptList },
        ],
      },
    ];

    try {
      const geminiResult = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite", 
        contents,
      });

      let text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      aiEvaluations = JSON.parse(text);

    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return res.status(500).json({ error: "Gemini calculation failed" });
    }
  }

  /* ---------------- 4. MERGE RESULTS ---------------- */

  const emptyEvaluations = emptyPrompts.map(p => ({
    user_id: p.user_id,
    prompt_id: p.id,
    score: 0,
    reason: "No prompt submitted in time."
  }));

  const allEvaluations = [...aiEvaluations, ...emptyEvaluations];

  /* ---------------- 5. SAVE RESULTS ---------------- */

  for (const ev of allEvaluations) {
    //  Save score to prompt row
    await supabaseAdmin
      .from("prompts")
      .update({
        scores: ev.score,
        justification: ev.reason,
      })
      .eq("id", ev.prompt_id);

    //  Reset Player Ready State (Safe Update)
    await supabaseAdmin
      .from("room_players")
      .update({ is_ready: false }) 
      .eq("room_id", room_id)
      .eq("user_id", ev.user_id);

    //  Increment Score
    const { error } = await supabaseAdmin.rpc(
      "increment_player_score",
      {
        p_room_id: room_id,
        p_user_id: ev.user_id,
        p_score: ev.score,
      },
    );

    if (error) {
      console.error("❌ increment_player_score failed", error);
    }
  }

  /* ---------------- 6. BROADCAST ---------------- */

  await supabaseAdmin
    .channel(`room-phase-${room_id}`)
    .send({
      type: "broadcast",
      event: "results_ready",
      payload: { round_id },
    });

  return res.status(200).json({
    success: true,
    evaluations: allEvaluations,
  });
}
