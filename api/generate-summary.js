// File: /api/generate-summary.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      gender,
      age,
      height_feet: heightFeet,
      height_inches: heightInches,
      weight,
      fitness_experience: fitnessExperience,
      primary_goal: primaryGoal,
      overall_goals: overallGoals = [],
      fitness_areas: fitnessAreas = [],
      exercise_frequency: exerciseFrequency,
      motivations: motivation = [],
      has_gym_access: gymAccess,
      home_equipment: equipment = [],
      health_risks: healthConcerns = []
    } = req.body;

    const listOrNone = arr => (arr && arr.length ? arr.join(', ') : 'none');
    const motivationList     = listOrNone(motivation);
    const overallGoalList    = listOrNone(overallGoals);
    const fitnessAreaList    = listOrNone(fitnessAreas);
    const healthConcernList  = listOrNone(healthConcerns);

    const accessDescription =
      gymAccess
        ? 'full gym'
        : equipment.length
          ? equipment.join(', ')
          : 'body-weight only';

    // 🔹 Construct the summary (structured fill-in-the-blank format)
    const filledSummary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet} feet ${heightInches} inches tall. They are at an ${fitnessExperience} fitness level.

Their primary goal is to ${primaryGoal}, and they also want to ${overallGoalList}.

They want to focus on the following areas: ${fitnessAreaList}.

They plan to work out ${exerciseFrequency} times per week and are motivated by: ${motivationList}.

They have access to: ${accessDescription}.

Relevant health concerns include: ${healthConcernList}.
`.trim();

    // 🔹 Call GPT 3.5 to format the summary (just to sanitize it)
    const gptPrompt = `
Return exactly the paragraph below with no changes whatsoever.

"${filledSummary}"
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a formatting assistant.' },
        { role: 'user', content: gptPrompt }
      ]
    });

    const summary = completion.choices[0].message.content.trim();

    // 🔹 Automatically call the next endpoint (/api/generate-plan)
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }) // only send the summary forward
    });

    if (!response.ok) throw new Error('Plan generation failed');
    const planData = await response.json();

    // ✅ Return only the plan to frontend
    return res.status(200).json({ plan: planData.plan });

  } catch (err) {
    console.error('Summary pipeline error:', err);
    return res.status(500).json({ error: 'Summary + Plan generation failed' });
  }
}
