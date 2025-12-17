import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models",
      {
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
      }
    );

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
