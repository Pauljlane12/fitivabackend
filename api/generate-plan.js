// /api/generate-plan.js
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------- approved weighted movements -------- */
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
const isApproved  = name => approvedExercises.includes(name);

/* ------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { summary = '' } = req.body;
    if (!summary.trim())
      return res.status(400).json({ error: 'Missing or invalid summary' });

    /* ---------- build prompt ---------- */
    const m     = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focus = m ? m[1].trim() : 'the selected areas';

    const prompt = `
Design a Monday – Sunday **weighted-only** workout plan.

Rules
• Provide **exactly six (6) exercises** for every training day  
• At least **four** training days (one to three rest days allowed)  
• ≥80 % of all weekly exercises must directly target **${focus}**  
• Include **at least two isolation-dominant days** focused on ${focus}  
• Use ONLY the approved exercises listed below  
• Default rep scheme 3–4 × 8–15 (adjust logically)  
• No body-weight-only moves  
• Return **valid JSON** in this exact shape – nothing else:

{
 "Monday": [ { "name": "...", "sets": 4, "reps": 12 }, … six total … ],
 "Tuesday": [],
 …
 "Sunday": []
}

User summary:
${summary}

Approved exercises:
${approvedExercises.join(', ')}
`.trim();

    /* ---------- GPT-4o (native JSON) ---------- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a certified strength coach.' },
        { role: 'user',   content: prompt }
      ]
    });

    const rawJson = choices[0].message.content;
    console.log('🔵 RAW GPT JSON:', rawJson);

    /* ---------- sanitise & enforce ---------- */
    let plan;
    try {
      plan = JSON.parse(rawJson);
    } catch (err) {
      console.error('❌ JSON parse error', err);
      return res.status(500).json({ error: 'LLM returned invalid JSON' });
    }

    const cleanPlan = {};
    for (const day of orderedDays) {
      let list = Array.isArray(plan[day]) ? plan[day] : [];

      // keep only approved movements
      list = list.filter(
        ex => ex && typeof ex === 'object' && isApproved(ex.name)
      );

      // Enforce EXACTLY 6 exercises on training days
      if (list.length === 0) {
        cleanPlan[day] = [];               // rest day
      } else if (list.length >= 6) {
        cleanPlan[day] = list.slice(0, 6); // trim extras
      } else {
        // not enough → mark as rest (forces dev notice in logs)
        console.warn(`⚠️  ${day} had only ${list.length} exercises; marking as rest`);
        cleanPlan[day] = [];
      }
    }

    console.log('✅ CLEAN PLAN:', JSON.stringify(cleanPlan));
    return res.status(200).json({ plan: cleanPlan });

  } catch (err) {
    console.error('🔥 Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
