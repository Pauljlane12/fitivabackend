// pages/api/generate-workout.js
import { OpenAI } from 'openai';
import { z } from 'zod'; // For input validation
import exercises from '../data/exercises.js'; // Ensure this path is correct

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define a schema for user input validation using Zod
const userSchema = z.object({
  target_muscle_groups: z.array(z.string()).optional().default([]),
  fitness_areas: z.array(z.string()).optional().default([]), // Fallback for target_muscle_groups
  exercise_frequency: z.number().min(1).max(7).optional().default(4),
  weight_lb: z.number().positive().optional().default(150), // Assuming weight is in lbs
  fitness_experience: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  health_risks: z.array(z.string()).optional().default([]),
  has_gym_access: z.boolean().optional().default(false),
  home_equipment: z.array(z.string()).optional().default([]),
  // Add any other expected user properties here, ensuring no stray commas if you modify
});

// Constant for accessory exercise whitelist
const ACCESSORY_WHITELIST = new Set(['Frog Pumps', 'Banded Lateral Walks']);

/** ──────────────────────────────────────────────────────────
 * MAIN HANDLER
 * ──────────────────────────────────────────────────────────*/
export default async function handler(req, res) {
  const t0 = Date.now();
  console.log('⚡️ /api/generate-workout invoked');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let validatedUser;
  try {
    validatedUser = userSchema.parse(req.body);
  } catch (error) {
    console.warn('❗ Invalid user data:', error.errors);
    return res.status(400).json({ error: 'Invalid user data', details: error.flatten() });
  }

  const user = validatedUser;
  const allowedEquip = deriveAllowedEquipment(user);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildPrompt(user, exercises, allowedEquip, ACCESSORY_WHITELIST);
    console.log(`🧠 Prompt (attempt ${attempt}) – ${prompt.length} chars`);

    try {
      const { choices } = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.55,
        max_tokens: 2000, // Trailing comma here is valid in modern JavaScript
      });

      let txt = (choices?.[0]?.message?.content || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\n]*$/i, '');

      console.log(`📩 GPT answer size (attempt ${attempt}):`, txt.length, 'chars');
      if (!txt) {
        console.warn(`❗ GPT returned empty content on attempt ${attempt}`);
        if (attempt === 2) return res.status(500).json({ error: 'GPT returned empty content twice' });
        continue;
      }

      let plan;
      try {
        plan = JSON.parse(txt);
      } catch (parseError) {
        console.warn(`❗ GPT did not return valid JSON on attempt ${attempt}:`, parseError.message);
        console.log('Raw non-JSON text from GPT (first 500 chars):\n', txt.slice(0, 500));
        if (attempt === 2) return res.status(500).json({ error: 'GPT did not return valid JSON twice' });
        continue;
      }

      if (validatePlan(plan, user, allowedEquip, ACCESSORY_WHITELIST, exercises)) {
        console.log('✅ Plan accepted in', Date.now() - t0, 'ms');
        return res.status(200).json({ plan });
      }

      console.warn(`⚠️ Validation failed on attempt ${attempt}`);
      if (attempt === 2) {
        console.error('Last bad plan (truncated for logging):\n' + txt.slice(0, 1500));
        return res.status(500).json({ error: 'GPT produced a plan that failed validation twice, aborting.' });
      }
    } catch (err) {
      let errorMessage = 'GPT request failed';
      let errorDetails = null;

      if (err instanceof OpenAI.APIError) {
        console.error('❌ OpenAI API Error Status:', err.status);
        console.error('❌ OpenAI API Error Type:', err.type);
        console.error('❌ OpenAI API Error Code:', err.code);
        console.error('❌ OpenAI API Error Message:', err.message);
        errorMessage = `OpenAI API Error: ${err.message}`;
        errorDetails = { type: err.type, code: err.code, status: err.status };
      } else {
        console.error('❌ GPT Request/Unknown Error:', err.message);
        errorMessage = `GPT request error: ${err.message}`;
      }
      // For full debugging: console.error('Full GPT request error object:', err);

      if (attempt === 2) {
        return res.status(500).json({ error: errorMessage, details: errorDetails });
      }
      // Optional: add a small delay before retrying for transient network issues
      // await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/** ──────────────────────────────────────────────────────────
 * PLAN VALIDATOR
 * ──────────────────────────────────────────────────────────*/
function validatePlan(plan, user, allowedEquip, accessoryWL, fullExerciseCatalog) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const byName = Object.fromEntries(fullExerciseCatalog.map(e => [e.name, e]));

  if (!plan || !Array.isArray(plan.workout_plan) || plan.workout_plan.length !== 7) {
    console.warn('Validation fail: Plan structure (workout_plan array or length issue)');
    return false;
  }

  return plan.workout_plan.every(d => {
    if (!d || typeof d.day !== 'string' || !days.includes(d.day)) {
      console.warn(`Validation fail: Invalid day object or day name: ${d?.day}`);
      return false;
    }

    if (d.exercises === 'Rest') return true;

    if (!Array.isArray(d.exercises) || d.exercises.length !== 6) {
      console.warn(`Validation fail: Day ${d.day} - exercises array invalid or length not 6 (found ${d.exercises?.length})`);
      return false;
    }

    return d.exercises.every(ex => {
      if (!ex || typeof ex.name !== 'string') {
        console.warn(`Validation fail: Day ${d.day} - invalid exercise object or missing name`);
        return false;
      }
      const ref = byName[ex.name];
      if (!ref) {
        console.warn(`Validation fail: Day ${d.day} - exercise "${ex.name}" not in catalog.`);
        return false;
      }

      const equipOk = allowedEquip.has(ref.equipment) || accessoryWL.has(ex.name);
      if (!equipOk) {
        console.warn(`Validation fail: Day ${d.day}, Ex: "${ex.name}" - equipment "${ref.equipment}" not allowed or not in accessory whitelist.`);
        return false;
      }

      const needsWeight = ref.equipment !== 'bodyweight' && ref.equipment !== 'resistance_band';
      const weightOk = needsWeight
        ? typeof ex.start_weight_lb === 'number' && ex.start_weight_lb > 0
        : ex.start_weight_lb === undefined || ex.start_weight_lb === null;
      if (!weightOk) {
        console.warn(`Validation fail: Day ${d.day}, Ex: "${ex.name}" - start_weight_lb issue (needs weight: ${needsWeight}, provided: ${ex.start_weight_lb})`);
        return false;
      }

      const setsOk = ex.sets === 3;
      if(!setsOk) {
        console.warn(`Validation fail: Day ${d.day}, Ex: "${ex.name}" - sets not 3 (found ${ex.sets})`);
        return false;
      }

      const repsOk = typeof ex.reps === 'number' && ex.reps >= 6 && ex.reps <= 12;
      if(!repsOk) {
        console.warn(`Validation fail: Day ${d.day}, Ex: "${ex.name}" - reps not between 6-12 (found ${ex.reps})`);
        return false;
      }

      if (ex.notes !== undefined && typeof ex.notes !== 'string') {
        console.warn(`Validation fail: Day ${d.day}, Ex: "${ex.name}" - notes is not a string.`);
        return false;
      }
      return true;
    });
  });
}

