// File: /api/generate-summary.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    /* ---------- 1. Pull data from request ---------- */
    const {
      gender,
      age,
      height_feet: heightFeet,        // coming from frontend as snake_case
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

    /* ---------- 2. Clean lists for readable output ---------- */
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

    /* ---------- 3. Create the filled paragraph ---------- */
    const filledSummary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet} feet ${heightInches} inches tall. They are at an ${fitnessExperience} fitness level.

Their primary goal is to ${primaryGoal}, and they also want to ${overallGoalList}.

They want to focus on the following areas: ${fitnessAreaList}.

They plan to work out ${exerciseFrequency} times per week and are motivated by: ${motivationList}.

They have access to: ${accessDescription}.

Relevant health concerns include: ${healthConcernList}.
`.trim();

    /* ---------- 4. Ask GPT-3.5 to echo it back (future-proof) ---------- */
    const gptPrompt = `
Return exactly the paragraph below with no changes whatsoever.

"${filledSummary}"
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a formatting assistant.' },
        { role: 'user',   content: gptPrompt }
      ]
    });

    const summary = completion.choices[0].message.content.trim();

    /* ---------- 5. Send to frontend (or admin dashboard) ---------- */
    return res.status(200).json({ summary });

  } catch (err) {
    console.error('Summary generation error:', err);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}
