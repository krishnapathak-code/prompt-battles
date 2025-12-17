import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { title, user_id } = req.body;

  if (!title || !user_id)
    return res.status(400).json({ error: "Missing title or user_id" });

  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

  const { data, error } = await supabaseAdmin
    .from("rooms")
    .insert({
      id: roomCode,
      title,
      host_id: user_id,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ roomId: data.id });
}
