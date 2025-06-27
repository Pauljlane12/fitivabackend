// pages/api/generate-plan-v2.js

import { OpenAI } from 'openai';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize AJV for schema validation
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Approved exercises list (normalized names)
const approvedExercises = [
  'Hip Thrusts','Incline Dumbbell Curls','Incline Press (Machine or Dumbbell)',
  'Lat Pulldowns','Lat Pushdowns','Leg Extensions','Leg Lifts',
  'Leg Press Machine','Leg Raise Hold (Reverse Plank)','Machine Chest Press',
  'Oblique Taps','Overhead Cable Pushdowns','Preacher Curls',
  'Pull-Ups / Assisted Pull-Ups','Rear Delt Flys','Reverse Flys',
  'Reverse Lunges','Romanian Deadlifts','Seated Leg Raise Machine',
  'Ab Crunch Machine','Banded Lateral Walks','Bent Over Rows',
  'Bicycle Crunches','Box Step-Up (Quad Emphasis)','Bulgarian Split Squats',
  'Cable Curls','Cable Flys','Cable Kickbacks','Cable Pushdowns',
  'Cross-Body Dumbbell Curls','Curtsy Lunge','Dumbbell Front Squat',
  'Dumbbell Lateral Raises','Flutter Kicks','Frog Pumps','Front Plate Raise',
  'Glute Bridge (Machine or Floor)','Glute Bridge Marches','Glute Extensions',
  'Goblet Squat','Hack Squat / Quad-Biased Squat','Hammer Curls',
  'Hamstring Curl','Hip Abduction Machine','Outdoor Walk','Running',
  'Seated Rows','Shoulder Press (Smith or Dumbbells)',
  'Single Arm Cable Pushdowns','Single Arm Dumbbell Row',
  'Single Arm Lateral Cable Raise','Skull Crushers','Stairmaster',
  'Standing Dumbbell Curls','Steady-State Cardio','Step-Ups','Sumo Squats',
  'Treadmill Walking','Tricep Seated Dip Machine','Upright Rows',
  'Walking Lunges','Wall Sit'
];
const normalize = s => s.trim().toLowerCase().replace(/\s+/g,' ');
const approvedSet = new Set(approvedExercises.map(normalize));

// JSON schema for enriched workout plan
const planSchema = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      patternProperties: {
        '^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$': {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            estimatedDuration: { type: 'number' },
            intensity: { type: 'string' },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'id','name','sets','reps','equipment',
                  'recommendedWeight','muscleGroups','restTime',
                  'description','instructions','tips',
                  'difficulty','progressions'
                ],
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  sets: { type: 'integer', const: 3 },
                  reps: { type: 'integer', minimum: 1 },
                  equipment: {
                    type: 'object',
                    required: ['primary','alternatives'],
                    properties: {
                      primary: { type: 'string' },
                      alternatives: { type: 'array', items: { type: 'object' } }
                    }
                  },
                  recommendedWeight: {
                    type: 'object',
                    required: ['beginner','intermediate','advanced','userLevel'],
                    properties: {
                      beginner: { type: 'number' },
                      intermediate: { type: 'number', exclusiveMinimum: 0 },
                      advanced: { type: 'number' },
                      userLevel: { type: 'number' }
                    }
                  },
                  muscleGroups: {
                    type: 'object',
                    required: ['primary','secondary'],
                    properties: {
                      primary: { type: 'array', items: { type: 'string' } },
                      secondary: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  restTime: { type: 'number' },
                  description: { type: 'string' },
                  instructions: { type: 'array', items: { type: 'string' } },
                  tips: { type: 'array', items: { type: 'string' } },
                  difficulty: { type: 'string' },
                  progressions: {
                    type: 'object',
                    required: ['easier','harder'],
                    properties: { easier: { type: 'string' }, harder: { type: 'string' } }
                  },
                  tempo: {
                    type: 'object',
                    properties: {
                      eccentric: { type: 'number' },
                      pauseBottom: { type: 'number' },
                      concentric: { type: 'number' }
                    }
                  }
                }
              }
            }
          },
          required: ['title','description','estimatedDuration','intensity','exercises']
        }
      }
    }
  },
  required: ['plan']
};
const validatePlan = ajv.compile(planSchema);

