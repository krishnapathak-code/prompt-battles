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
	if (req.method !== "POST")
		return res.status(405).json({ error: "Method not allowed" });

	const { room_id, round_id, image_url } = req.body;

	if (!room_id || !round_id || !image_url)
		return res
			.status(400)
			.json({ error: "Missing room_id, round_id or image_url" });

	const { data: prompts, error: promptErr } = await supabaseAdmin
		.from("prompts")
		.select("id, prompt_text, user_id")
		.eq("round_id", round_id);

	if (promptErr) return res.status(500).json({ error: promptErr.message });
	if (!prompts?.length)
		return res.status(400).json({ error: "No prompts found" });

	const promptList = prompts
		.map(
			(p, i) =>
				`Prompt ${i + 1}:\nID: ${p.id}\nUser: ${p.user_id}\nText: "${p.prompt_text}"`,
		)
		.join("\n\n");

	const instructions = `

Task: Given an image and multiple prompts, score each prompt 0–100 based on how well it matches the image.
Rules:
Judge how likely is this prompt to generate a similar image in a text‑to‑image model?
You must include a contructive feedback to improve the prompt
The feeback must include specific details from the image
Higher score = closer match.
Return ONLY JSON:
[
  {
    "user_id": "...",
    "prompt_id": "...",
    "score": <0-100>,
    "reason": "<short explanation>"
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

	let geminiResult;

	try {
		geminiResult = await ai.models.generateContent({
			model: "gemini-2.5-flash-lite",
			contents,
		});
	} catch (err: any) {
		return res.status(500).json({
			error: "Gemini API call failed: " + err.message,
		});
	}

	let text = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

	text = text
		.replace(/```json/g, "")
		.replace(/```/g, "")
		.trim();

	let evaluations;

	try {
		evaluations = JSON.parse(text);
	} catch {
		return res.status(500).json({
			error: "Gemini did not return valid JSON",
			raw: text,
		});
	}

	for (const ev of evaluations) {
		await supabaseAdmin
			.from("prompts")
			.update({
				scores: ev.score,
				justification: ev.reason,
			})
			.eq("id", ev.prompt_id);
	}

	await supabaseAdmin.channel(`room-phase-${room_id}`).send({
		type: "broadcast",
		event: "results_ready",
		payload: { round_id },
	});

	return res.status(200).json({
		success: true,
		evaluations,
	});
}
