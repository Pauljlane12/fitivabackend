// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const t0 = Date.now();
  console.log('⚡️ generate-workout invoked');

  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  if (!req.body || typeof req.body !== 'object')
    return res.status(400).json({ error: 'Invalid body' });

  const user = req.body;

  /* ---------- helper so we can retry once ---------- */
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildPrompt(user, exercises);
    console.log(`🧠 Prompt (attempt ${attempt + 1}) – chars:`, prompt.length);

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
      catch { throw new Error('json_parse'); }

      if (validatePlan(plan, user)) {
        console.log('✅ OK –', Date.now() - t0, 'ms');
        return res.status(200).json({ plan });
      }

      console.warn(`⚠️ Validation failed on attempt ${attempt + 1}`);
      // Loop will retry once more; after that we fall through to error
    } catch (err) {
      if (err.message === 'json_parse')
        console.error('❌ GPT returned non-JSON');
      else
        console.error('❌ GPT request error:', err);
      // break on network errors; keep loop for malformed plans
      if (attempt === 1) return res.status(500).json({ error: 'GPT request failed' });
    }
  }

  // both attempts failed validation
  return res.status(500).json({ error: 'GPT produced malformed plan twice, aborting.' });
}

/* -------- PLAN VALIDATOR ---------- */
function validatePlan(plan, user) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const allowedEquip = deriveAllowedEquipment(user);
  const nameSet = new Set(exercises.map(e => e.name));
  const byName  = Object.fromEntries(exercises.map(e => [e.name, e]));

  return Array.isArray(plan.workout_plan) &&
    plan.workout_plan.length === 7 &&
    plan.workout_plan.every(d =>
      days.includes(d.day) &&
      (
        d.exercises === 'Rest' ||
        (Array.isArray(d.exercises) &&
         d.exercises.length === 6 &&                              // <-- strict rule
         d.exercises.every(ex =>
           nameSet.has(ex.name) &&
           ex.sets === 3 &&
           ex.reps >= 6 && ex.reps <= 12 &&
           (typeof ex.start_weight_lb === 'number' || byName[ex.name].equipment === 'bodyweight') &&
           allowedEquip.has(byName[ex.name].equipment)
         ))
      ));
}

/* ------------ Prompt builder -------------- */
function buildPrompt(user, catalog) {
  const musclesWanted = new Set(
    (user.target_muscle_groups || user.fitness_areas || []).map(m => m.toLowerCase())
  );

  const allowedEquip = deriveAllowedEquipment(user);

  const usable = catalog.filter(e =>
    (!musclesWanted.size || musclesWanted.has(e.muscle_group.toLowerCase())) &&
    allowedEquip.has(e.equipment)
  );

  const lines = usable.map(e =>
    `• ${e.name} — ${e.muscle_group}, ${e.equipment}`
  ).join('\n');

  const freq    = user.exercise_frequency || 4;
  const spacing = {3:'Mon/Wed/Fri',4:'Mon/Tue/Thu/Sat',5:'Mon/Tue/Thu/Fri/Sun'}[freq] ||
                  'spread training days for recovery';

  const bw      = user.weight || 150;
  const level   = (user.fitness_experience || 'intermediate').toLowerCase();
  const mult    = {beginner:0.3,intermediate:0.5,advanced:0.7}[level] || 0.5;

  let flags = '';
  if (user.health_risks?.includes('pregnant'))
    flags += '\n- Pregnant: low-impact, avoid heavy supine work after T1.';
  if (user.health_risks?.some(r => /joint/i.test(r)))
    flags += '\n- Joint issues: avoid high-impact & deep loaded flexion.';

  return `
You are an elite coach. Produce RAW JSON only.

• Train ${freq} days/week. Non-training days must be "Rest".
• Space sessions smartly (${spacing}).
${user.has_gym_access
  ? '• Gym available ⇒ weighted or machine lifts **only**; no body-weight primary moves.'
  : `• Home equipment only ⇒ ${[...allowedEquip].join(', ')}.`}
• Every workout day MUST have **exactly 6 exercises**. If not, regenerate before you answer.
• Each exercise: {name, sets:3, reps:6-12, start_weight_lb, notes}.
• start_weight_lb ≈ BW × levelMult (${bw}×${mult}=~${(bw*mult).toFixed(0)} lb) then adjusted reasonably.
• Target only these muscles: ${[...musclesWanted].join(', ') || 'any'}.
• Use ONLY exercises from the catalog – no new names.${flags}

Catalog
${lines}

Return JSON in this shape:
{
 "workout_plan":[
   {"day":"Monday","exercises":[
     {"name":"X","sets":3,"reps":10,"start_weight_lb":60,"notes":"..."},
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
    // everything except pure body-weight
    return new Set([
      'barbell','dumbbell','kettlebell','machine','cable',
      'plate','resistance_band','smith','sled','trap_bar','ez_bar'
    ]);
  }
  const map = {
    dumbbells: 'dumbbell',
    'resistance bands': 'resistance_band',
    kettlebells: 'kettlebell',
    'pull up bar': 'bodyweight',
    'adjustable bench': 'dumbbell',
    'just bodyweight': 'bodyweight'
  };
  const allowed = new Set(['bodyweight']);
  (user.home_equipment || []).forEach(item => {
    const key = item.toLowerCase();
    if (map[key]) allowed.add(map[key]);
  });
  return allowed;
}