// Helper for errors
const ERR = (res, msg, code = 400) => res.status(code).json({ error: msg });

export default async function handler(req, res) {
  if (req.method !== 'POST') return ERR(res, 'Method not allowed', 405);

  try {
    const { summary = '' } = req.body;
    if (!summary.trim()) return ERR(res, 'Missing or invalid summary');

    // Extract focus areas & frequency
    const focusMatch = summary.match(/Focus\s*(?:areas|on)\s*[:\-]?\s*([^\.\n]+)/i);
    const focusAreas = focusMatch
      ? focusMatch[1].split(/,\s*/).map(s => s.trim())
      : ['full body'];
    const freqMatch = summary.match(/Frequency\s*[:\-]?\s*(\d+)/i);
    const freqDays = Math.min(Math.max(parseInt(freqMatch?.[1] || '4', 10), 1), 7);

    // Build OpenAI prompt
    const prompt = `You are a certified strength coach. Generate a JSON plan for exactly ${freqDays} workout days.
All exercise names must be ≤4 words, sets must be 3, reps variable. For each exercise include:
- id, name, sets(3), reps, equipment (primary & alternatives including smith machine),
- recommendedWeight (beginner/intermediate/advanced/userLevel), muscleGroups, restTime(seconds),
- description, instructions[], tips[], difficulty, progressions (easier/harder), optional tempo.
Day object must include title(≤4 words), description, estimatedDuration(min), intensity, exercises[].
Never return bodyweight for intermediates—always numeric weights.
Return RAW JSON with top-level key \`plan\` containing Monday…Sunday. Use only approved exercises listed.

Approved Exercises:
${approvedExercises.join(', ')}

User summary:
${summary}`;

    // Call GPT-4o
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = choices?.[0]?.message?.content;
    if (!raw) return ERR(res, 'LLM returned empty response', 500);

    let data;
    try { data = JSON.parse(raw); }
    catch { return ERR(res, 'Invalid JSON from LLM', 500); }

    // Schema validation
    if (!validatePlan(data)) {
      console.error('Schema errors:', validatePlan.errors);
      return ERR(res, 'Plan does not match schema', 500);
    }

    // Custom enforcement
    let dayCount = 0;
    for (const [day, dayObj] of Object.entries(data.plan)) {
      // Title ≤ 4 words
      if (dayObj.title.trim().split(/\s+/).length > 4)
        throw new Error(`Day title too long: ${dayObj.title}`);

      if (Array.isArray(dayObj.exercises) && dayObj.exercises.length > 0) {
        dayCount++;
        dayObj.exercises.forEach(ex => {
          if (ex.sets !== 3) throw new Error(`Exercise sets≠3: ${ex.name}`);
          if (ex.name.trim().split(/\s+/).length > 4)
            throw new Error(`Name >4 words: ${ex.name}`);
          if (!approvedSet.has(normalize(ex.name)))
            throw new Error(`Unapproved exercise: ${ex.name}`);
          if (ex.recommendedWeight.intermediate <= 0)
            throw new Error(`Invalid intermediate weight: ${ex.name}`);
          if (ex.equipment.primary.trim().toLowerCase() === 'bodyweight')
            throw new Error(`Primary equipment cannot be bodyweight: ${ex.name}`);
        });
      }
    }

    // Ensure workout count matches freqDays
    if (dayCount !== freqDays) {
      return ERR(res, `Plan day count ${dayCount} ≠ requested ${freqDays}`, 500);
    }

    // All good
    return res.status(200).json(data);

  } catch (err) {
    console.error('Error generating workout plan:', err);
    return ERR(res, 'Workout plan generation failed', 500);
  }
}
