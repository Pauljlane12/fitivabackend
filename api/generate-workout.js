// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;
  if (!user || typeof user !== 'object') {
    return res.status(400).json({ error: 'Invalid user input' });
  }

  /* 1️⃣ Prompt */
  const prompt = buildWorkoutPrompt(user, exercises);

  try {
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800
    });

    /* 2️⃣ Strip ``` fences if they exist */
    let gptContent = choices[0]?.message?.content ?? '';
    gptContent = gptContent.trim()
      .replace(/^```(?:json)?/i, '')   // leading fence
      .replace(/```$/, '');           // trailing fence

    /* 3️⃣ Parse */
    let plan;
    try { plan = JSON.parse(gptContent); }
    catch { return res.status(500).json({ error: 'Invalid GPT JSON', raw_text: gptContent }); }

    /* 4️⃣ Validate */
    const validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const catalogNames = new Set(exercises.map(e => e.name));

    const ok = Array.isArray(plan.workout_plan) &&
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
      return res.status(500).json({ error: 'Malformed plan', raw_text: gptContent });
    }

    return res.status(200).json({ plan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'GPT request failed' });
  }
}

/* ---------------- Prompt builder ---------------- */
function buildWorkoutPrompt(user, catalog) {
  /* Use fitness_areas as primary selector */
  const requested = new Set(
    (user.target_muscle_groups || user.fitness_areas || []).map(m => m.toLowerCase())
  );

  const filtered = catalog.filter(e => requested.has(e.muscle_group.toLowerCase()));
  const useCatalog = filtered.length ? filtered : catalog;   // fallback

  const catalogLines = useCatalog
    .map(e => `• ${e.name} — ${e.muscle_group}, ${e.equipment}`)
    .join('\n');

  const freq = user.exercise_frequency || 4;
  const spacing = { 3:'Mon/Wed/Fri', 4:'Mon/Tue/Thu/Sat', 5:'Mon/Tue/Thu/Fri/Sun' }[freq] ||
                  'Spread training days for recovery';

  /* Risk flags */
  let flags = '';
  if (user.health_risks?.includes('pregnant')) {
    flags += '\n- Pregnant: low-impact, no supine heavy work after T1.';
  }
  if (user.health_risks?.some(r=>/joint/i.test(r))) {
    flags += '\n- Joint issues: avoid high-impact & deep loaded flexion.';
  }

  return `
You are an elite coach. Create a 7-day schedule (Mon–Sun).

Rules
• Train ${freq} days/week; other days are "Rest".
• Space training days smartly (e.g. ${spacing}).
• Use Push, Pull, Legs logic but optimise as you see fit.
• Only programme these muscles: ${[...requested].join(', ') || 'any (fallback)'}.
• Use ONLY exercises listed below; do NOT invent names.
• 6 exercises per training day. Format each: {name, sets, reps, notes}.
${flags}

Catalog
${catalogLines}

Return valid RAW JSON ONLY (no markdown):
{
 "workout_plan":[
   {"day":"Monday","exercises":[{ "name":"X","sets":3,"reps":10,"notes":"..."},...]},
   ...,
   {"day":"Sunday","exercises":"Rest"}
 ]
}
`.trim();
}
