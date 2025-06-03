import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  const onboarding = req.body;

  try {
    // Step 1: GPT-3.5 — Generate user summary
    const summaryPrompt = `
You are a fitness assistant. Turn this raw user onboarding data into a short paragraph describing their profile for a personal trainer. Include ALL key information: age, gender, weight, fitness level, training goals, days per week, injuries/limitations, and equipment access.

User Data:
${JSON.stringify(onboarding, null, 2)}
`.trim();

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      messages: [
        { role: "system", content: "You are an expert fitness assistant." },
        { role: "user", content: summaryPrompt }
      ]
    });

    const userSummary = summaryResponse.choices[0].message.content.trim();

    // Step 2: GPT-4o — Generate workout plan using summary and hardcoded exercise list
    const exerciseNames = [
      "Hip Thrusts",
      "Incline Dumbbell Curls",
      "Incline Press (Machine or Dumbbell)",
      "Lat Pulldowns",
      "Lat Pushdowns",
      "Leg Extensions",
      "Leg Lifts",
      "Leg Press Machine",
      "Leg Raise Hold (Reverse Plank)",
      "Machine Chest Press",
      "Oblique Taps",
      "Overhead Cable Pushdowns",
      "Planks",
      "Preacher Curls",
      "Pull-Ups / Assisted Pull-Ups",
      "Push-Ups",
      "Rear Delt Flys",
      "Reverse Flys",
      "Reverse Lunges",
      "Romanian Deadlifts",
      "Russian Twists",
      "Seated Leg Raise Machine",
      "Ab Crunch Machine",
      "Banded Lateral Walks",
      "Bent Over Rows",
      "Bicycle Crunches",
      "Box Step-Up (Quad Emphasis)",
      "Bulgarian Split Squats",
      "Cable Curls",
      "Cable Flys",
      "Cable Kickbacks",
      "Cable Pushdowns",
      "Cross-Body Dumbbell Curls",
      "Curtsy Lunge",
      "Dumbbell Front Squat",
      "Dumbbell Lateral Raises",
      "Flutter Kicks",
      "Frog Pumps",
      "Front Plate Raise",
      "Glute Bridge (Machine or Floor)",
      "Glute Bridge Marches",
      "Glute Extensions",
      "Goblet Squat",
      "Hack Squat / Quad-Biased Squat",
      "Hammer Curls",
      "Hamstring Curl",
      "Hip Abduction Machine",
      "Outdoor Walk",
      "Running",
      "Seated Rows",
      "Shoulder Press (Smith or Dumbbells)",
      "Single Arm Cable Pushdowns",
      "Single Arm Dumbbell Row",
      "Single Arm Lateral Cable Raise",
      "Skull Crushers",
      "Stairmaster",
      "Standing Dumbbell Curls",
      "Steady-State Cardio",
      "Step-Ups",
      "Sumo Squats",
      "Treadmill Walking",
      "Tricep Seated Dip Machine",
      "Upright Rows",
      "Walking Lunges",
      "Wall Sit"
    ];

    const planPrompt = `
You are a certified personal trainer.

Based on the following user profile, create a custom workout plan:

${userSummary}

Only choose exercises from this approved list:
${exerciseNames.join(", ")}

Build a ${onboarding.days_per_week}-day workout plan using 5–7 exercises per day. Format it Monday–Sunday. Make smart decisions about exercise selection, volume, and recovery. Assign appropriate sets and reps for each exercise based on the user's goal, experience, and limitations. Avoid repeating the same exercises on back-to-back days. Prioritize muscle groups they care about.
`.trim();

    const planResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      messages: [
        { role: "system", content: "You are a fitness coach creating custom plans." },
        { role: "user", content: planPrompt }
      ]
    });

    const workoutPlan = planResponse.choices[0].message.content.trim();

    return res.status(200).json({ summary: userSummary, plan: workoutPlan });
  } catch (err) {
    console.error("Workout generation error:", err);
    res.status(500).json({ error: "Failed to generate workout" });
  }
}
