import { OpenAI } from 'openai';
import exercises from '../data/exercises.js'; // Make sure this file has your 75 exercises

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userAnswers = req.body;

  if (!userAnswers || typeof userAnswers !== 'object') {
    return res.status(400).json({ error: 'Invalid user input' });
  }

  const prompt = buildWorkoutPrompt(userAnswers, exercises);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const plan = completion.choices[0]?.message?.content || '';
    return res.status(200).json({ plan });

  } catch (err) {
    console.error('GPT error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

function buildWorkoutPrompt(user, exercises) {
  return `
You're a personal trainer creating a custom weekly workout plan for a user.

User Profile:
${JSON.stringify(user, null, 2)}

You can only use the following exercises (each includes name, muscle group, equipment, difficulty):
${exercises.map(e =>
  `• ${e.name} — ${e.muscle_group}, ${e.equipment}, ${e.difficulty}`
).join('\n')}

Design a ${user.exercise_frequency || 3}-day plan based on their fitness goal, experience level, available equipment, and any injuries or risks.

Be clear and organized. Label the days as "Day 1", "Day 2", etc. Each day should list 4–6 exercises with sets and reps. Avoid exercises that don’t match their input.
Only choose from the provided exercises.
  `;
}
