import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const room_id = req.query.room_id;
  if (!room_id)
    return res.status(400).json({ error: "Missing room_id" });
  // 1. PICK RANDOM IMAGE FROM THE DATABASE
  const { data: images, error: imgErr } = await supabaseAdmin
    .from("images")
    .select("*");
  if (imgErr || !images?.length)
    return res.status(400).json({ error: "No images found" });
  const randomImage = images[Math.floor(Math.random() * images.length)];
  // 2. CREATE NEW ROUND
  const { data: roundData, error: roundErr } = await supabaseAdmin
    .from("rounds")
    .insert({ room_id, image_id: randomImage.id })
    .select()
    .single();
  if (roundErr)
    return res.status(400).json({ error: roundErr.message });
  // 3. UPDATE ROOM STATUS → submission mode
  await supabaseAdmin
    .from("rooms")
    .update({ status: "submission" })
    .eq("id", room_id);
  // 4. SEND REALTIME UPDATE USING CLIENT SUPABASE (NOT ADMIN)
  const realtime = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await realtime
    .channel(`room-phase-${room_id}`)
    .send({
      type: "broadcast",
      event: "phase_update",
      payload: {
        phase: "submission",
        time: 30,
        image_url: randomImage.url,
        round_id: roundData.id,
      },
    });
  // 5. RETURN ROUND INFO TO FRONTEND
  return res.status(200).json({
    message: "Battle started",
    round_id: roundData.id,
    image_url: randomImage.url,
  });
}
