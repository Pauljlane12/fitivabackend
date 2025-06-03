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
const dow         = { Monday:'Mo', Tuesday:'Tu', Wednesday:'We', Thursday:'Th',
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

Create a weighted-only routine for Monday → Sunday.

Rules
• **Exactly six (6)** approved exercises each workout day  
• 4 – 6 total workout days (remaining days = rest)  
• ≥80 % of weekly moves must emphasise **${focus}**  
• Provide two isolation-dominant days for ${focus}  
• No body-weight-only exercises  
• Use ONLY the approvedExercises below  
• Return **RAW JSON** (no markdown) with this shape:

{
  "Monday": {
    "abbr": "Lower",              // very short blanket term (Upper / Lower / Glute/Back / Rest)
    "label": "Lower Body Power",  // longer UI title
    "exercises": [
      { "name": "Hip Thrusts", "sets": 4, "reps": 12 },
      … exactly 6 objects …
    ]
  },
  "Tuesday": { "abbr": "Rest", "label": "Rest Day", "exercises": [] },
  ...
  "Sunday":  { ... }
}

User summary:
${summary}

approvedExercises:
${approvedExercises.join(', ')}
`.trim();

    /* ----- GPT-4o in JSON-object mode ----- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [ { role:'user', content: prompt } ]
    });

    const raw = choices[0].message.content;
    console.log('🔵 RAW GPT JSON:', raw);

    /* ---------- parse & hard-enforce ---------- */
    let plan;
    try { plan = JSON.parse(raw); }
    catch (e) {
      console.error('❌ JSON parse error', e);
      return res.status(500).json({ error: 'LLM returned invalid JSON' });
    }

    /* Build final guaranteed-valid plan */
    const finalPlan = {};
    for (const day of orderedDays) {
      const dayObj = plan?.[day] ?? {};
      let list     = Array.isArray(dayObj.exercises) ? dayObj.exercises : [];

      /* keep only approved & first 6 */
      list = list.filter(ex => ex && isApproved(ex.name)).slice(0, 6);

      /* determine abbr + label */
      let abbrShort = (dayObj.abbr || '').trim();
      let labelLong = (dayObj.label || '').trim();

      if (list.length !== 6) {        // treat as rest if bad count
        list       = [];
        abbrShort  = 'Rest';
        labelLong  = 'Rest Day';
      } else {
        /* fallback abbreviations if GPT missed them */
        if (!abbrShort) {
          const l = labelLong.toLowerCase();
          abbrShort =
            l.includes('upper') ? 'Upper' :
            l.includes('lower') ? 'Lower' :
            l.includes('glute')||l.includes('leg') ? 'Lower' :
            l.includes('back')  ? 'Upper' :
            'Workout';
        }
        if (!labelLong) labelLong = `${abbrShort} Workout`;
      }

      finalPlan[day] = {
        dow: dow[day],        // Mo / Tu / …
        abbr: abbrShort,      // Lower / Upper / Rest
        label: labelLong,     // full title
        exercises: list
      };
    }

    console.log('✅ CLEAN PLAN:', JSON.stringify(finalPlan));
    return res.status(200).json({ plan: finalPlan });

  } catch (err) {
    console.error('🔥 Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
