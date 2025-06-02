import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  console.log('🔁 Request received at:', new Date().toISOString());

  if (req.method !== 'POST') {
    console.warn('🚫 Invalid method:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;

  if (!user || typeof user !== 'object') {
    console.warn('⚠️ Invalid or missing user input');
    return res.status(400).json({ error: 'Invalid user input' });
  }

  console.log('✅ Received user data:', user);

  const prompt = buildWorkoutPrompt(user, exercises);
  console.log('🧠 Prompt sent to GPT:', prompt.slice(0, 1000)); // log first 1000 chars

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    const gptContent = completion.choices[0]?.message?.content || '';
    console.log('📩 GPT raw response:', gptContent.slice(0, 1000));

    let planJSON;
    try {
      planJSON = JSON.parse(gptContent);

      // ✅ Validate output: must have workout_plan array with valid weekdays and 6 exercises per day
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const isValid = Array.isArray(planJSON?.workout_plan) &&
        planJSON.workout_plan.every(day =>
          validDays.includes(day.day) && Array.isArray(day.exercises) && day.exercises.length === 6
        );

      if (!isValid) {
        console.warn('⚠️ GPT output invalid or missing expected structure.');
        return res.status(500).json({ error: 'GPT returned malformed workout plan' });
      }

      console.log('✅ Parsed and validated workout plan JSON:', planJSON);
      return res.status(200).json({ plan: planJSON });
    } catch {
      console.warn('⚠️ GPT response was not valid JSON. Returning raw text instead.');
      return res.status(200).json({ raw_text: gptContent });
    }
  } catch (err) {
    console.error('❌ GPT error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

// 🧠 PROMPT BUILDER — Updated to enforce 6 exercises + weekday names
function buildWorkoutPrompt(user, allExercises) {
  const exerciseLines = allExercises.map(e => {
    const desc = e.description ? e.description.replace(/\n+/g, ' ') : 'No description';
    const weight = e.default_weight ? ` @ ${e.default_weight}` : '';
    return `• ${e.name} — Muscle Group: ${e.muscle_group}, Equipment: ${e.equipment}, Difficulty: ${e.difficulty}, Tags: [${e.tags.join(', ')}], Description: ${desc}, Default: ${e.default_sets}x${e.default_reps}${weight}`;
  }).join('\n');

  const freq = user.exercise_frequency || 5;

  return `
You are a certified personal trainer designing a custom *${freq}-day-per-week* workout plan for the user below.

### USER PROFILE (JSON)
${JSON.stringify(user, null, 2)}

### EXERCISE CATALOG
(Choose ONLY from this list. Do NOT invent any exercises.)
${exerciseLines}

---

### INSTRUCTIONS
1. Match the user's goal, experience level, muscle group preferences, available equipment, and frequency.
2. Build a ${freq}-day plan with workouts from **Monday to ${getEndDay(freq)}**.
3. Provide **exactly 6 exercises per day**.
4. Only use exercises from the provided catalog. If there aren't enough unique options, repeat or vary existing ones (e.g., sets/reps/tempo).
5. Include a short "notes" field for each exercise explaining its purpose or target.
6. Use the following output format exactly — valid, raw JSON only.

### REQUIRED OUTPUT (VALID JSON)
{
  "workout_plan": [
    {
      "day": "Monday",
      "exercises": [
        {
          "name": "Bodyweight Squat",
          "sets": 3,
          "reps": 12,
          "notes": "Targets quads and glutes."
        },
        ...
      ]
    },
    ...
  ]
}

Do NOT wrap the JSON in markdown fences. Just return raw, valid JSON.
`;
}

// Weekday label helper
function getEndDay(freq) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[Math.min(freq - 1, 6)];
}
