// File: /api/generate-plan.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --- Approved gym-only movements --- */
const approvedExercises = [
  "Hip Thrusts","Incline Dumbbell Curls","Incline Press (Machine or Dumbbell)",
  "Lat Pulldowns","Lat Pushdowns","Leg Extensions","Leg Lifts",
  "Leg Press Machine","Leg Raise Hold (Reverse Plank)","Machine Chest Press",
  "Oblique Taps","Overhead Cable Pushdowns","Preacher Curls",
  "Pull-Ups / Assisted Pull-Ups","Rear Delt Flys","Reverse Flys",
  "Reverse Lunges","Romanian Deadlifts","Seated Leg Raise Machine",
  "Ab Crunch Machine","Banded Lateral Walks","Bent Over Rows",
  "Bicycle Crunches","Box Step-Up (Quad Emphasis)","Bulgarian Split Squats",
  "Cable Curls","Cable Flys","Cable Kickbacks","Cable Pushdowns",
  "Cross-Body Dumbbell Curls","Curtsy Lunge","Dumbbell Front Squat",
  "Dumbbell Lateral Raises","Flutter Kicks","Frog Pumps","Front Plate Raise",
  "Glute Bridge (Machine or Floor)","Glute Bridge Marches","Glute Extensions",
  "Goblet Squat","Hack Squat / Quad-Biased Squat","Hammer Curls",
  "Hamstring Curl","Hip Abduction Machine","Outdoor Walk","Running",
  "Seated Rows","Shoulder Press (Smith or Dumbbells)",
  "Single Arm Cable Pushdowns","Single Arm Dumbbell Row",
  "Single Arm Lateral Cable Raise","Skull Crushers","Stairmaster",
  "Standing Dumbbell Curls","Steady-State Cardio","Step-Ups","Sumo Squats",
  "Treadmill Walking","Tricep Seated Dip Machine","Upright Rows",
  "Walking Lunges","Wall Sit"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { summary } = req.body;
    if (!summary || typeof summary !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid summary' });
    }

    /* --- Extract user focus areas from summary --- */
    const match = summary.match(/focus on (?:the following areas:)?\s*([^\.]+)/i);
    const focusAreas = match ? match[1].trim() : 'the selected areas';

    const exerciseList = approvedExercises.map((e, i) => `${i + 1}. ${e}`).join('\n');

    /* --- Prompt: ask for VALID JSON only --- */
    const prompt = `
Design a Monday–Sunday weighted-only workout plan for the user below.

Rules:
1. ≥80 % of all exercises each week must directly target **${focusAreas}**.
2. No isolation work for muscles not in the focus list.
3. Use only exercises from the approved list.
4. Provide sensible hypertrophy sets/reps (3–4 × 8–15 unless otherwise logical).
5. No body-weight-only moves.
6. **Return ONLY valid minified JSON** – no markdown, no comments.

JSON schema example:
{
  "Monday": [
    { "name": "Hip Thrusts", "sets": 4, "reps": 10 }
  ],
  "Tuesday": [ ... ],
  "Wednesday": [],
  ...
  "Sunday": []
}

User summary:
${summary}

Approved Exercises:
${exerciseList}

Generate the JSON now.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.6,
      messages: [
        { role: 'system', content: 'You are a certified fitness coach.' },
        { role: 'user',   content: prompt }
      ]
    });

    /* --- Parse the returned JSON --- */
    const raw = completion.choices[0].message.content.trim();
    let planObject;
    try {
      planObject = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse error. Raw response:', raw);
      return res.status(500).json({ error: 'LLM returned invalid JSON' });
    }

    return res.status(200).json({ plan: planObject });

  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
