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

  /* ---------- Build prompt ---------- */
  const prompt = buildWorkoutPrompt(user, exercises);
  console.log('🧠 Prompt sent to GPT:\n', prompt);

  /* ---------- GPT call ---------- */
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500 // enough for 4-5 days × 6 exercises
    });

    const gptContent = completion.choices[0]?.message?.content ?? '';
    console.log('📩 GPT raw response (full):\n', gptContent);

    /* ---------- Parse / validate ---------- */
    let planJSON;
    try {
      planJSON = JSON.parse(gptContent);
      console.log('✅ Parsed plan JSON:\n', JSON.stringify(planJSON, null, 2));
    } catch (err) {
      console.warn('⚠️ GPT returned non-JSON. Sending raw text.');
      return res.status(500).json({ error: 'Invalid GPT output', raw_text: gptContent });
    }

    /* ---------- Structural validation ---------- */
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const catalogNames = new Set(exercises.map(e => e.name));

    const structureOK =
      Array.isArray(planJSON.workout_plan) &&
      planJSON.workout_plan.every(dayObj =>
        validDays.includes(dayObj.day) &&
        Array.isArray(dayObj.exercises) &&
        dayObj.exercises.length === 6 &&
        dayObj.exercises.every(ex => catalogNames.has(ex.name))
      );

    if (!structureOK) {
      console.warn('⚠️ GPT output failed structural or catalog validation.');
      return res
        .status(500)
        .json({ error: 'GPT returned malformed workout plan', raw_text: gptContent });
    }

    /* ---------- Success ---------- */
    return res.status(200).json({ plan: planJSON });
  } catch (err) {
    console.error('❌ GPT error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}

/* ------------------------------------------------------------------ */
/* ----------------------- Prompt Builder --------------------------- */
/* ------------------------------------------------------------------ */
function buildWorkoutPrompt(user, allExercises) {
  /* --------- Exercise catalog --------- */
  const exerciseLines = allExercises
    .map(e => {
      const desc = e.description ? e.description.replace(/\n+/g, ' ') : 'No description';
      const weight = e.default_weight ? ` @ ${e.default_weight}` : '';
      return `• ${e.name} — Muscle Group: ${e.muscle_group}, Equipment: ${e.equipment}, Difficulty: ${e.difficulty}, Tags: [${e.tags.join(
        ', '
      )}], Description: ${desc}, Default: ${e.default_sets}x${e.default_reps}${weight}`;
    })
    .join('\n');

  /* --------- Dynamic safety rules --------- */
  let riskBlock = '';
  if (Array.isArray(user.health_risks)) {
    if (user.health_risks.includes('pregnant')) {
      riskBlock += `
⚠️ The user is pregnant.  • Avoid high-impact or contact moves, supine work after 1st trimester, deep spinal flexion, max-effort Valsalva, or exercises that overly stress the core/pelvic floor.  • Prioritize stability, controlled tempo, and moderate RPE.`;
    }
    if (user.health_risks.some(r => /joint/i.test(r))) {
      riskBlock += `
⚠️ Joint issues present.  • Eliminate high-impact plyometrics, deep end-range loaded flexion/extension, and uncontrolled momentum.  • Favor machine or supported variations, neutral joint angles, and low-impact cardio.`;
    }
    // add more conditions here as needed
  }

  const freq = user.exercise_frequency || 5;
  const weekdayEnd = getEndDay(freq);

  /* --------- Final prompt --------- */
  return `
You are a certified personal trainer designing a custom *${freq}-day-per-week* workout plan for the user below.

### USER PROFILE (JSON)
${JSON.stringify(user, null, 2)}

### EXERCISE CATALOG
(Choose ONLY from this list — do NOT invent or rename exercises.)
${exerciseLines}

---

### INSTRUCTIONS
1. Match the user's goals, target muscles, experience, equipment access, and frequency.
2. Build a ${freq}-day schedule from **Monday to ${weekdayEnd}**.
3. Provide **exactly 6 exercises per day**.
4. Reuse catalog exercises if necessary (vary sets, reps, tempo).
5. Each exercise must include a short "notes" field.
6. Output must be raw, valid JSON — no markdown fences, no extra keys.${riskBlock}

### REQUIRED OUTPUT (VALID JSON)
{
  "workout_plan": [
    {
      "day": "Monday",
      "exercises": [
        { "name": "Example Exercise", "sets": 3, "reps": 10, "notes": "Why it's chosen." },
        ...
      ]
    },
    ...
  ]
}
`;
}

/* Helper to map frequency → last weekday label */
function getEndDay(freq) {
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return weekdays[Math.min(freq - 1, 6)];
}
