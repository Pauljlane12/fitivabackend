// pages/api/generate-summary.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROD_DOMAIN = 'https://fitivabackend.vercel.app';     // ← change if you move the prod domain
const RESPONSE_TIMEOUT = 90_000;                            // 90s response timeout (increased for detailed logging)

/* ------------- helpers ------------- */
const join = a => (Array.isArray(a) && a.length ? a.join(', ') : 'none');

const makeBaseURL = req => {
  // 👉 local / dev
  if (process.env.NODE_ENV !== 'production') {
    const host = req.headers['x-forwarded-host'] || 'localhost:3000';
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

  console.log('🚀 Handler started at:', new Date().toISOString());

  // Set response timeout to prevent Vercel from killing the function
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('🔥 Response timeout reached');
      res.status(500).json({ error: 'Request timeout - please try again' });
    }
  }, RESPONSE_TIMEOUT);

  try {
    /* ---------- 1. Pull onboarding fields ---------- */
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
      motivations = [],
      has_gym_access: gymAccess,
      home_equipment: equipment = [],
      health_risks: healthConcerns = []
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
    console.log('🤖 Starting OpenAI call at:', new Date().toISOString());
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a formatting assistant.' },
        { role: 'user', content: `Return exactly this paragraph unchanged:\n\n"${summary}"` }
      ]
    });

    const sanitizedSummary = choices[0].message.content.trim();
    console.log('🤖 OpenAI call completed at:', new Date().toISOString());
    console.log('🔧 SANITIZED SUMMARY:\n' + sanitizedSummary);

    /* ---------- 4. Internal call to /api/generate-plan-v2 ---------- */
    const baseURL = makeBaseURL(req);
    const url = `${baseURL}/api/generate-plan-v2`;  // ← updated to v2
    console.log('🌐 CALLING generate-plan-v2 at:', url);
    console.log('⏰ Starting internal API call at:', new Date().toISOString());

    // Add AbortController back but with longer timeout
    const abort = new AbortController();
    const timer = setTimeout(() => {
      console.log('⏰ Internal request taking too long, aborting...');
      abort.abort();
    }, 75000); // 75 seconds (increased for detailed logging)

    const planRes = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'internal-api-call'
      },
      body: JSON.stringify({ summary: sanitizedSummary }),
      signal: abort.signal
    }).finally(() => clearTimeout(timer));

    console.log('✨ Internal API call completed at:', new Date().toISOString());
    console.log('📊 Response status:', planRes.status);

    if (!planRes.ok) {
      const text = await planRes.text();
      throw new Error(`generate-plan-v2 (${planRes.status}) → ${text.slice(0, 180)}…`);
    }

    const { plan } = await planRes.json();
    console.log('✅ PLAN RECEIVED:', JSON.stringify(plan));
    
    // 🏋️ LOG DETAILED EXERCISE BREAKDOWN
    console.log('\n🏋️ DETAILED EXERCISE BREAKDOWN:');
    Object.keys(plan).forEach(day => {
      if (plan[day].exercises && plan[day].exercises.length > 0) {
        console.log(`\n📅 ${day.toUpperCase()} - ${plan[day].title}:`);
        plan[day].exercises.forEach((exercise, i) => {
          console.log(`  ${i+1}. ${exercise.name || 'Unknown Exercise'}`);
          console.log(`     Sets: ${exercise.sets || 'N/A'} | Reps: ${exercise.reps || 'N/A'}`);
          console.log(`     Target: ${exercise.targetMuscles?.join(', ') || 'N/A'}`);
          console.log(`     Equipment: ${exercise.equipment || 'N/A'}`);
          if (exercise.instructions) {
            console.log(`     Instructions: ${exercise.instructions.substring(0, 100)}...`);
          }
          console.log('');
        });
      }
    });

    /* ---------- 5. Return only the plan ---------- */
    clearTimeout(responseTimeout);
    if (!res.headersSent) {
      return res.status(200).json({ plan });
    }

  } catch (err) {
    console.error('🔥 Summary pipeline error:', err);
    console.error('🔥 Error stack:', err.stack);
    clearTimeout(responseTimeout);
    
    if (!res.headersSent) {
      // Better error messages based on error type
      if (err.name === 'AbortError') {
        console.error('🔥 Request was aborted due to timeout');
        return res.status(500).json({ error: 'Request timeout - the plan generation took too long' });
      } else if (err.message.includes('generate-plan-v2')) {
        return res.status(500).json({ error: 'Plan generation failed - please try again' });
      } else if (err.message.includes('fetch')) {
        return res.status(500).json({ error: 'Internal API call failed - please try again' });
      } else {
        return res.status(500).json({ error: 'Summary + Plan generation failed' });
      }
    }
  }
}
