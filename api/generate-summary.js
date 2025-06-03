// /api/generate-summary.js
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  const onboarding = req.body;

  try {
    // Build prompt with explicit instructions
    const prompt = `
You are a fitness coach helping an AI generate personalized workout plans.

Take the following user onboarding data and write a concise summary paragraph in plain English that includes ALL key information. The paragraph should read like an instruction to a personal trainer building a plan — include age, gender, weight, fitness level, available days, training goals, equipment access, and injuries or limitations.

User Onboarding Data:
${JSON.stringify(onboarding, null, 2)}

Your output should be one paragraph.
    `.trim();

    // Call GPT-3.5
    const chat = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: "You are an expert fitness plan assistant.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const summary = chat.choices[0].message.content.trim();

    res.status(200).json({ summary });

  } catch (err) {
    console.error("Summary generation failed:", err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
}
