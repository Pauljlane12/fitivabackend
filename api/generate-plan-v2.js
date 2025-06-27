// pages/api/generate-plan-v2.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─────────────────────────────────────────────────────────
   1. CONSTANTS & HELPERS
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
  'Seated Rows','Shoulder Press','Shoulder Press (Smith or Dumbbells)',
  'Single Arm Cable Pushdowns','Single Arm Dumbbell Row',
  'Single Arm Lateral Cable Raise','Skull Crushers','Stairmaster',
  'Standing Dumbbell Curls','Steady-State Cardio','Step-Ups','Sumo Squats',
  'Treadmill Walking','Tricep Seated Dip Machine','Upright Rows',
  'Walking Lunges','Wall Sit'
];

const normalize = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const approvedSet = new Set(approvedExercises.map(normalize));

const ERR = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Fallback UUID generator (no crypto dependency)
const generateId = () => `ex_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

/* ─────────────────────────────────────────────────────────
   2. DATA ENRICHMENT & VALIDATION
───────────────────────────────────────────────────────── */

// Default exercise data based on exercise names
const exerciseDefaults = {
  'Machine Chest Press': {
    equipment: 'Chest Press Machine',
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Shoulders'],
    difficulty: 'beginner',
    restTime: 90
  },
  'Lat Pulldowns': {
    equipment: 'Cable Machine',
    primaryMuscles: ['Lats'],
    secondaryMuscles: ['Biceps', 'Rear Delts'],
    difficulty: 'beginner',
    restTime: 90
  },
  'Leg Press Machine': {
    equipment: 'Leg Press Machine',
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Glutes', 'Hamstrings'],
    difficulty: 'beginner',
    restTime: 120
  },
  'Hip Thrusts': {
    equipment: 'Barbell',
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings'],
    difficulty: 'intermediate',
    restTime: 90
  },
  'Romanian Deadlifts': {
    equipment: 'Dumbbells',
    primaryMuscles: ['Hamstrings'],
    secondaryMuscles: ['Glutes', 'Lower Back'],
    difficulty: 'intermediate',
    restTime: 120
  }
  // Add more as needed - this gives us fallbacks
};

function getExerciseDefaults(exerciseName) {
  const defaults = exerciseDefaults[exerciseName];
  if (defaults) return defaults;
  
  // Generic fallbacks based on exercise name patterns
  const lowerName = exerciseName.toLowerCase();
  
  if (lowerName.includes('chest') || lowerName.includes('press')) {
    return {
      equipment: 'Dumbbells',
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Triceps'],
      difficulty: 'intermediate',
      restTime: 90
    };
  }
  
  if (lowerName.includes('curl')) {
    return {
      equipment: 'Dumbbells',
      primaryMuscles: ['Biceps'],
      secondaryMuscles: ['Forearms'],
      difficulty: 'beginner',
      restTime: 60
    };
  }
  
  if (lowerName.includes('squat') || lowerName.includes('leg')) {
    return {
      equipment: 'Dumbbells',
      primaryMuscles: ['Quadriceps'],
      secondaryMuscles: ['Glutes'],
      difficulty: 'intermediate',
      restTime: 120
    };
  }
  
  // Ultimate fallback
  return {
    equipment: 'Dumbbells',
    primaryMuscles: ['Full Body'],
    secondaryMuscles: [],
    difficulty: 'intermediate',
    restTime: 90
  };
}

function cleanAndValidateExercise(ex, index, dayName) {
  try {
    const defaults = getExerciseDefaults(ex.name || '');
    
    // Core fields with strong defaults
    const cleanExercise = {
      id: ex.id || generateId(),
      name: ex.name || 'Unknown Exercise',
      sets: 3, // Always 3 as per requirements
      reps: Math.max(1, parseInt(ex.reps) || 10),
      
      equipment: {
        primary: ex.equipment?.primary || defaults.equipment,
        alternatives: Array.isArray(ex.equipment?.alternatives) 
          ? ex.equipment.alternatives.map(alt => 
              typeof alt === 'object' && alt.name ? alt : { name: String(alt) }
            )
          : [{ name: 'Bodyweight' }]
      },
      
      recommendedWeight: {
        beginner: Math.max(0, parseFloat(ex.recommendedWeight?.beginner) || 15),
        intermediate: Math.max(1, parseFloat(ex.recommendedWeight?.intermediate) || 25), // Must be > 0
        advanced: Math.max(0, parseFloat(ex.recommendedWeight?.advanced) || 35),
        userLevel: Math.max(0, parseFloat(ex.recommendedWeight?.userLevel) || 25)
      },
      
      muscleGroups: {
        primary: Array.isArray(ex.muscleGroups?.primary) 
          ? ex.muscleGroups.primary 
          : defaults.primaryMuscles,
        secondary: Array.isArray(ex.muscleGroups?.secondary) 
          ? ex.muscleGroups.secondary 
          : defaults.secondaryMuscles
      },
      
      restTime: Math.max(30, parseInt(ex.restTime) || defaults.restTime),
      description: ex.description || `${ex.name} targets ${defaults.primaryMuscles.join(' and ')}`,
      
      instructions: Array.isArray(ex.instructions) && ex.instructions.length > 0
        ? ex.instructions
        : [`Setup for ${ex.name}`, `Perform the movement with control`, `Return to starting position`],
      
      tips: Array.isArray(ex.tips) && ex.tips.length > 0
        ? ex.tips
        : [`Focus on proper form`, `Control the movement`],
      
      difficulty: ex.difficulty || defaults.difficulty,
      
      progressions: {
        easier: ex.progressions?.easier || 'Reduce weight or reps',
        harder: ex.progressions?.harder || 'Increase weight or reps'
      }
    };
    
    // Optional tempo (only add if provided)
    if (ex.tempo && typeof ex.tempo === 'object') {
      cleanExercise.tempo = {
        eccentric: Math.max(0, parseFloat(ex.tempo.eccentric) || 2),
        pauseBottom: Math.max(0, parseFloat(ex.tempo.pauseBottom) || 0),
        concentric: Math.max(0, parseFloat(ex.tempo.concentric) || 1)
      };
    }
    
    return cleanExercise;
    
  } catch (error) {
    console.error(`Error cleaning exercise ${index} on ${dayName}:`, error);
    // Return a completely safe fallback exercise
    return {
      id: generateId(),
      name: 'Machine Chest Press',
      sets: 3,
      reps: 10,
      equipment: { primary: 'Machine', alternatives: [{ name: 'Dumbbells' }] },
      recommendedWeight: { beginner: 20, intermediate: 35, advanced: 50, userLevel: 35 },
      muscleGroups: { primary: ['Chest'], secondary: ['Triceps'] },
      restTime: 90,
      description: 'Safe fallback exercise',
      instructions: ['Perform with proper form'],
      tips: ['Focus on control'],
      difficulty: 'beginner',
      progressions: { easier: 'Reduce weight', harder: 'Increase weight' }
    };
  }
}

function validateDescription(description) {
  if (!description || typeof description !== 'string') return null;
  
  const words = description.trim().split(/\s+/);
  if (words.length === 30) return description;
  
  // If close to 30 words, try to adjust
  if (words.length >= 25 && words.length <= 35) {
    return words.slice(0, 30).join(' ');
  }
  
  return null; // Let fallback handle it
}

function generateFallbackDescription(dayName) {
  const fallbackDescriptions = {
    'Monday': 'Start your week strong with this energizing upper body workout designed to build confidence, strength, and sculpted muscles for a powerful beginning.',
    'Tuesday': 'Transform your Tuesday with this dynamic full body session targeting multiple muscle groups to boost metabolism, strength, and overall fitness levels effectively.',
    'Wednesday': 'Midweek motivation awaits with this focused lower body workout designed to sculpt strong legs, powerful glutes, and build the foundation of strength.',
    'Thursday': 'Thursday transformation begins with this comprehensive strength training session designed to challenge your muscles, boost confidence, and enhance your overall fitness journey.',
    'Friday': 'Finish your week strong with this empowering workout designed to target key muscle groups, boost endurance, and leave you feeling accomplished and energized.',
    'Saturday': 'Weekend warrior vibes begin with this intense training session designed to maximize strength gains, sculpt lean muscle, and elevate your fitness to new heights.',
    'Sunday': 'Sunday strength session focuses on building a strong foundation with targeted exercises designed to enhance muscle definition, boost confidence, and prepare for success.'
  };
  
  return fallbackDescriptions[dayName] || 'Complete this comprehensive workout designed to build strength, enhance muscle definition, boost confidence, and help you achieve your fitness goals with targeted exercises.';
}

function validateAndCleanPlan(rawData) {
  try {
    // Handle both wrapped and unwrapped responses
    let planData = rawData;
    if (rawData.plan) {
      planData = rawData.plan;
    } else if (!Object.keys(rawData).some(key => 
      ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(key)
    )) {
      throw new Error('No valid day structure found in response');
    }
    
    const cleanPlan = {};
    
    for (const [dayName, dayData] of Object.entries(planData)) {
      // Validate day name
      if (!['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(dayName)) {
        continue; // Skip invalid day names
      }
      
      const cleanDay = {
        title: (dayData.title || `${dayName} Workout`).substring(0, 50), // Limit length
        description: validateDescription(dayData.description) || generateFallbackDescription(dayName),
        estimatedDuration: Math.max(15, Math.min(120, parseInt(dayData.estimatedDuration) || 45)),
        intensity: dayData.intensity || 'moderate',
        exercises: []
      };
      
      // Clean exercises
      if (Array.isArray(dayData.exercises)) {
        for (let i = 0; i < Math.min(6, dayData.exercises.length); i++) {
          const exercise = dayData.exercises[i];
          if (exercise && exercise.name) {
            // Only include approved exercises
            if (approvedSet.has(normalize(exercise.name))) {
              cleanDay.exercises.push(cleanAndValidateExercise(exercise, i, dayName));
            }
          }
        }
      }
      
      // Ensure we have some exercises (fallback)
      if (cleanDay.exercises.length === 0) {
        cleanDay.exercises = [
          cleanAndValidateExercise({ name: 'Machine Chest Press' }, 0, dayName),
          cleanAndValidateExercise({ name: 'Lat Pulldowns' }, 1, dayName),
          cleanAndValidateExercise({ name: 'Leg Press Machine' }, 2, dayName)
        ];
      }
      
      cleanPlan[dayName] = cleanDay;
    }
    
    return { plan: cleanPlan };
    
  } catch (error) {
    console.error('Error validating plan:', error);
    throw new Error(`Plan validation failed: ${error.message}`);
  }
}

/* ─────────────────────────────────────────────────────────
   3. MAIN HANDLER
───────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method !== 'POST') return ERR(res, 'Method not allowed', 405);

  try {
    const { summary = '' } = req.body;
    if (!summary.trim()) return ERR(res, 'Missing or invalid summary');

    console.log('📝 Processing summary:', summary);

    // Extract focus areas and frequency
    const focusMatch = summary.match(/Focus\s*(?:areas|on)\s*[:\-]?\s*([^\.\n]+)/i);
    const focusAreas = focusMatch
      ? focusMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean)
      : ['full body'];

    const freqMatch = summary.match(/Frequency\s*[:\-]?\s*(\d+)/i);
    const freqDays = Math.min(Math.max(parseInt(freqMatch?.[1] || '4', 10), 1), 7);

    console.log(`🎯 Focus: ${focusAreas.join(', ')}, Frequency: ${freqDays} days`);

    // Build prompt for GPT
    const prompt = `You are a certified strength coach. Create a workout plan for exactly ${freqDays} workout days this week.

