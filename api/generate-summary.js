// /api/generate-summary.js
import { OpenAI } from 'openai';
const openai       = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROD_DOMAIN  = 'https://fitivabackend.vercel.app';  // <-- change if you have a custom domain
const CALL_TIMEOUT = 40_000;                              // ms

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  try {
    /* ---------- 1. Pull onboarding fields ---------- */
    const {
      gender, age,
      height_feet:  heightFeet,
      height_inches:heightInches,
      weight, fitness_experience:fitnessExperience,
      primary_goal:primaryGoal, overall_goals:overallGoals=[],
      fitness_areas:fitnessAreas=[], exercise_frequency:exerciseFrequency,
      motivations=[], has_gym_access:gymAccess,
      home_equipment:equipment=[], health_risks:healthConcerns=[]
    } = req.body;

    /* ---------- 2. Build plain-English summary ---------- */
    const join = a => (a&&a.length ? a.join(', ') : 'none');
    const summary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet}-${heightInches}" tall. They are at an ${fitnessExperience} fitness level.

Primary goal: ${primaryGoal}. Secondary goals: ${join(overallGoals)}.
Focus areas: ${join(fitnessAreas)}.
Frequency: ${exerciseFrequency} × per week. Motivation: ${join(motivations)}.
Equipment: ${gymAccess ? 'full gym' : (equipment.length ? equipment.join(', ') : 'body-weight only')}.
Health concerns: ${join(healthConcerns)}.
`.trim();

    console.log('📝 SUMMARY:', summary);

    /* ---------- 3. (Optional) have GPT-3.5 echo the summary ---------- */
    const { choices } = await openai.chat.completions.create({
      model:'gpt-3.5-turbo',
      temperature:0,
      messages:[
        { role:'system', content:'You are a formatting assistant.' },
        { role:'user',   content:`Return exactly this paragraph, unchanged:\n\n"${summary}"` }
      ]
    });
    const sanitized = choices[0].message.content.trim();
    console.log('🔧 SANITIZED SUMMARY:', sanitized);

    /* ---------- 4. Determine base URL for internal call ---------- */
    const hostHeader = req.headers['x-forwarded-host'];
    const base =
      process.env.NODE_ENV === 'production'
        ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : PROD_DOMAIN)
        : (hostHeader ? `http://${hostHeader}` : 'http://localhost:3000');

    console.log('🌐 CALLING generate-plan at:', base + '/api/generate-plan');

    /* ---------- 5. POST to /api/generate-plan with timeout ---------- */
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CALL_TIMEOUT);

    const planRes = await fetch(base + '/api/generate-plan', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ summary:sanitized }),
      signal:abort.signal
    }).finally(() => clearTimeout(timer));

    if (!planRes.ok) {
      const text = await planRes.text();
      throw new Error(`generate-plan (${planRes.status}) → ${text}`);
    }

    const { plan } = await planRes.json();
    console.log('✅ PLAN RECEIVED:', JSON.stringify(plan));

    /* ---------- 6. Return only the plan to the frontend ---------- */
    return res.status(200).json({ plan });

  } catch (err) {
    console.error('🔥 Summary pipeline error:', err);
    return res.status(500).json({ error:'Summary + Plan generation failed' });
  }
}
