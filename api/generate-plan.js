// /api/generate-plan.js
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- approved weighted movements ---------- */
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
const orderedDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const abbr        = { Monday:'Mo', Tuesday:'Tu', Wednesday:'We', Thursday:'Th',
                      Friday:'Fr', Saturday:'Sa', Sunday:'Su' };
const isApproved  = n => approvedExercises.includes(n);

/* ------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { summary = '' } = req.body;
    if (!summary.trim())
      return res.status(400).json({ error: 'Missing or invalid summary' });

    /* ----- build GPT prompt ----- */
    const m     = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focus = m ? m[1].trim() : 'the selected areas';

    const prompt = `
You are a certified strength coach.

Create a Monday–Sunday weighted-only routine.

• EACH workout day must contain **exactly six (6)** approved exercises  
• Provide a short **day label** (e.g. "Lower", "Upper", "Glute/Back", or "Rest")  
• ≥80 % of total weekly movements must emphasise **${focus}**  
• At least **two isolation-dominant days** for ${focus}  
• No body-weight-only moves  
• Use ONLY the "approvedExercises" list below  
• Respond **ONLY with JSON** in this form — no markdown:

{
  "Monday":   { "label": "Lower", "exercises": [ { "name": "...", "sets": 4, "reps": 12 }, … ] },
  "Tuesday":  { "label": "Rest",  "exercises": [] },
  ...
  "Sunday":   { "label": "Lower", "exercises": [ … ] }
}

User summary:
${summary}

approvedExercises:
${approvedExercises.join(', ')}
`.trim();

    /* ----- GPT-4o, JSON-object mode ----- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [ { role:'user', content: prompt } ]
    });

    const raw = choices[0].message.content;
    console.log('🔵 RAW GPT JSON:', raw);

    /* ----- parse & hard-enforce rules ----- */
    let plan;
    try { plan = JSON.parse(raw); }
    catch (e) {
      console.error('❌ JSON parse error', e);
      return res.status(500).json({ error: 'LLM returned invalid JSON' });
    }

    const finalPlan = {};
    for (const day of orderedDays) {
      const dayObj  = plan[day] || {};
      let   list    = Array.isArray(dayObj.exercises) ? dayObj.exercises : [];

      /* keep only approved moves & first 6 */
      list = list.filter(ex => ex && isApproved(ex.name)).slice(0, 6);

      /* if not 6 → mark rest */
      const label = list.length === 6 ? (dayObj.label || 'Workout') : 'Rest';
      finalPlan[day] = { abbr: abbr[day], label, exercises: list.length === 6 ? list : [] };
    }

    console.log('✅ CLEAN PLAN:', JSON.stringify(finalPlan));
    return res.status(200).json({ plan: finalPlan });

  } catch (err) {
    console.error('🔥 Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