CRITICAL REQUIREMENTS:
- Return RAW JSON only (no markdown, no explanations)
- Each workout day must have EXACTLY 6 exercises - no more, no less
- Each workout description must be EXACTLY 30 words - motivational and descriptive
- ALL exercise names must come from this approved list: ${approvedExercises.join(', ')}
- Focus areas: ${focusAreas.join(', ')}
- sets must always be 3
- reps should be 8-15
- recommendedWeight.intermediate must be > 0

Return this exact JSON structure:
{
  "Monday": {
    "title": "Upper Body Strength",
    "description": "Build powerful shoulders, sculpted arms, and a strong back with this comprehensive upper body session designed to enhance your strength and confidence.",
    "estimatedDuration": 45,
    "intensity": "moderate",
    "exercises": [
      {
        "name": "Machine Chest Press",
        "sets": 3,
        "reps": 10,
        "equipment": {
          "primary": "Chest Press Machine",
          "alternatives": [{"name": "Dumbbells"}]
        },
        "recommendedWeight": {
          "beginner": 30,
          "intermediate": 50,
          "advanced": 70,
          "userLevel": 50
        },
        "muscleGroups": {
          "primary": ["Chest"],
          "secondary": ["Triceps"]
        },
        "restTime": 90,
        "description": "Builds chest strength",
        "instructions": ["Sit on machine", "Press handles forward"],
        "tips": ["Keep back against pad"],
        "difficulty": "beginner",
        "progressions": {
          "easier": "Reduce weight",
          "harder": "Increase weight"
        }
      },
      {
        "name": "Lat Pulldowns",
        "sets": 3,
        "reps": 12,
        "equipment": {
          "primary": "Cable Machine",
          "alternatives": [{"name": "Resistance Bands"}]
        },
        "recommendedWeight": {
          "beginner": 40,
          "intermediate": 60,
          "advanced": 80,
          "userLevel": 60
        },
        "muscleGroups": {
          "primary": ["Lats"],
          "secondary": ["Biceps"]
        },
        "restTime": 75,
        "description": "Builds back width",
        "instructions": ["Pull bar to chest", "Squeeze shoulder blades"],
        "tips": ["Lean back slightly"],
        "difficulty": "beginner",
        "progressions": {
          "easier": "Use assisted machine",
          "harder": "Add more weight"
        }
      },
      {
        "name": "Leg Press Machine",
        "sets": 3,
        "reps": 15,
        "equipment": {
          "primary": "Leg Press Machine",
          "alternatives": [{"name": "Goblet Squat"}]
        },
        "recommendedWeight": {
          "beginner": 90,
          "intermediate": 135,
          "advanced": 180,
          "userLevel": 135
        },
        "muscleGroups": {
          "primary": ["Quadriceps"],
          "secondary": ["Glutes"]
        },
        "restTime": 90,
        "description": "Builds leg strength",
        "instructions": ["Lower with control", "Press through heels"],
        "tips": ["Keep knees aligned"],
        "difficulty": "beginner",
        "progressions": {
          "easier": "Reduce range of motion",
          "harder": "Single leg variation"
        }
      },
      {
        "name": "Shoulder Press",
        "sets": 3,
        "reps": 10,
        "equipment": {
          "primary": "Dumbbells",
          "alternatives": [{"name": "Machine"}]
        },
        "recommendedWeight": {
          "beginner": 15,
          "intermediate": 25,
          "advanced": 35,
          "userLevel": 25
        },
        "muscleGroups": {
          "primary": ["Shoulders"],
          "secondary": ["Triceps"]
        },
        "restTime": 75,
        "description": "Builds shoulder strength",
        "instructions": ["Press weights overhead", "Control the descent"],
        "tips": ["Keep core engaged"],
        "difficulty": "intermediate",
        "progressions": {
          "easier": "Seated variation",
          "harder": "Standing single arm"
        }
      },
      {
        "name": "Hip Thrusts",
        "sets": 3,
        "reps": 12,
        "equipment": {
          "primary": "Barbell",
          "alternatives": [{"name": "Dumbbells"}]
        },
        "recommendedWeight": {
          "beginner": 45,
          "intermediate": 85,
          "advanced": 135,
          "userLevel": 85
        },
        "muscleGroups": {
          "primary": ["Glutes"],
          "secondary": ["Hamstrings"]
        },
        "restTime": 90,
        "description": "Builds glute strength",
        "instructions": ["Drive hips up", "Squeeze glutes at top"],
        "tips": ["Keep chin tucked"],
        "difficulty": "intermediate",
        "progressions": {
          "easier": "Bodyweight variation",
          "harder": "Single leg version"
        }
      },
      {
        "name": "Romanian Deadlifts",
        "sets": 3,
        "reps": 10,
        "equipment": {
          "primary": "Dumbbells",
          "alternatives": [{"name": "Barbell"}]
        },
        "recommendedWeight": {
          "beginner": 30,
          "intermediate": 50,
          "advanced": 70,
          "userLevel": 50
        },
        "muscleGroups": {
          "primary": ["Hamstrings"],
          "secondary": ["Glutes"]
        },
        "restTime": 90,
        "description": "Targets posterior chain",
        "instructions": ["Hinge at hips", "Keep weights close"],
        "tips": ["Feel stretch in hamstrings"],
        "difficulty": "intermediate",
        "progressions": {
          "easier": "Reduce range of motion",
          "harder": "Single leg variation"
        }
      }
    ]
  }
}

User summary: ${summary}`;

    console.log('🤖 Calling GPT-4o...');
    
    const { choices } = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    const rawResponse = choices?.[0]?.message?.content || '';
    if (!rawResponse) {
      throw new Error('Empty response from GPT-4o');
    }

    console.log('✅ GPT response received, length:', rawResponse.length);

    // Clean the response (remove markdown if present)
    let cleanedResponse = rawResponse
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Parse JSON
    let rawData;
    try {
      rawData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', rawResponse.substring(0, 500));
      throw new Error('Invalid JSON response from GPT-4o');
    }

    console.log('✅ JSON parsed successfully');

    // Validate and clean the plan
    const finalPlan = validateAndCleanPlan(rawData);
    
    // Verify we have the right number of workout days
    const workoutDays = Object.keys(finalPlan.plan).length;
    if (workoutDays === 0) {
      throw new Error('No valid workout days generated');
    }

    console.log(`✅ Plan validated: ${workoutDays} workout days`);
    console.log('Final plan structure:', Object.keys(finalPlan.plan));

    return res.status(200).json(finalPlan);

  } catch (error) {
    console.error('🔥 Error in plan generation:', error);
    return ERR(res, `Plan generation failed: ${error.message}`, 500);
  }
}