/** ──────────────────────────────────────────────────────────
 * PROMPT BUILDER
 * ──────────────────────────────────────────────────────────*/
function buildPrompt(user, catalog, allowedEquip, accessoryWL) {
  const wantedMuscles = new Set(
    (user.target_muscle_groups.length > 0 ? user.target_muscle_groups : user.fitness_areas)
    .map(m => m.toLowerCase())
  );

  const usableExercises = catalog.filter(e =>
    (!wantedMuscles.size || wantedMuscles.has(e.muscle_group?.toLowerCase())) &&
    (allowedEquip.has(e.equipment) || accessoryWL.has(e.name))
  );

  if (usableExercises.length === 0) {
    console.warn("⚠️ No usable exercises found after filtering for prompt building. Plan generation may fail or be poor.");
  }

  const catalogLines = usableExercises
    .map(e => `• ${e.name} — Muscles: ${e.muscle_group}, Equipment: ${e.equipment}`)
    .join('\n');

  const freq = user.exercise_frequency;
  const spacingOptions = {
    1: 'Focus on full body or user priority.',
    2: 'E.g., Mon/Thu or Tue/Fri (full body or upper/lower)',
    3: 'E.g., Mon/Wed/Fri (full body or push/pull/legs)',
    4: 'E.g., Mon/Tue/Thu/Fri (upper/lower split or similar)',
    5: 'E.g., Mon/Tue/Thu/Fri/Sat (e.g., push/pull/legs/upper/lower)',
    6: 'E.g., Mon-Sat with one rest day, ensure muscle group recovery',
    7: 'Daily training, vary intensity and muscle groups heavily', // Trailing comma here is valid
  };
  const spacing = spacingOptions[freq] || `spread ${freq} training days smartly for recovery, ensuring adequate rest between working the same muscle groups.`;

  const bodyWeightLb = user.weight_lb;
  const experienceLevel = user.fitness_experience;
  const strengthMultiplierTable = { beginner: 0.3, intermediate: 0.5, advanced: 0.7 };
  const strengthMultiplier = strengthMultiplierTable[experienceLevel] || 0.5;
  const estimatedBaseWeight = (bodyWeightLb * strengthMultiplier).toFixed(0);

  let healthFlags = '';
  if (user.health_risks?.includes('pregnant')) {
    healthFlags += '\n- User is pregnant: Prioritize safety. Strictly low-impact exercises. Avoid supine positions for heavy work, especially after the first trimester. Avoid exercises that put direct pressure on the abdomen. Consult a doctor before starting any new exercise.';
  }
  if (user.health_risks?.some(r => /joint/i.test(r))) {
    healthFlags += '\n- User has joint issues: Prioritize low-impact movements. Avoid high-impact activities (jumping, running on hard surfaces) and deep, heavily loaded flexion in sensitive joints unless exercise is specifically designed to be gentle. Focus on controlled movements.';
  }

  return `
You are an expert strength and conditioning coach AI. Your task is to generate a personalized 7-day workout plan.
**Return RAW JSON ONLY. No markdown, no commentary, no introductory text before or after the JSON object.**

User Profile:
- Fitness Experience: ${experienceLevel}
- Target Muscle Groups: ${wantedMuscles.size > 0 ? [...wantedMuscles].join(', ') : 'General Fitness'}
- Exercise Frequency: ${freq} days per week.
- Available Equipment Context: ${user.has_gym_access ? 'User has full gym access.' : `User has a home set-up with: ${[...allowedEquip].join(', ') || 'bodyweight only'}.`}
- Estimated Body Weight for strength calculation: ${bodyWeightLb} lbs.
- Health Considerations: ${healthFlags || 'None specified.'}

Workout Plan Rules:
1.  The plan MUST span 7 days (e.g., Monday to Sunday).
2.  Include EXACTLY ${freq} training days. The remaining days MUST be "Rest" days.
3.  For "Rest" days, the "exercises" field should be the string "Rest".
4.  Distribute training days according to this guidance: "${spacing}". Prioritize muscle recovery.
5.  ${user.has_gym_access
    ? `Since user has full gym access, primary lifts should be appropriately weighted. Up to 2 accessory glute-focused exercises from the special whitelist (${[...accessoryWL].join(', ')}) are allowed per training day, even if they are bodyweight or band.`
    : `User has a home set-up. Adhere strictly to the allowed equipment: ${[...allowedEquip].join(', ')}.`}
6.  On EACH training day, include EXACTLY 6 exercises. NO MORE, NO LESS.
7.  Each exercise object MUST have: "name", "sets", "reps", and "notes" (can be an empty string "" or brief guidance).
8.  For "sets", use EXACTLY 3 sets for all exercises.
9.  For "reps", choose a number between 6 and 12 (inclusive) appropriate for the exercise and user level.
10. "start_weight_lb" MUST be included and be a number (e.g., ${estimatedBaseWeight}) for exercises using 'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'plate', 'smith', 'trap_bar', 'ez_bar'. Adjust this weight sensibly based on the exercise type (compound vs isolation) and user profile.
11. OMIT "start_weight_lb" (do not include the key) for 'bodyweight' or 'resistance_band' exercises unless it's an exercise from the accessory whitelist that can optionally be weighted (in which case, follow rule 10 if weighted).
12. CRITICALLY IMPORTANT: Use **ONLY** exercises listed in the "Available Exercise Catalog" below. Do not invent new exercises or variations. Match names exactly.
13. Provide brief, helpful "notes" for each exercise (e.g., "Focus on form", "Control the eccentric phase", "Warm-up set recommended first"). Max 1-2 short sentences.

Available Exercise Catalog (Name — Muscles, Equipment):
${catalogLines || 'No exercises available based on filters. Cannot generate a plan.'}

Return JSON in this exact structure:
{
  "workout_plan": [
    { "day": "Monday", "exercises": [ { "name": "Squats", "sets": 3, "reps": 8, "start_weight_lb": ${estimatedBaseWeight}, "notes": "Ensure full depth." }, /* ...5 more exercises */ ] },
    { "day": "Tuesday", "exercises": "Rest" },
    /* ...and so on for all 7 days */
  ]
}
`.trim();
}

