// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  console.log('🔁', new Date().toISOString(), ' /api/generate-workout');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;
  if (!user || typeof user !== 'object') {
    return res.status(400).json({ error: 'Invalid user input' });
  }
  console.log('✅ User:', user.userId || 'anon');

  /* ---------- Build & send prompt ---------- */
  const prompt = buildWorkoutPrompt(user, exercises);
  console.log('🧠 Prompt preview:\n', prompt.slice(0, 600), '...\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800
    });

    const gptContent = completion.choices[0]?.message?.content ?? '';
    console.log('📩 Raw GPT JSON:\n', gptContent.slice(0, 600), '...\n');

    /* ---------- Parse ---------- */
    let plan;
    try {
      plan = JSON.parse(gptContent);
    } catch {
      return res.status(500).json({ error: 'GPT returned non-JSON', raw_text: gptContent });
    }

    /* ---------- Validate ---------- */
    const validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const catalogNames = new Set(exercises.map(e => e.name));

    const ok =
      Array.isArray(plan.workout_plan) &&
      plan.workout_plan.length === 7 &&
      plan.workout_plan.every(d =>
        validDays.includes(d.day) &&
        (
          d.exercises === 'Rest' ||
          (Array.isArray(d.exercises) &&
           d.exercises.length === 6 &&
           d.exercises.every(ex => catalogNames.has(ex.name)))
        )
      );

    if (!ok) {
      return res.status(500).json({ error: 'Malformed workout plan', raw_text: gptContent });
    }

    return res.status(200).json({ plan });
  } catch (err) {
    console.error('❌ GPT error', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

/* ---------------- Prompt builder ---------------- */
function buildWorkoutPrompt(user, allExercises) {
  /* 1️⃣  Resolve requested muscle groups */
  const requested = new Set(
    (user.target_muscle_groups || user.fitness_areas || []).map(m => m.toLowerCase())
  );

  /* 2️⃣  Filter catalog (fallback to full list if empty) */
  const filtered = allExercises.filter(e => requested.has(e.muscle_group.toLowerCase()));
  const useCatalog = filtered.length ? filtered : allExercises;

  const catalogLines = useCatalog
    .map(e => `• ${e.name} — ${e.muscle_group}, ${e.equipment}`)
    .join('\n');

  /* 3️⃣  Smart rest-day spacing tips */
  const freq = user.exercise_frequency || 4;
  const spacing = {
    3: 'Mon / Wed / Fri',
    4: 'Mon / Tue / Thu / Sat',
    5: 'Mon / Tue / Thu / Fri / Sun'
  }[freq] || 'Spread workouts for recovery (no 3 straight training days)';

  /* 4️⃣  Risk flags */
  let risks = '';
  if (user.health_risks?.includes('pregnant')) {
    risks += '\n- Pregnant: no supine heavy work after T1, keep impact low.';
  }
  if (user.health_risks?.some(r => /joint/i.test(r))) {
    risks += '\n- Joint issues: avoid high-impact & deep loaded flexion.';
  }

  /* 5️⃣  Compact prompt */
  return `
You are an elite coach. Design a **7-day schedule** (Mon–Sun) for the user below.

Requirements
- Train **${freq} days/week**. Non-training days must be "Rest".
- Follow a Push / Pull / Legs mindset (you may combine e.g. Glutes+Back if logical).
- Distribute training days smartly. Example for ${freq}: ${spacing}.
- **Only** program these muscle groups: ${[...requested].join(', ') || 'any (fallback)'}.
- Use **only** exercises from the catalog. Do not invent names.
- Exactly 6 exercises per training day ⇒ each: { name, sets, reps, notes }.
${risks}

User
- Gender: ${user.gender}
- Goal: ${user.primary_goal || user.goal}
- Experience: ${user.fitness_experience}
- Equipment: ${user.has_gym_access ? 'Full gym' : 'Home / minimal'}

Catalog
${catalogLines}

Return raw JSON ONLY:
{
  "workout_plan":[
    {"day":"Monday","exercises":[{ "name":"...", "sets":3,"reps":10,"notes":"..."}]},
    ...,
    {"day":"Sunday","exercises":"Rest"}
  ]
}
`.trim();
}
