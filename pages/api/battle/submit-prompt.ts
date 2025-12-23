import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    // 1. ADDED: Destructure battle_id from the request body
    const { prompt_text, user_id, round_id, battle_id } = req.body;

    // 2. MODIFIED: Validation to include battle_id
    if (typeof prompt_text !== "string" || !user_id || !round_id || !battle_id) {
        return res
            .status(400)
            .json({ error: "Missing prompt_text, user_id, round_id, or battle_id" });
    }

    // 3. MODIFIED: Insert battle_id into the database
    const { error } = await supabaseAdmin.from("prompts").upsert(
        {
            prompt_text,
            user_id,
            round_id,
            battle_id, // <--- This links the prompt to the specific game session
        },
        { onConflict: "round_id,user_id" }
    );

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
}