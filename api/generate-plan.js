// /api/generate-plan-v2.js
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- approved weighted movements ---------- */
const approvedExercises = [
  /* … same list you provided … */
];

/* ---------- helpers ---------- */
const orderedDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const dow         = { Monday:'Mo', Tuesday:'Tu', Wednesday:'We', Thursday:'Th',
                      Friday:'Fr', Saturday:'Sa', Sunday:'Su' };
const isApproved  = n => approvedExercises.includes(n);
const ERR = (res,msg,code=400) => res.status(code).json({ error: msg });

/* ------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') return ERR(res,'Method not allowed',405);

  try {
    const { summary = '' } = req.body;
    if (!summary.trim())   return ERR(res,'Missing or invalid summary');

    /* ---------- 1.  Parse summary lines ---------- */
    const focusMatch = summary.match(/Focus\s*areas:\s*([^\.\n]+)/i);
    let   focusRaw   = focusMatch ? focusMatch[1].trim() : '';
    let   focusAreas = focusRaw.toLowerCase() === 'none'
                     ? []
                     : focusRaw.split(/,\s*/).filter(Boolean);

    const freqMatch  = summary.match(/Frequency:\s*(\d+)/i);
    const freqDays   = Math.min(Math.max(parseInt(freqMatch?.[1]||4,10),1),7);  // clamp 1-7

    if (!focusAreas.length) focusAreas = ['full      body']; // fallback cue for GPT

    /* ---------- 2.  Build GPT prompt ---------- */
    const prompt = `
You are a certified strength coach.

Design a **weighted-only** programme (no body-weight moves) for exactly ${freqDays} workout days this week.
ALL exercises must come from the approved list below **and must directly emphasise ONLY these areas: ${focusAreas.join(', ')}**.

Rules
• Provide 6 approved exercises per workout day  
• Days not programmed count as complete rest (empty list)  
• Include at least one isolation-dominant day focused on the selected areas  
• Return RAW JSON (no markdown) with keys Monday … Sunday in order; each key matches the schema:

{
  "abbr":  "Lower" | "Upper" | "Glute" | "Back" | "Rest",
  "label": "Lower Body Power" | "Rest Day" | …,
  "exercises": [
    { "name": "<approvedExercise>", "sets": 4, "reps": 10 },
    … exactly 6 objects or [] …
  ]
}

User summary:
${summary}

approvedExercises:
${approvedExercises.join(', ')}
`.trim();

    /* ---------- 3.  GPT-4o call ---------- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [{ role:'user', content: prompt }]
    });

    const raw = choices?.[0]?.message?.content;
    if (!raw) return ERR(res,'LLM returned empty response',500);

    /* ---------- 4.  Parse + strict validation ---------- */
    let plan;
    try { plan = JSON.parse(raw); }
    catch { return ERR(res,'LLM returned invalid JSON',500); }

    const finalPlan = {};
    let   workoutCount = 0;

    for (const day of orderedDays) {
      const dayObj = plan?.[day] ?? {};
      let list = Array.isArray(dayObj.exercises) ? dayObj.exercises : [];

      /* keep approved & max 6 */
      list = list.filter(ex => ex && isApproved(ex.name)).slice(0, 6);

      /* validate count — if bad treat as rest */
      if (list.length !== 6) {
        list = [];
        dayObj.abbr  = 'Rest';
        dayObj.label = 'Rest Day';
      } else {
        workoutCount += 1;
      }

      /* safety fallbacks */
      const abbr  = (dayObj.abbr  || (list.length ? 'Workout' : 'Rest')).trim();
      const label = (dayObj.label || (list.length ? `${abbr} Session` : 'Rest Day')).trim();

      finalPlan[day] = {
        dow: dow[day],
        abbr,
        label,
        exercises: list
      };
    }

    /* ---------- 5.  Enforce frequency ---------- */
    if (workoutCount !== freqDays) {
      console.error(`Plan has ${workoutCount} workout days, expected ${freqDays}`);
      return ERR(res,'LLM failed frequency constraint; please retry',500);
    }

    console.log('✅ CLEAN PLAN v2:', JSON.stringify(finalPlan));
    return res.status(200).json({ plan: finalPlan });

  } catch (err) {
    console.error('🔥 Plan v2 generation error:', err);
    return ERR(res,'Workout plan generation failed',500);
  }
}