/** ──────────────────────────────────────────────────────────
 * EQUIPMENT HELPER
 * ──────────────────────────────────────────────────────────*/
function deriveAllowedEquipment(user) {
  const gymEquipment = new Set([
    'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable',
    'plate', 'resistance_band', 'bodyweight', 'smith', 'sled', 'trap_bar', 'ez_bar',
    'bench', 'pull_up_bar', // Trailing comma here is valid
  ]);

  if (user.has_gym_access) {
    return gymEquipment;
  }

  const homeEquipmentMap = {
    'dumbbells': 'dumbbell',
    'resistance bands': 'resistance_band',
    'kettlebells': 'kettlebell',
    'pull up bar': 'pull_up_bar',
    'adjustable bench': 'bench',
    'just bodyweight': 'bodyweight',
    'barbell': 'barbell',
    'ez bar': 'ez_bar',
    'plates': 'plate', // Trailing comma here is valid
  };

  const allowed = new Set(['bodyweight']);
  (user.home_equipment || []).forEach(item => {
    const key = item.toLowerCase();
    if (homeEquipmentMap[key]) {
      allowed.add(homeEquipmentMap[key]);
    } else {
      console.log(`Unmapped home equipment item: "${item}" - will not be explicitly added unless it's a generic type already covered.`);
    }
  });

  return allowed;
}
