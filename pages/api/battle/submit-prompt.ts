import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { prompt_text, user_id, round_id } = req.body;

  if (!prompt_text || !user_id || !round_id)
    return res
      .status(400)
      .json({ error: "Missing prompt_text, user_id or round_id" });

  const { error } = await supabaseAdmin.from("prompts").insert({
    prompt_text,
    user_id,
    round_id,
  });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}
