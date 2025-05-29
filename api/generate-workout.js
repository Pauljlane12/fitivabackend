// /api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js'; // ✅ Corrected relative path

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;
  if (!user || typeof user !== 'object') {
    return res.status(400).json({ error: 'Invalid user input' });
  }

  const prompt = buildWorkoutPrompt(user, exercises);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const gptContent = completion.choices[0]?.message?.content || '';

    let planJSON;
    try {
      planJSON = JSON.parse(gptContent);
    } catch {
      planJSON = { raw_text: gptContent };
    }

    return res.status(200).json({ plan: planJSON });
  } catch (err) {
    console.error('GPT error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

function buildWorkoutPrompt(user, allExercises) {
  const exerciseLines = allExercises.map(e => {
    const desc = e.description ? e.description.replace(/\n+/g, ' ') : 'No description';
    const weight = e.default_weight ? ` @ ${e.default_weight}` : '';
    return `• ${e.name} — Muscle Group: ${e.muscle_group}, Equipment: ${e.equipment}, Difficulty: ${e.difficulty}, Tags: [${e.tags.join(', ')}], Description: ${desc}, Default: ${e.default_sets}x${e.default_reps}${weight}`;
  }).join('\n');

  const freq = user.exercise_frequency || 3;

  return `
You are a certified personal trainer designing a custom *${freq}-day-per-week* workout plan.

### USER PROFILE (JSON)
${JSON.stringify(user, null, 2)}

### EXERCISE CATALOG
(Choose ONLY from this list.)
${exerciseLines}

---

### INSTRUCTIONS
1. Match the user's goal, experience, equipment, injuries, and preferences.
2. Distribute volume across the week appropriately.
3. Avoid any exercise that conflicts with injuries or unavailable equipment.
4. Use defaults as guidelines but adjust sets/reps if justified.
5. Do **NOT** invent new exercises.

### REQUIRED OUTPUT (VALID JSON)
\`\`\`json
{
  "workout_plan": [
    {
      "day": "Day 1",
      "exercises": [
        {
          "name": "Bodyweight Squat",
          "sets": 3,
          "reps": 12,
          "notes": "Targets quads and glutes."
        }
      ]
    }
  ]
}
\`\`\`

• Use exactly this schema (no extra keys).  
• If you must explain anything, add a "notes" field on each exercise.  
• Do NOT wrap the JSON in markdown fences; just return raw JSON.
`;
}
