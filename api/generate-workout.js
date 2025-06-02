// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ──────────────────────────────────────────────────────────
 *  MAIN HANDLER
 *  ──────────────────────────────────────────────────────────*/
export default async function handler(req, res) {
  const t0 = Date.now();
  console.log('⚡️  /api/generate-workout invoked');

  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' });

  if (!req.body || typeof req.body !== 'object')
    return res.status(400).json({ error: 'Invalid body' });

  const user = req.body;

  /* ── We allow ONE automatic retry ── */
  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildPrompt(user, exercises);
    console.log(`🧠  Prompt (attempt ${attempt}) – ${prompt.length} chars`);

    try {
      const { choices } = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.55,
        max_tokens: 1800
      });

      /* ── Strip ``` fences ── */
      let txt = (choices?.[0]?.message?.content || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\n]*$/i, '');

      console.log('📩 GPT answer size:', txt.length, 'chars');

      /* ── Parse JSON ── */
      let plan;
      try { plan = JSON.parse(txt); }
      catch {
        console.warn('❗  GPT did not return valid JSON');
        if (attempt === 2) return res.status(500).json({ error: 'Non-JSON twice' });
        continue;
      }

      /* ── Validate ── */
      if (validatePlan(plan, user)) {
        console.log('✅  Plan accepted in', Date.now() - t0, 'ms');
        return res.status(200).json({ plan });
      }

      console.warn(`⚠️  Validation failed on attempt ${attempt}`);
      if (attempt === 2) {
        console.error('Last bad plan (truncated):\n' + txt.slice(0, 1500));
        return res.status(500).json({ error: 'GPT produced malformed plan twice, aborting.' });
      }
    } catch (err) {
      console.error('❌  GPT request error:', err);
      return res.status(500).json({ error: 'GPT request failed' });
    }
  }
}

/** ──────────────────────────────────────────────────────────
 *  PLAN VALIDATOR
 *  ──────────────────────────────────────────────────────────*/
function validatePlan(plan, user) {
  const days          = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const allowedEquip  = deriveAllowedEquipment(user);
  const accessoryWL   = new Set(['Frog Pumps', 'Banded Lateral Walks']);   // always ok
  const byName        = Object.fromEntries(exercises.map(e => [e.name, e]));

  if (!Array.isArray(plan.workout_plan) || plan.workout_plan.length !== 7) return false;

  return plan.workout_plan.every(d => {
    if (!days.includes(d.day)) return false;

    /* Rest day is fine */
    if (d.exercises === 'Rest') return true;

    if (!Array.isArray(d.exercises) || d.exercises.length !== 6) return false;

    return d.exercises.every(ex => {
      const ref = byName[ex.name];
      if (!ref) return false;                                  // not in catalog

      /* Equipment rule */
      const equipOk =
        allowedEquip.has(ref.equipment) || accessoryWL.has(ex.name);

      /* start_weight rule */
      const needsWeight = ref.equipment !== 'bodyweight' && ref.equipment !== 'resistance_band';
      const weightOk    = needsWeight
        ? typeof ex.start_weight_lb === 'number'
        : ex.start_weight_lb === undefined;

      return (
        ex.sets === 3 &&
        ex.reps >= 6 && ex.reps <= 12 &&
        equipOk &&
        weightOk
      );
    });
  });
}

/** ──────────────────────────────────────────────────────────
 *  PROMPT BUILDER
 *  ──────────────────────────────────────────────────────────*/
function buildPrompt(user, catalog) {
  /* muscles to hit */
  const wanted = new Set((user.target_muscle_groups || user.fitness_areas || [])
    .map(m => m.toLowerCase()));

  /* equipment rules */
  const allowedEquip = deriveAllowedEquipment(user);
  const accessoryWL  = new Set(['Frog Pumps', 'Banded Lateral Walks']);

  /* filter catalog */
  const usable = catalog.filter(e =>
    (!wanted.size || wanted.has(e.muscle_group.toLowerCase())) &&
    (allowedEquip.has(e.equipment) || accessoryWL.has(e.name))
  );

  const catalogLines = usable
    .map(e => `• ${e.name} — ${e.muscle_group}, ${e.equipment}`)
    .join('\n');

  /* frequency & spacing */
  const freq    = user.exercise_frequency || 4;
  const spacing = {3:'Mon/Wed/Fri',4:'Mon/Tue/Thu/Sat',5:'Mon/Tue/Thu/Fri/Sun'}[freq] ||
                  'spread training days for recovery';

  /* starting-weight heuristic */
  const bw   = user.weight || 150;
  const lvl  = (user.fitness_experience || 'intermediate').toLowerCase();
  const mult = {beginner:0.3,intermediate:0.5,advanced:0.7}[lvl] || 0.5;

  /* risk flags */
  let flags = '';
  if (user.health_risks?.includes('pregnant'))
    flags += '\n- Pregnant: low-impact, avoid supine heavy work after T1.';
  if (user.health_risks?.some(r => /joint/i.test(r)))
    flags += '\n- Joint issues: avoid high-impact & deep loaded flexion.';

  return `
You are an elite strength coach. **Return RAW JSON only – no markdown**.

Rules
• Programme ${freq} training days/week, rest days = "Rest".
• Space sessions smartly (${spacing}).
${user.has_gym_access
  ? '• User has full gym ⇒ primary lifts must be weighted; up to 2 accessory body-weight/band glute drills allowed (Frog Pumps, Banded Lateral Walks).'
  : `• Home set-up ⇒ allowed equipment: ${[...allowedEquip].join(', ')}.`}
• EXACTLY 6 exercises on each training day.
• Each exercise: {name, sets:3, reps:6-12, start_weight_lb?, notes}.
  – Omit start_weight_lb for body-weight or resistance-band moves.
  – For weighted moves start_weight_lb ≈ BW × levelMult (${bw}×${mult} ≈ ${(bw*mult).toFixed(0)} lb) and adjust reasonably.
• Target only: ${[...wanted].join(', ') || 'any'}.
• Use **only** exercises in the catalog list (no new names).${flags}

Catalog
${catalogLines}

Return exactly this structure:
{
 "workout_plan": [
   { "day": "Monday",    "exercises": [ { "name": "Hip Thrusts", "sets": 3, "reps": 8, "start_weight_lb": 135, "notes": "..." }, ... ] },
   ...
   { "day": "Sunday",    "exercises": "Rest" }
 ]
}
`.trim();
}

/** ──────────────────────────────────────────────────────────
 *  EQUIPMENT HELPER
 *  ──────────────────────────────────────────────────────────*/
function deriveAllowedEquipment(user) {
  if (user.has_gym_access) {
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

  const allowed = new Set(['bodyweight']);   // always allowed
  (user.home_equipment || []).forEach(item => {
    const key = item.toLowerCase();
    if (map[key]) allowed.add(map[key]);
  });
  return allowed;
}
