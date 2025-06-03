// File: /api/generate-plan.js
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- 65 approved weighted movements ---------- */
const approvedExercises = [
  'Hip Thrusts','Incline Dumbbell Curls','Incline Press (Machine or Dumbbell)',
  'Lat Pulldowns','Lat Pushdowns','Leg Extensions','Leg Lifts',
  'Leg Press Machine','Leg Raise Hold (Reverse Plank)','Machine Chest Press',
  'Oblique Taps','Overhead Cable Pushdowns','Preacher Curls',
  'Pull-Ups / Assisted Pull-Ups','Rear Delt Flys','Reverse Flys',
  'Reverse Lunges','Romanian Deadlifts','Seated Leg Raise Machine',
  'Ab Crunch Machine','Banded Lateral Walks','Bent Over Rows',
  'Bicycle Crunches','Box Step-Up (Quad Emphasis)','Bulgarian Split Squats',
  'Cable Curls','Cable Flys','Cable Kickbacks','Cable Pushdowns',
  'Cross-Body Dumbbell Curls','Curtsy Lunge','Dumbbell Front Squat',
  'Dumbbell Lateral Raises','Flutter Kicks','Frog Pumps','Front Plate Raise',
  'Glute Bridge (Machine or Floor)','Glute Bridge Marches','Glute Extensions',
  'Goblet Squat','Hack Squat / Quad-Biased Squat','Hammer Curls',
  'Hamstring Curl','Hip Abduction Machine','Outdoor Walk','Running',
  'Seated Rows','Shoulder Press (Smith or Dumbbells)',
  'Single Arm Cable Pushdowns','Single Arm Dumbbell Row',
  'Single Arm Lateral Cable Raise','Skull Crushers','Stairmaster',
  'Standing Dumbbell Curls','Steady-State Cardio','Step-Ups','Sumo Squats',
  'Treadmill Walking','Tricep Seated Dip Machine','Upright Rows',
  'Walking Lunges','Wall Sit'
];

/* ---------- helpers ---------- */
const orderedDays    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const isApproved     = n => approvedExercises.includes(n);
const exerciseListMd = approvedExercises.map((e,i)=>`${i+1}. ${e}`).join('\n');

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { summary = '' } = req.body;
    if (typeof summary !== 'string' || !summary.trim())
      return res.status(400).json({ error: 'Missing or invalid summary' });

    /* --- pull focus areas so GPT biases selection --- */
    const m      = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focus  = m ? m[1].trim() : 'the selected areas';

    /* ---------- prompt ---------- */
    const prompt = `
Design a Monday–Sunday, weighted-only workout plan.

RULES
1. ≥80 % of weekly movements must target **${focus}**.
2. No isolation work for muscles outside that list.
3. Use ONLY exercises from the approved list.
4. Hypertrophy sets/reps (3–4 × 8-15 unless logically different).
5. No body-weight-only moves.
6. **Respond with MINIFIED JSON ONLY** – no markdown or fences.
   {"Monday":[{"name":"Hip Thrusts","sets":4,"reps":10}],"Tuesday":"Rest",...}

User summary:
${summary}

Approved exercises:
${exerciseListMd}

Generate the JSON now.`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.55,
      messages: [
        { role: 'system', content: 'You are a certified strength coach.' },
        { role: 'user',   content: prompt }
      ]
    });

    /* ---------- sanitise & parse LLM output ---------- */
    let raw = completion.choices[0].message.content.trim();

    // remove ```json or ``` fences if present
    raw = raw
      .replace(/^```(?:json)?\s*/i, '')   // opening fence
      .replace(/\s*```$/i, '');           // closing fence

    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      console.error('JSON parse error – raw LLM output:', raw);
      return res.status(500).json({ error: 'LLM returned invalid JSON' });
    }

    /* ---------- normalise: ensure every weekday present ---------- */
    const cleanPlan = {};
    for (const day of orderedDays) {
      let val = plan[day];

      if (val === undefined || val === null) val = 'Rest';

      // convert empty arrays / arrays of empties to "Rest"
      if (Array.isArray(val)) {
        val = val.filter(ex => ex && typeof ex === 'object' && isApproved(ex.name));
        if (!val.length) val = 'Rest';
      }

      cleanPlan[day] = val;
    }

    return res.status(200).json({ plan: cleanPlan });

  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
