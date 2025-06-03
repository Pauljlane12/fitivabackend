// File: /api/generate-summary.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    /* ---------- 1. Extract onboarding data ---------- */
    const {
      gender,
      age,
      height_feet:  heightFeet,
      height_inches: heightInches,
      weight,
      fitness_experience: fitnessExperience,
      primary_goal:       primaryGoal,
      overall_goals:      overallGoals   = [],
      fitness_areas:      fitnessAreas   = [],
      exercise_frequency: exerciseFrequency,
      motivations:        motivations    = [],
      has_gym_access:     gymAccess,
      home_equipment:     equipment      = [],
      health_risks:       healthConcerns = []
    } = req.body;

    const listOrNone = arr => (arr && arr.length ? arr.join(', ') : 'none');
    const summary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet} feet ${heightInches} inches tall. They are at an ${fitnessExperience} fitness level.

Their primary goal is to ${primaryGoal}, and they also want to ${listOrNone(overallGoals)}.

They want to focus on the following areas: ${listOrNone(fitnessAreas)}.

They plan to work out ${exerciseFrequency} times per week and are motivated by: ${listOrNone(motivations)}.

They have access to: ${
      gymAccess ? 'full gym' :
      equipment.length ? equipment.join(', ') : 'body-weight only'
    }.

Relevant health concerns include: ${listOrNone(healthConcerns)}.
`.trim();

    /* ---------- 2. (Optional) ask GPT-3.5 to echo the summary ---------- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a formatting assistant.' },
        { role: 'user',   content: `Return exactly this paragraph with no edits:\n\n"${summary}"` }
      ]
    });
    const sanitizedSummary = choices[0].message.content.trim();

    /* ---------- 3. Build a SAFE base-URL for the follow-up call ---------- */
    const prodDomain = 'https://fitivabackend.vercel.app'; // <- change if you use a custom domain
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? prodDomain                                   // avoid SSO preview URLs
        : 'http://localhost:3000';                     // local dev

    /* ---------- 4. Call /api/generate-plan ---------- */
    const planRes = await fetch(`${baseUrl}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: sanitizedSummary })
    });

    if (!planRes.ok) {
      const text = await planRes.text();
      throw new Error(`generate-plan error: ${text}`);
    }

    const { plan } = await planRes.json();

    /* ---------- 5. Return ONLY the plan to the frontend ---------- */
    return res.status(200).json({ plan });

  } catch (err) {
    console.error('Summary pipeline error:', err);
    return res.status(500).json({ error: 'Summary + Plan generation failed' });
  }
}
