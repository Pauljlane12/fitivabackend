// File: /api/generate-plan.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { summary } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    // Full list of allowed exercises (weighted only)
    const allowedExercises = `
1. Hip Thrusts
2. Incline Dumbbell Curls
3. Incline Press (Machine or Dumbbell)
4. Lat Pulldowns
5. Lat Pushdowns
6. Leg Extensions
7. Leg Lifts
8. Leg Press Machine
9. Machine Chest Press
10. Overhead Cable Pushdowns
11. Preacher Curls
12. Pull-Ups / Assisted Pull-Ups
13. Rear Delt Flys
14. Reverse Flys
15. Reverse Lunges
16. Romanian Deadlifts
17. Seated Leg Raise Machine
18. Ab Crunch Machine
19. Banded Lateral Walks
20. Bent Over Rows
21. Box Step-Up (Quad Emphasis)
22. Bulgarian Split Squats
23. Cable Curls
24. Cable Flys
25. Cable Kickbacks
26. Cable Pushdowns
27. Cross-Body Dumbbell Curls
28. Curtsy Lunge
29. Dumbbell Front Squat
30. Dumbbell Lateral Raises
31. Frog Pumps
32. Front Plate Raise
33. Glute Bridge (Machine or Floor)
34. Glute Bridge Marches
35. Glute Extensions
36. Goblet Squat
37. Hack Squat / Quad-Biased Squat
38. Hammer Curls
39. Hamstring Curl
40. Hip Abduction Machine
41. Seated Rows
42. Shoulder Press (Smith or Dumbbells)
43. Single Arm Cable Pushdowns
44. Single Arm Dumbbell Row
45. Single Arm Lateral Cable Raise
46. Skull Crushers
47. Standing Dumbbell Curls
48. Step-Ups
49. Sumo Squats
50. Tricep Seated Dip Machine
51. Upright Rows
52. Walking Lunges
53. Wall Sit
`;

    const prompt = `
You are a fitness coach. Based on the following user summary, create a weekly 7-day workout plan (Monday through Sunday) using **only the allowed weighted exercises** listed below. Avoid bodyweight exercises completely. Recommend 4–5 exercises per day, with ideal sets and reps for each.

User Summary:
${summary}

Allowed Weighted Exercises:
${allowedExercises}

Respond in Markdown format. Each day should have a heading and a table of exercises with sets and reps. Make the plan realistic and varied.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a helpful and knowledgeable fitness coach.' },
        { role: 'user', content: prompt }
      ]
    });

    const plan = completion.choices[0].message.content.trim();

    return res.status(200).json({ plan });

  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
}
