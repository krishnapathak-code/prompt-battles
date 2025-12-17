import { GoogleGenAI } from "@google/genai";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		const ai = new GoogleGenAI({
			apiKey: process.env.GEMINI_API_KEY!,
		});

		const result = await ai.models.generateContent({
			model: "gemini-2.5-flash-lite",
			contents: [{ text: "Say 'Gemini works!'" }],
		});

		// ✅ Extract text correctly (GenAI style — no .text() available)
		const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

		return res.status(200).json({
			success: true,
			reply,
		});
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			error: err.message,
		});
	}
}
