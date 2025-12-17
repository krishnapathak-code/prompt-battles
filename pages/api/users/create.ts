// pages/api/users/create.ts
// Purpose: Create a player row in the "players" table after Google login.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user } = req.body;

  if (!user || !user.id) {
    return res.status(400).json({ error: "Invalid user data" });
  }

  // Insert or update player record
  const { error } = await supabaseAdmin
    .from("players")
    .upsert({
      id: user.id,
      name: user.user_metadata.full_name || user.email,
      avatar: user.user_metadata.avatar_url || null,
      email: user.email,
    });

  if (error) {
    console.error("User create error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
