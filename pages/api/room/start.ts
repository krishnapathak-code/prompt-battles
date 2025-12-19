import { createClient } from "@supabase/supabase-js";
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

/* --------------------------------------------------
 1️⃣ VERIFY CALLER IS HOST
 -------------------------------------------------- */
const { data: player, error: playerErr } = await supabaseAdmin
 .from("room_players")
 .select("is_host")
 .eq("room_id", room_id)
 .eq("user_id", user_id)
 .single();

if (playerErr || !player || !player.is_host) {
return res
 .status(403)
 .json({ error: "Only the host can start the battle" });
 }

/* --------------------------------------------------
 2️⃣ CHECK ALL NON-HOST PLAYERS ARE READY
 -------------------------------------------------- 
const { data: players, error: playersErr } = await supabaseAdmin
 .from("room_players")
 .select("is_ready, is_host")
 .eq("room_id", room_id);

if (playersErr || !players?.length) {
return res.status(400).json({ error: "No players found in room" });
 }

// Only non-host players must be ready
const nonHostPlayers = players.filter((p) => !p.is_host);

const allReady =
nonHostPlayers.every((p) => p.is_ready);

if (!allReady) {
return res.status(400).json({
error: "All non-host players must be ready before starting",
 });
 }*/

/* --------------------------------------------------
 3️⃣ PICK RANDOM IMAGE
 -------------------------------------------------- */
const { data: images, error: imgErr } = await supabaseAdmin
 .from("images")
 .select("*");

if (imgErr || !images?.length) {
return res.status(400).json({ error: "No images found" });
 }

const randomImage = images[Math.floor(Math.random() * images.length)];

/* --------------------------------------------------
 4️⃣ CREATE NEW ROUND
 -------------------------------------------------- */
const { data: roundData, error: roundErr } = await supabaseAdmin
 .from("rounds")
 .insert({
room_id,
image_id: randomImage.id,
 })
 .select()
 .single();

if (roundErr) {
return res.status(400).json({ error: roundErr.message });
 }

/* --------------------------------------------------
 5️⃣ UPDATE ROOM STATUS
 -------------------------------------------------- */
await supabaseAdmin
 .from("rooms")
 .update({ status: "submission" })
 .eq("id", room_id);

/* --------------------------------------------------
 6️⃣ REALTIME BROADCAST
 -------------------------------------------------- */
const realtime = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
 );

await realtime.channel(`room-phase-${room_id}`).send({
type: "broadcast",
event: "phase_update",
payload: {
phase: "submission",
time: 30,
image_url: randomImage.url,
round_id: roundData.id,
 },
 });

/* --------------------------------------------------
 7️⃣ RESPONSE TO FRONTEND
 -------------------------------------------------- */
return res.status(200).json({
message: "Battle started",
round_id: roundData.id,
image_url: randomImage.url,
 });
}