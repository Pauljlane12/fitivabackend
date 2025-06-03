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

/* ---------- util ---------- */
const orderedDays    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const isApproved     = name => approvedExercises.includes(name);
const exerciseListMd = approvedExercises.map((e,i)=>`${i+1}. ${e}`).join('\n');

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { summary='' } = req.body;
    if (typeof summary !== 'string' || !summary.trim())
      return res.status(400).json({ error: 'Missing or invalid summary' });

    /* attempt to pull focus phrase so GPT knows what to bias toward */
    const m = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focus = m ? m[1].trim() : 'the selected areas';

    /* ---------- GPT prompt ---------- */
    const prompt = `
Design a Monday–Sunday, weighted-only workout plan.

RULES
1. At least 80% of weekly exercises must target **${focus}**.
2. No isolation for muscles outside that list.
3. Use ONLY the approved exercise list.
4. Hypertrophy rep scheme 3–4 × 8–15 (adjust only when logical).
5. No body-weight-only moves.
6. Respond ONLY with minified JSON, exactly matching this shape:
   {"Monday":[{"name":"Hip Thrusts","sets":4,"reps":10}], "Tuesday":"Rest", … "Sunday":"Rest"}

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

    /* ---------- parse / sanitise ---------- */
    const raw = completion.choices[0].message.content.trim();

    let plan = JSON.parse(raw);   // throws on invalid JSON

    // ensure every weekday appears & clean bad data
    const cleanPlan = {};
    for (const day of orderedDays) {
      let value = plan[day];

      // if day missing -> rest
      if (value === undefined) value = 'Rest';

      // if empty array, or array with only empty objects -> rest
      if (Array.isArray(value)) {
        value = value.filter(
          ex => ex && typeof ex === 'object' && Object.keys(ex).length
        );

        // strip un-approved exercise entries
        value = value.filter(ex => isApproved(ex.name));

        if (!value.length) value = 'Rest';
      }

      cleanPlan[day] = value;
    }

    return res.status(200).json({ plan: cleanPlan });

  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
