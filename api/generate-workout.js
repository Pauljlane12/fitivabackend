import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  console.log('🔁 Request received at:', new Date().toISOString());

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;
  if (!user || typeof user !== 'object') {
    return res.status(400).json({ error: 'Invalid user input' });
  }
  console.log('✅ User data:', user);

  const prompt = buildWorkoutPrompt(user, exercises);
  console.log('🧠 GPT-4o prompt:\n', prompt.slice(0, 1000) + '...');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800,
    });

    const gptContent = completion.choices[0]?.message?.content ?? '';
    console.log('📩 GPT response:\n', gptContent);

    let planJSON;
    try {
      planJSON = JSON.parse(gptContent);
    } catch {
      return res.status(500).json({ error: 'Invalid GPT output', raw_text: gptContent });
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const catalogNames = new Set(exercises.map(e => e.name));

    const structureOK =
      Array.isArray(planJSON.workout_plan) &&
      planJSON.workout_plan.length === 7 &&
      planJSON.workout_plan.every(dayObj =>
        validDays.includes(dayObj.day) &&
        (
          (dayObj.exercises === 'Rest') ||
          (
            Array.isArray(dayObj.exercises) &&
            dayObj.exercises.length === 6 &&
            dayObj.exercises.every(ex => catalogNames.has(ex.name))
          )
        )
      );

    if (!structureOK) {
      return res.status(500).json({ error: 'Malformed workout plan', raw_text: gptContent });
    }

    return res.status(200).json({ plan: planJSON });
  } catch (err) {
    console.error('❌ GPT error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

/* --------------------- PROMPT BUILDER --------------------- */
function buildWorkoutPrompt(user, allExercises) {
  const selectedMuscleGroups = new Set(user.target_muscle_groups || []);
  const filteredCatalog = allExercises.filter(e => selectedMuscleGroups.has(e.muscle_group));
  const compactCatalog = filteredCatalog.map(e =>
    `• ${e.name} — ${e.muscle_group}, ${e.equipment}, [${e.tags.join(', ')}]`
  ).join('\n');

  const freq = user.exercise_frequency || 4;

  // Smart rest-day spacing guidance
  const spacingExamples = {
    3: 'Mon / Wed / Fri',
    4: 'Mon / Tue / Thu / Sat',
    5: 'Mon / Tue / Thu / Fri / Sun'
  };
  const spacingTip = spacingExamples[freq]
    ? `Distribute workouts across the week. Example for ${freq} days: ${spacingExamples[freq]}. Avoid stacking all training days in a row.`
    : 'Distribute workouts to allow for recovery between sessions.';

  let riskFlags = '';
  if (user.health_risks?.includes('pregnant')) {
    riskFlags += '\n- Pregnant: Avoid supine/core stress, favor low-impact controlled movements.';
  }
  if (user.health_risks?.some(r => /joint/i.test(r))) {
    riskFlags += '\n- Joint issues: Avoid deep flexion, high impact, and unstable loads.';
  }

  return `
You are a personal trainer. Create a 7-day plan (Mon–Sun) for this user.

Train ${freq} days/week using a push/pull/legs mindset. All other days must be: "exercises": "Rest".
Only use these muscle groups: [${[...selectedMuscleGroups].join(', ')}].
Only use exercises from the catalog below (no inventing or renaming).

${spacingTip}
Give exactly 6 exercises per workout day. Each must include: name, sets, reps, notes.

USER:
- Gender: ${user.gender}
- Goal: ${user.goal}
- Equipment: ${user.available_equipment?.join(', ') || 'None'}
- Experience: ${user.training_experience}${riskFlags}

EXERCISE CATALOG:
${compactCatalog}

Return valid raw JSON (no markdown, no comments). Format:
{
  "workout_plan": [
    { "day": "Monday", "exercises": [ { "name": "X", "sets": 3, "reps": 10, "notes": "..." }, ... ] },
    ...
    { "day": "Sunday", "exercises": "Rest" }
  ]
}
`;
}
