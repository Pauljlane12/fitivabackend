// /api/generate-plan.js
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------- 65 approved weighted movements -------- */
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

const orderedDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const isApproved  = n => approvedExercises.includes(n);

/* ------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  try {
    const { summary='' } = req.body;
    if (!summary.trim()) return res.status(400).json({ error:'Missing or invalid summary' });

    const m      = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focus  = m ? m[1].trim() : 'the selected areas';
    const prompt = `
Design a weighted-only workout plan, Monday through Sunday.

• ≥80 % of weekly exercises must target **${focus}**  
• Use only the approved exercise list below  
• 6 exercises max per workout day (omit a day entirely for rest)  
• 3 – 4 sets × 8 – 15 reps unless logically different  
• No body-weight-only moves  
• Respond *only* with a valid JSON object exactly in this shape:

{
  "Monday": [{ "name": "...", "sets": 4, "reps": 10 }, …],
  "Tuesday": [],
  …
  "Sunday": []
}

User summary:
${summary}

Approved exercises:
${approvedExercises.join(', ')}
`.trim();

    /* ---------- GPT-4o in JSON mode ---------- */
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.5,
      response_format: { type: 'json_object' },   // <-- the magic line
      messages: [
        { role:'system', content:'You are a certified strength coach.' },
        { role:'user',   content: prompt }
      ]
    });

    const planRaw = completion.choices[0].message.content;
    console.log('🔵 RAW GPT JSON:', planRaw);      // visible in Vercel logs

    /* ---------- sanitise ---------- */
    let plan;
    try {
      plan = JSON.parse(planRaw);
    } catch (err) {
      console.error('❌ JSON parse error', err);
      return res.status(500).json({ error:'LLM returned invalid JSON' });
    }

    const cleanPlan = {};
    for (const day of orderedDays) {
      let list = Array.isArray(plan[day]) ? plan[day] : [];

      // accept up to 6 valid exercises
      list = list
        .filter(ex => ex && typeof ex === 'object' && isApproved(ex.name))
        .slice(0, 6);

      cleanPlan[day] = list; // an empty array naturally means “rest”
    }

    console.log('✅ CLEAN PLAN:', JSON.stringify(cleanPlan));
    return res.status(200).json({ plan: cleanPlan });

  } catch (err) {
    console.error('🔥 Plan generation error:', err);
    return res.status(500).json({ error:'Workout plan generation failed' });
  }
}
