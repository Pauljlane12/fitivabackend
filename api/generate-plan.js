// File: /api/generate-plan.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 65 approved gym exercises (GPT must only use these)
const approvedExercises = [
  "Hip Thrusts", "Incline Dumbbell Curls", "Incline Press (Machine or Dumbbell)",
  "Lat Pulldowns", "Lat Pushdowns", "Leg Extensions", "Leg Lifts",
  "Leg Press Machine", "Leg Raise Hold (Reverse Plank)", "Machine Chest Press",
  "Oblique Taps", "Overhead Cable Pushdowns", "Preacher Curls", "Pull-Ups / Assisted Pull-Ups",
  "Rear Delt Flys", "Reverse Flys", "Reverse Lunges", "Romanian Deadlifts",
  "Seated Leg Raise Machine", "Ab Crunch Machine", "Banded Lateral Walks",
  "Bent Over Rows", "Bicycle Crunches", "Box Step-Up (Quad Emphasis)",
  "Bulgarian Split Squats", "Cable Curls", "Cable Flys", "Cable Kickbacks",
  "Cable Pushdowns", "Cross-Body Dumbbell Curls", "Curtsy Lunge",
  "Dumbbell Front Squat", "Dumbbell Lateral Raises", "Flutter Kicks",
  "Frog Pumps", "Front Plate Raise", "Glute Bridge (Machine or Floor)",
  "Glute Bridge Marches", "Glute Extensions", "Goblet Squat",
  "Hack Squat / Quad-Biased Squat", "Hammer Curls", "Hamstring Curl",
  "Hip Abduction Machine", "Outdoor Walk", "Running", "Seated Rows",
  "Shoulder Press (Smith or Dumbbells)", "Single Arm Cable Pushdowns",
  "Single Arm Dumbbell Row", "Single Arm Lateral Cable Raise",
  "Skull Crushers", "Stairmaster", "Standing Dumbbell Curls",
  "Steady-State Cardio", "Step-Ups", "Sumo Squats", "Treadmill Walking",
  "Tricep Seated Dip Machine", "Upright Rows", "Walking Lunges", "Wall Sit"
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

    const exerciseList = approvedExercises.map((e, i) => `${i + 1}. ${e}`).join('\n');

    const prompt = `
Based on the following user profile summary, create a **Monday through Sunday workout plan** using only the provided list of gym exercises. 

Avoid bodyweight movements (e.g., push-ups, planks). Every exercise must come from the provided list. Assign smart **sets and reps** per exercise.

Respond in Markdown format. Keep workouts goal-driven, efficient, and aligned with gym access and experience level.

--- 

**User Summary:**
${summary}

---

**Approved Exercises (Only choose from this list):**
${exerciseList}

---

Now build the full 7-day gym plan using only weighted exercises. Include sets and reps for each movement.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a certified fitness coach.' },
        { role: 'user', content: prompt }
      ]
    });

    const plan = completion.choices[0].message.content.trim();

    return res.status(200).json({ plan });

  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Workout plan generation failed' });
  }
}
