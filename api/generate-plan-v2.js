// pages/api/generate-plan-v2.js
// -------------------------------------------------------
// FULL, SELF-CONTAINED ENDPOINT   (ES-module syntax)
// Requires:  OPENAI_API_KEY  in env
// -------------------------------------------------------
import { OpenAI } from 'openai';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/* ─────────────────────────────────────────────────────────
   1.  INITIALISE CLIENTS
───────────────────────────────────────────────────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/* ─────────────────────────────────────────────────────────
   2.  CONSTANTS & HELPERS
───────────────────────────────────────────────────────── */
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
const normalize = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const approvedSet = new Set(approvedExercises.map(normalize));

const ERR = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ─────────────────────────────────────────────────────────
   3.  JSON-SCHEMA FOR THE PLAN
───────────────────────────────────────────────────────── */
const planSchema = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      patternProperties: {
        '^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$': {
          type: 'object',
          required: ['title','description','estimatedDuration','intensity','exercises'],
          properties: {
            title:             { type: 'string' },
            description:       { type: 'string' },
            estimatedDuration: { type: 'number' },
            intensity:         { type: 'string' },
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
                  id:   { type: 'string' },
                  name: { type: 'string' },
                  sets: { type: 'integer', const: 3 },
                  reps: { type: 'integer', minimum: 1 },
                  equipment: {
                    type: 'object',
                    required: ['primary','alternatives'],
                    properties: {
                      primary:      { type: 'string' },
                      alternatives: { type: 'array', items: { type: 'object' } }
                    }
                  },
                  recommendedWeight: {
                    type: 'object',
                    required: ['beginner','intermediate','advanced','userLevel'],
                    properties: {
                      beginner:     { type: 'number' },
                      intermediate: { type: 'number', exclusiveMinimum: 0 },
                      advanced:     { type: 'number' },
                      userLevel:    { type: 'number' }
                    }
                  },
                  muscleGroups: {
                    type: 'object',
                    required: ['primary','secondary'],
                    properties: {
                      primary:   { type: 'array', items: { type: 'string' } },
                      secondary: { type: 'array', items: { type: 'string' } }
                    }
                  },
                  restTime:     { type: 'number' },
                  description:  { type: 'string' },
                  instructions: { type: 'array', items: { type: 'string' } },
                  tips:         { type: 'array', items: { type: 'string' } },
                  difficulty:   { type: 'string' },
                  progressions: {
                    type: 'object',
                    required: ['easier','harder'],
                    properties: { easier: { type: 'string' }, harder: { type: 'string' } }
                  },
                  tempo: {
                    type: 'object',
                    properties: {
                      eccentric:    { type: 'number' },
                      pauseBottom:  { type: 'number' },
                      concentric:   { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  required: ['plan']
};
const validatePlan = ajv.compile(planSchema);

/* ─────────────────────────────────────────────────────────
   4.  SANITISER — AUTO-FIXES LLM TYPOES & TYPE ISSUES
───────────────────────────────────────────────────────── */
function coerceNumber (v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const num = parseFloat(v.replace(/[^\d.-]/g, '')); // strip units
    return isFinite(num) ? num : 0;
  }
  return 0;
}

function sanitisePlan (data) {
  if (!data?.plan) return;

  for (const dayObj of Object.values(data.plan)) {
    if (!Array.isArray(dayObj.exercises)) continue;

    dayObj.exercises.forEach(ex => {
      // id ⇒ string
      ex.id = String(ex.id ?? '').trim() || crypto.randomUUID();

      // reps / sets ⇒ ints
      ex.sets = 3;
      ex.reps = parseInt(ex.reps ?? 0, 10) || 8;

      // recommendedWeight ⇒ numbers only
      if (ex.recommendedWeight) {
        ['beginner','intermediate','advanced','userLevel']
          .forEach(key => {
            ex.recommendedWeight[key] =
              coerceNumber(ex.recommendedWeight[key]);
          });
      }

      // equipment.alternatives ⇒ array of objects
      if (ex.equipment?.alternatives) {
        ex.equipment.alternatives = ex.equipment.alternatives.map(item =>
          typeof item === 'string'
            ? { name: item }
            : item
        );
      }

      // muscleGroups ⇒ ensure object w/ primary & secondary
      if (Array.isArray(ex.muscleGroups)) {
        ex.muscleGroups = { primary: ex.muscleGroups, secondary: [] };
      } else if (typeof ex.muscleGroups !== 'object') {
        ex.muscleGroups = { primary: [], secondary: [] };
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────
   5.  MAIN HANDLER
───────────────────────────────────────────────────────── */
export default async function handler (req, res) {
  if (req.method !== 'POST') return ERR(res, 'Method not allowed', 405);

  try {
    const { summary = '' } = req.body;
    if (!summary.trim()) return ERR(res, 'Missing or invalid summary');

    /* -------- A. Extract meta (focus areas & freq) ------ */
    const focusMatch = summary.match(/Focus\s*(?:areas|on)\s*[:\-]?\s*([^\.\n]+)/i);
    const focusAreas = focusMatch
      ? focusMatch[1].split(/,\s*/).map(s => s.trim())
      : ['full body'];

    const freqMatch = summary.match(/Frequency\s*[:\-]?\s*(\d+)/i);
    const freqDays  = Math.min(Math.max(parseInt(freqMatch?.[1] || '4', 10), 1), 7);

    /* -------- B. GPT-4o PROMPT ------------------------- */
    const prompt = `
You are a certified strength coach. Generate a RAW JSON workout plan for exactly **${freqDays}** distinct workout days (out of Monday–Sunday) that matches the schema described below.

**Global Rules**
• Title ≤ 4 words. • Every exercise name ≤ 4 words and must come from the Approved list.  
• sets = 3 (constant). reps integer ≥ 1.  
• recommendedWeight.* must be numbers (no units, no strings).  
• equipment.alternatives → array of objects like {"name":"Smith Machine"} (never strings).  
• muscleGroups must be an object {"primary":[…],"secondary":[…]}.  
• Never use "bodyweight" equipment for intermediate users — give numeric weight.  
• Intermediate weights must be > 0.  
• Use only the exercises in the Approved list exactly as written.  
• Output **RAW JSON** with a top-level key \`plan\` containing only the chosen days.

**Schema excerpt (for reference)**
{
  "plan": {
    "Monday": {
      "title":            string,
      "description":      string,
      "estimatedDuration": number,
      "intensity":        string,
      "exercises": [
        {
          "id":              string,
          "name":            string,
          "sets":            3,
          "reps":            integer,
          "equipment": {
            "primary":       string,
            "alternatives": [ { "name": string } ]
          },
          "recommendedWeight": {
            "beginner":      number,
            "intermediate":  number,
            "advanced":      number,
            "userLevel":     number
          },
          "muscleGroups": {
            "primary":     [string],
            "secondary":   [string]
          },
          "restTime":        number,
          "description":     string,
          "instructions":    [string],
          "tips":            [string],
          "difficulty":      string,
          "progressions": {
            "easier": string,
            "harder": string
          },
          "tempo": {
            "eccentric":   number, // optional
            "pauseBottom": number, // optional
            "concentric":  number  // optional
          }
        }
      ]
    }
  }
}

**Approved Exercises**
${approvedExercises.join(', ')}

**User summary**
${summary}
`;

    /* -------- C. Call OpenAI --------------------------- */
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    let raw = choices?.[0]?.message?.content || '';
    // Strip code fences if GPT included them
    raw = raw.replace(/^\s*```(?:json)?/i, '').replace(/```$/, '').trim();
    let data; try { data = JSON.parse(raw); } catch {
      return ERR(res, 'Invalid JSON from LLM', 500);
    }

    /* -------- D. Sanitise + Validate ------------------- */
    sanitisePlan(data);

    if (!validatePlan(data)) {
      console.error('Schema errors:', validatePlan.errors);
      return ERR(res, 'Plan does not match schema', 500);
    }

    /* -------- E. Custom Constraints -------------------- */
    let workoutDays = 0;
    for (const [day, dayObj] of Object.entries(data.plan)) {
      // Title length
      if (dayObj.title.trim().split(/\s+/).length > 4)
        throw new Error(`Day title too long: ${dayObj.title}`);

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
      workoutDays++;
    }

    // Match requested frequency
    if (workoutDays !== freqDays)
      return ERR(res, `Plan day count ${workoutDays} ≠ requested ${freqDays}`, 500);

    /* -------- F. SUCCESS ------------------------------- */
    return res.status(200).json(data);

  } catch (err) {
    console.error('Error generating workout plan:', err);
    return ERR(res, 'Workout plan generation failed', 500);
  }
}
