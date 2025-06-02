// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const start = Date.now();
  console.log('⚡️ generate-workout invoked');

  if (req.method !== 'POST') {
    console.log('⛔ 405');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = req.body;
  if (!user || typeof user !== 'object') {
    console.log('⛔ 400 – bad body');
    return res.status(400).json({ error: 'Invalid user input' });
  }

  /* 1️⃣ Build prompt */
  const prompt = buildWorkoutPrompt(user, exercises);
  console.log('🧠 Prompt built – chars:', prompt.length);

  /* 2️⃣ Call GPT-4o */
  try {
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800
    });

    /* 3️⃣ Clean fences */
    let gptContent = (choices[0]?.message?.content || '').trim();
    gptContent = gptContent
      .replace(/^```(?:json)?\s*/i, '')   // leading
      .replace(/\s*```[\s\n]*$/i, '');    // trailing

    console.log('📩 GPT chars:', gptContent.length);

    /* 4️⃣ Parse JSON */
    let plan;
    try { plan = JSON.parse(gptContent); }
    catch (e) {
      console.error('❌ JSON.parse failed');
      return res.status(500).json({ error: 'Invalid GPT JSON', raw_text: gptContent });
    }

    /* 5️⃣ Validate */
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const catalogSet = new Set(exercises.map(e => e.name));

    const valid = Array.isArray(plan.workout_plan) &&
      plan.workout_plan.length === 7 &&
      plan.workout_plan.every(d =>
        days.includes(d.day) &&
        (d.exercises === 'Rest' ||
         (Array.isArray(d.exercises) &&
          d.exercises.length === 6 &&
          d.exercises.every(ex => catalogSet.has(ex.name))))
      );

    if (!valid) {
      console.error('❌ Validation failed');
      return res.status(500).json({ error: 'Malformed plan', raw_text: gptContent });
    }

    console.log('✅ Success – ms:', Date.now() - start);
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('❌ GPT request error', err);
    return res.status(500).json({ error: 'GPT request failed' });
  }
}

/* ---------------- Prompt builder ---------------- */
function buildWorkoutPrompt(user, catalog) {
  const wanted = new Set(
    (user.target_muscle_groups || user.fitness_areas || []).map(m => m.toLowerCase())
  );

  const filtered = catalog.filter(e => wanted.has(e.muscle_group.toLowerCase()));
  const useCatalog = filtered.length ? filtered : catalog;

  const catalogLines = useCatalog
    .map(e => `• ${e.name} — ${e.muscle_group}, ${e.equipment}`)
    .join('\n');

  const freq = user.exercise_frequency || 4;
  const spacing = {3:'Mon/Wed/Fri',4:'Mon/Tue/Thu/Sat',5:'Mon/Tue/Thu/Fri/Sun'}[freq] ||
                  'spread training days for recovery';

  let flags = '';
  if (user.health_risks?.includes('pregnant'))
    flags += '\n- Pregnant: low-impact, avoid heavy supine work after T1.';
  if (user.health_risks?.some(r => /joint/i.test(r)))
    flags += '\n- Joint issues: avoid high-impact & deep loaded flexion.';

  return `
You are an elite coach. Create a 7-day schedule (Mon–Sun).

Rules
• Train ${freq} days/week; other days are "Rest".
• Space training days smartly (e.g. ${spacing}).
• Use Push / Pull / Legs logic; optimise freely.
• Only hit these muscles: ${[...wanted].join(', ') || 'any (fallback)'}.
• Use ONLY exercises below – no new names.
• Exactly 6 exercises per training day → {name, sets, reps, notes}.${flags}

User
- Gender: ${user.gender}
- Goal: ${user.primary_goal || user.goal}
- Experience: ${user.fitness_experience}
- Equipment: ${user.has_gym_access ? 'full gym' : 'home/minimal'}

Catalog
${catalogLines}

Return RAW JSON only:
{
 "workout_plan":[
   {"day":"Monday","exercises":[{ "name":"X","sets":3,"reps":10,"notes":"..."},...]},
   ...
   {"day":"Sunday","exercises":"Rest"}
 ]
}
`.trim();
}
