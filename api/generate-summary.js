// /api/generate-summary.js
import { OpenAI } from 'openai';

const openai       = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROD_DOMAIN  = 'https://fitivabackend.vercel.app';     // ← change if you move the prod domain
const CALL_TIMEOUT = 40_000;                                 // 40 s safeguard

/* ------------- helpers ------------- */
const join = a => (Array.isArray(a) && a.length ? a.join(', ') : 'none');
const makeBaseURL = req => {
  // 👉 local / dev
  if (process.env.NODE_ENV !== 'production') {
    const host  = req.headers['x-forwarded-host'] || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}`;
  }
  // 👉 prod: ALWAYS hit the public domain (avoid SSO preview URL)
  return PROD_DOMAIN;
};

/* ------------- handler ------------- */
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    /* ---------- 1. Pull onboarding fields ---------- */
    const {
      gender,
      age,
      height_feet:   heightFeet,
      height_inches: heightInches,
      weight,
      fitness_experience: fitnessExperience,
      primary_goal:       primaryGoal,
      overall_goals:      overallGoals   = [],
      fitness_areas:      fitnessAreas   = [],
      exercise_frequency: exerciseFrequency,
      motivations = [],
      has_gym_access: gymAccess,
      home_equipment: equipment = [],
      health_risks:   healthConcerns = []
    } = req.body;

    /* ---------- 2. Compose summary ---------- */
    const summary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet}-${heightInches}" tall. They are at an ${fitnessExperience} fitness level.

Primary goal: ${primaryGoal}. Secondary goals: ${join(overallGoals)}.
Focus areas: ${join(fitnessAreas)}.
Frequency: ${exerciseFrequency} × per week. Motivation: ${join(motivations)}.
Equipment: ${gymAccess ? 'full gym' : (equipment.length ? equipment.join(', ') : 'body-weight only')}.
Health concerns: ${join(healthConcerns)}.
`.trim();

    console.log('📝 SUMMARY:\n' + summary);

    /* ---------- 3. (optional) GPT-3.5 echo to strip stray tokens ---------- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a formatting assistant.' },
        { role: 'user',   content: `Return exactly this paragraph unchanged:\n\n"${summary}"` }
      ]
    });
    const sanitizedSummary = choices[0].message.content.trim();
    console.log('🔧 SANITIZED SUMMARY:\n' + sanitizedSummary);

    /* ---------- 4. Internal call to /api/generate-plan ---------- */
    const baseURL = makeBaseURL(req);
    const url     = `${baseURL}/api/generate-plan`;
    console.log('🌐 CALLING generate-plan at:', url);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CALL_TIMEOUT);

    const planRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: sanitizedSummary }),
      signal: abort.signal
    }).finally(() => clearTimeout(timer));

    if (!planRes.ok) {
      const text = await planRes.text();
      throw new Error(`generate-plan (${planRes.status}) → ${text.slice(0,180)}…`);
    }

    const { plan } = await planRes.json();
    console.log('✅ PLAN RECEIVED:', JSON.stringify(plan));

    /* ---------- 5. Return only the plan ---------- */
    return res.status(200).json({ plan });

  } catch (err) {
    console.error('🔥 Summary pipeline error:', err);
    return res.status(500).json({ error: 'Summary + Plan generation failed' });
  }
}
