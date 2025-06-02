// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const t0 = Date.now();
  console.log('⚡️ generate-workout invoked');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid body' });

  const user = req.body;
  const prompt = buildPrompt(user, exercises);
  console.log('🧠 Prompt size:', prompt.length);

  try {
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.55,
      max_tokens: 1800
    });

    let txt = (choices[0]?.message?.content || '').trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```[\s\n]*$/i, '');
    console.log('📩 GPT size:', txt.length);

    let plan;
    try { plan = JSON.parse(txt); }
    catch { return res.status(500).json({ error: 'Invalid GPT JSON', raw_text: txt }); }

    /* -------- Validation -------- */
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const allowedEquip = deriveAllowedEquipment(user);
    const namesSet = new Set(exercises.map(e => e.name));
    const catalogByName = Object.fromEntries(exercises.map(e => [e.name, e]));

    const valid = Array.isArray(plan.workout_plan) &&
      plan.workout_plan.length === 7 &&
      plan.workout_plan.every(d =>
        days.includes(d.day) &&
        (
          d.exercises === 'Rest' ||
          (Array.isArray(d.exercises) && d.exercises.length === 6 &&
            d.exercises.every(ex =>
              namesSet.has(ex.name) &&
              ex.sets === 3 &&
              ex.reps >= 6 && ex.reps <= 12 &&
              (typeof ex.start_weight_lb === 'number' || ex.equipment === 'bodyweight') &&
              allowedEquip.has(catalogByName[ex.name].equipment)
            )
          )
        )
      );

    if (!valid) return res.status(500).json({ error: 'Malformed plan', raw_text: txt });

    console.log('✅ OK –', Date.now() - t0, 'ms');
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('❌ GPT error', err);
    return res.status(500).json({ error: 'GPT request failed' });
  }
}

/* ------------ Prompt builder -------------- */
function buildPrompt(user, catalog) {
  /* Which muscles to hit? */
  const musclesWanted = new Set((user.target_muscle_groups || user.fitness_areas || []).map(m=>m.toLowerCase()));

  /* Which equipment is allowed? */
  const allowedEquip = deriveAllowedEquipment(user);

  const filtered = catalog.filter(e =>
    (!musclesWanted.size || musclesWanted.has(e.muscle_group.toLowerCase())) &&
    allowedEquip.has(e.equipment)
  );
  const useCatalog = filtered.length ? filtered : catalog.filter(e => allowedEquip.has(e.equipment));

  const catalogLines = useCatalog.map(e =>
    `• ${e.name} — ${e.muscle_group}, ${e.equipment}`
  ).join('\n');

  const freq = user.exercise_frequency || 4;
  const spacing = {3:'Mon/Wed/Fri',4:'Mon/Tue/Thu/Sat',5:'Mon/Tue/Thu/Fri/Sun'}[freq] ||
                  'spread training days for recovery';

  /* Risk flags */
  let flags = '';
  if (user.health_risks?.includes('pregnant'))
    flags += '\n- Pregnant: low-impact, avoid heavy supine work after T1.';
  if (user.health_risks?.some(r=>/joint/i.test(r)))
    flags += '\n- Joint issues: avoid high-impact & deep loaded flexion.';

  /* Starting-weight heuristic */
  const bw = user.weight || 150;
  const levelMult = {beginner:0.3,intermediate:0.5,advanced:0.7}[(user.fitness_experience||'intermediate').toLowerCase()] || 0.5;

  return `
You are an elite coach. Create a RAW-JSON 7-day plan (Mon–Sun).

Rules
• Train ${freq} days; other days = "Rest".
• Space days smartly (${spacing}).
${user.has_gym_access
  ? '• User has full gym: choose WEIGHTED lifts only (barbell, dumbbell, machine, cable, etc.).'
  : `• Home equipment only: ${[...allowedEquip].join(', ')}.`}
• Sets = 3, Reps 6-12 for EVERY exercise.
• Add "start_weight_lb" for weighted moves (≈ BW × lvlMult ${bw}×${levelMult} ≈ ${(bw*levelMult).toFixed(0)} lb) and adjust logically.
• Only these muscles: ${[...musclesWanted].join(', ') || 'any (fallback)'}.
• Use ONLY exercises listed below; no inventing names.${flags}

Catalog
${catalogLines}

Return JSON ONLY:
{
 "workout_plan":[
   {"day":"Monday","exercises":[
     {"name":"X","sets":3,"reps":10,"start_weight_lb":50,"notes":"..."},
     ...
   ]},
   ...,
   {"day":"Sunday","exercises":"Rest"}
 ]
}
`.trim();
}

/* ---------- equipment helper ---------- */
function deriveAllowedEquipment(user) {
  if (user.has_gym_access) {
    // all but pure body-weight are legal; allow bodyweight only when purposeful accessory
    return new Set(['barbell','dumbbell','kettlebell','machine','cable','plate','resistance_band','smith','kettlebell','sled','trap_bar','ez_bar']); // extend as your catalog grows
  }

  // map dropdown selections → equipment strings in catalog
  const map = {
    dumbbells: 'dumbbell',
    'resistance bands': 'resistance_band',
    kettlebells: 'kettlebell',
    'pull up bar': 'bodyweight',   // pull-ups marked as bodyweight but need bar
    'adjustable bench': 'dumbbell',// bench = accessory; keep dumbbell lifts
    'just bodyweight': 'bodyweight'
  };

  const allowed = new Set(['bodyweight']); // always allow body-weight as fallback
  (user.home_equipment || []).forEach(item => {
    const key = item.toLowerCase();
    if (map[key]) allowed.add(map[key]);
  });
  return allowed;
}
