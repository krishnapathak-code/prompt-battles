import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title, user_id } = req.body;

  if (!title || !user_id) {
    return res.status(400).json({ error: "Missing title or user_id" });
  }

  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();// //pehla comand git add . then git c tha git commit
  const now = new Date();
  const endsAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  // 1️⃣ Check if room code already exists
  const { data: existingRoom } = await supabaseAdmin
    .from("rooms")
    .select("id, ends_at")
    .eq("id", roomCode)
    .single();

  // 2️⃣ If room exists AND is still active → reject
  if (
    existingRoom &&
    existingRoom.ends_at &&
    new Date(existingRoom.ends_at) > now
  ) {
    return res.status(409).json({
      error: "Room code already in use",
    });
  }

  // 3️⃣ Create (or reuse) room
  const { data: room, error } = await supabaseAdmin
    .from("rooms")
    .upsert({
      id: roomCode,
      title,
      host_id: user_id,
      created_at: now.toISOString(),
      ends_at: endsAt,
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 4️⃣ Insert host into room_players
  await supabaseAdmin.from("room_players").upsert({
    room_id: roomCode,
    user_id,
    is_host: true,
    last_active_at: now.toISOString(),
  });

  return res.status(200).json({ roomId: room.id });
}
