import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('🚀 Workout Generator started at:', new Date().toISOString());
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not found');
    }
    // Parse request body with better error handling
    let body;
    try {
      const rawBody = await req.text(); // Get raw text first
      console.log('📥 Raw request body:', rawBody.substring(0, 500) + '...');
      console.log('📏 Body length:', rawBody.length);
      // Try to parse as JSON
      body = JSON.parse(rawBody);
      console.log('✅ Successfully parsed JSON');
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      console.error('🔍 Error position:', parseError.message.match(/position (\d+)/)?.[1]);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body',
        details: parseError.message,
        tip: 'Make sure your JSON is properly formatted'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { gender, age, height_feet: heightFeet, height_inches: heightInches, weight, fitness_experience: fitnessExperience, primary_goal: primaryGoal, fitness_areas: selectedMuscleGroups = [], exercise_frequency: exerciseFrequency, has_gym_access: gymAccess, home_equipment: equipment = [], health_risks: healthConcerns = [], priority_muscle: priorityMuscle = null, wants_isolation_day: wantsIsolationDay = false, core_preference: corePreference = 'sprinkle' // 'sprinkle' or 'heavy_days'
     } = body;
    console.log('📝 User Data:', {
      selectedMuscleGroups,
      exerciseFrequency,
      priorityMuscle,
      wantsIsolationDay,
      corePreference
    });
    // Query exercises based on user's selected muscle groups and equipment
    let equipmentFilter = gymAccess ? [] : equipment; // If gym access, include all equipment
    if (!gymAccess && equipment.length === 0) {
      equipmentFilter = [
        'bodyweight'
      ]; // Default to bodyweight if no equipment
    }
    console.log('🔍 Filtering exercises for muscle groups:', selectedMuscleGroups);
    console.log('🏋️ Equipment available:', equipmentFilter);
    // Convert to lowercase for database matching
    const lowerCaseMuscleGroups = selectedMuscleGroups.map((group)=>group.toLowerCase());
    // Handle "arms" and "legs" selection by expanding to component muscles
    let expandedMuscleGroups = [
      ...lowerCaseMuscleGroups
    ];
    if (lowerCaseMuscleGroups.includes('arms')) {
      // Remove 'arms' and add 'biceps' and 'triceps'
      expandedMuscleGroups = expandedMuscleGroups.filter((group)=>group !== 'arms');
      expandedMuscleGroups.push('biceps', 'triceps');
    }
    if (lowerCaseMuscleGroups.includes('legs')) {
      // Remove 'legs' and add 'quads' and the legs category
      expandedMuscleGroups = expandedMuscleGroups.filter((group)=>group !== 'legs');
      expandedMuscleGroups.push('quads', 'legs'); // 'legs' for hamstring curl
    }
    console.log('🔄 Expanded muscle groups:', expandedMuscleGroups);
    // Build the query for muscle groups (check both muscle_group field and tags array)
    let query = supabase.from('exercises_new').select('*').neq('muscle_group', 'cardio'); // Exclude cardio exercises for weighted workout plans
    // Filter by muscle groups - check if muscle_group is in expandedMuscleGroups OR tags overlap
    if (expandedMuscleGroups.length > 0) {
      console.log('🔍 Database query muscle groups:', expandedMuscleGroups);
      query = query.or(`muscle_group.in.(${expandedMuscleGroups.join(',')}),tags.ov.{${expandedMuscleGroups.join(',')}}`);
    }
    // Always include core exercises if user wants them sprinkled in
    if (corePreference === 'sprinkle' && !expandedMuscleGroups.includes('core')) {
      const muscleGroupsWithCore = [
        ...expandedMuscleGroups,
        'core'
      ];
      console.log('🧘‍♀️ Adding core exercises, final groups:', muscleGroupsWithCore);
      query = query.or(`muscle_group.in.(${muscleGroupsWithCore.join(',')}),tags.ov.{${muscleGroupsWithCore.join(',')}}`);
    }
    // Filter by equipment if not gym access
    if (!gymAccess && equipmentFilter.length > 0) {
      query = query.in('equipment', equipmentFilter);
    }
    // Order by priority (1=highest, 3=lowest) then by name for consistency
    query = query.order('priority', {
      ascending: true
    }).order('name', {
      ascending: true
    });
    const { data: exercises, error } = await query;
    if (error) {
      console.error('❌ Database error:', error);
      throw new Error('Failed to fetch exercises from database');
    }
    console.log(`✅ Found ${exercises.length} matching exercises`);
    // Debug: If no exercises found, try a simple query to see if data exists
    if (exercises.length === 0) {
      console.log('🚨 No exercises found, checking if any exercises exist in database...');
      const { data: allExercises, error: allError } = await supabase.from('exercises_new').select('name, muscle_group, tags').limit(5);
      console.log('📋 Sample exercises in database:', allExercises);
      console.log('🔍 Queried muscle groups were:', expandedMuscleGroups);
      throw new Error(`No exercises found for muscle groups: ${expandedMuscleGroups.join(', ')}. Please check muscle group names.`);
    }
    // Get isolation exercises for priority muscle if requested
    let isolationExercises = [];
    if (wantsIsolationDay && priorityMuscle && parseInt(exerciseFrequency) >= 4) {
      let isoQuery = supabase.from('exercises_new').select('*').neq('muscle_group', 'cardio') // Exclude cardio from isolation exercises too
      .or(`muscle_group.eq.${priorityMuscle},tags.cs.{${priorityMuscle}}`);
      // Apply equipment filter for isolation exercises too
      if (!gymAccess && equipmentFilter.length > 0) {
        isoQuery = isoQuery.in('equipment', equipmentFilter);
      }
      // Order by priority for isolation exercises too
      isoQuery = isoQuery.order('priority', {
        ascending: true
      }).order('name', {
        ascending: true
      });
      const { data: isoExercises, error: isoError } = await isoQuery;
      if (!isoError && isoExercises) {
        isolationExercises = isoExercises;
        console.log(`🎯 Found ${isolationExercises.length} isolation exercises for ${priorityMuscle}`);
      }
    }
    // Separate exercises by priority levels for better AI instruction
    const priority1Exercises = exercises.filter((ex)=>ex.priority === 1);
    const priority2Exercises = exercises.filter((ex)=>ex.priority === 2);
    const priority3Exercises = exercises.filter((ex)=>ex.priority === 3);
    console.log(`📊 Priority breakdown: P1=${priority1Exercises.length}, P2=${priority2Exercises.length}, P3=${priority3Exercises.length}`);
    // Debug logging for priority exercises
    console.log('🔥 HIGHEST PRIORITY EXERCISES:');
    priority1Exercises.forEach((ex, i)=>{
      console.log(`  ${i + 1}. ${ex.name} (${ex.muscle_group}, ${ex.equipment})`);
    });
    console.log('⭐ MEDIUM PRIORITY EXERCISES:');
    priority2Exercises.forEach((ex, i)=>{
      console.log(`  ${i + 1}. ${ex.name} (${ex.muscle_group}, ${ex.equipment})`);
    });
    console.log('⚡ LOWER PRIORITY EXERCISES:');
    priority3Exercises.forEach((ex, i)=>{
      console.log(`  ${i + 1}. ${ex.name} (${ex.muscle_group}, ${ex.equipment})`);
    });
    // Limit exercises sent to AI to focus on highest priority (max 25 total)
    const maxExercises = 25;
    const prioritizedExercises = [
      ...priority1Exercises.slice(0, 15),
      ...priority2Exercises.slice(0, 7),
      ...priority3Exercises.slice(0, 3) // Send up to 3 priority 3 exercises
    ].slice(0, maxExercises);
    const prioritizedIsolation = isolationExercises.slice(0, 15); // Max 15 for isolation
    console.log(`📋 Sending ${prioritizedExercises.length} exercises to AI (prioritized)`);
    console.log(`📊 Sending to AI: ${Math.min(priority1Exercises.length, 15)} priority 1, ${Math.min(priority2Exercises.length, 7)} priority 2, ${Math.min(priority3Exercises.length, 3)} priority 3`);
    if (prioritizedIsolation.length > 0) {
      console.log(`🎯 Sending ${prioritizedIsolation.length} isolation exercises to AI`);
    }
    // Create the summary first (like your original approach)
    const summary = `
Create a workout plan for a ${age}-year-old ${gender} who weighs ${weight} lbs and is ${heightFeet}'${heightInches}" tall. They are at an ${fitnessExperience} fitness level.
Primary goal: ${primaryGoal}. Focus areas: ${selectedMuscleGroups.join(', ')}.
Frequency: ${exerciseFrequency} × per week. 
Equipment: ${gymAccess ? 'Full gym access' : equipmentFilter.join(', ') || 'Bodyweight only'}.
${healthConcerns.length > 0 ? `Health considerations: ${healthConcerns.join(', ')}.` : ''}
${wantsIsolationDay && priorityMuscle ? `Wants dedicated ${priorityMuscle} isolation day.` : ''}
Core preference: ${corePreference === 'sprinkle' ? 'Add 2 core exercises to each workout' : 'Prefers dedicated core-heavy days'}.
`.trim();
    console.log('📝 SUMMARY:\n' + summary);
    // Sanitize the summary with OpenAI (like your original approach)
    console.log('🤖 Starting OpenAI sanitization at:', new Date().toISOString());
    const sanitizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are a formatting assistant.'
          },
          {
            role: 'user',
            content: `Return exactly this paragraph unchanged:\n\n"${summary}"`
          }
        ]
      })
    });
    if (!sanitizationResponse.ok) {
      throw new Error(`OpenAI sanitization error: ${sanitizationResponse.status}`);
    }
    const sanitizationData = await sanitizationResponse.json();
    const sanitizedSummary = sanitizationData.choices[0].message.content.trim();
    console.log('🤖 OpenAI sanitization completed at:', new Date().toISOString());
    console.log('🔧 SANITIZED SUMMARY:\n' + sanitizedSummary);
    // Format exercises with explicit priority labels
    const formatExerciseForAI = (ex)=>{
      const timeBasedExercises = [
        'Planks',
        'Leg Raise Hold (Reverse Plank)',
        'Wall Sit'
      ];
      const repType = timeBasedExercises.includes(ex.name) ? 'seconds' : ex.muscle_group === 'cardio' ? 'minutes' : 'reps';
      const priorityLabel = ex.priority === 1 ? '🔥 HIGHEST PRIORITY' : ex.priority === 2 ? '⭐ MEDIUM PRIORITY' : '⚡ LOWER PRIORITY';
      return `- ${ex.name} (${priorityLabel}, targets: ${ex.muscle_group}, equipment: ${ex.equipment}, default: ${ex.default_sets}x${ex.default_reps} ${repType})`;
    };
    // Create exercise database string with priority sections
    const exerciseDatabase = `
🔥 HIGHEST PRIORITY EXERCISES (Use these first!):
${priority1Exercises.slice(0, 15).map(formatExerciseForAI).join('\n')}

⭐ MEDIUM PRIORITY EXERCISES (Use if needed):
${priority2Exercises.slice(0, 7).map(formatExerciseForAI).join('\n')}

⚡ LOWER PRIORITY EXERCISES (Use only if necessary):
${priority3Exercises.slice(0, 3).map(formatExerciseForAI).join('\n')}
`.trim();
    // Create AI prompt with Hollywood trainer persona
    const basePrompt = `
You are a elite Hollywood personal trainer who specializes exclusively in training women. You've worked with A-list actresses, models, and influencers to create their dream physiques. You understand what women really want from their workouts - to feel strong, confident, and achieve that coveted "Instagram-worthy" body.

Your expertise includes:
- Understanding women's specific fitness goals and motivations
- Creating workouts that build the curves and strength women desire
- Selecting exercises that are popular on social media and actually deliver results
- Balancing aesthetics with functional strength
- Designing programs that make women feel empowered and accomplished

USER'S FITNESS SUMMARY:
${sanitizedSummary}

Use ONLY the exercises provided in the exercise list below. These are proven, effective exercises that women love and that deliver real results.

USER PROFILE:
- ${age}-year-old ${gender}
- ${heightFeet}'${heightInches}" tall, ${weight} lbs
- ${fitnessExperience} fitness level
- Primary goal: ${primaryGoal}
- Target muscle groups: ${selectedMuscleGroups.join(', ')}
- Workout frequency: ${exerciseFrequency} days per week
- Equipment: ${gymAccess ? 'Full gym access' : equipmentFilter.join(', ') || 'Bodyweight only'}
${healthConcerns.length > 0 ? `- Health considerations: ${healthConcerns.join(', ')}` : ''}
${wantsIsolationDay && priorityMuscle ? `- Wants dedicated ${priorityMuscle} isolation day` : ''}

EXERCISE DATABASE:
${exerciseDatabase}

${wantsIsolationDay && prioritizedIsolation.length > 0 ? `
ISOLATION EXERCISES FOR ${priorityMuscle.toUpperCase()}:
${prioritizedIsolation.map(formatExerciseForAI).join('\n')}
` : ''}

🚨 MANDATORY EXERCISE SELECTION RULES:
- You MUST use at least 4 out of 6 exercises from the HIGHEST PRIORITY list
- You can use at most 2 exercises from MEDIUM or LOWER priority lists
- If a HIGHEST PRIORITY exercise exists for a muscle group, you MUST choose it over lower priority options
- This is non-negotiable - highest priority exercises are scientifically proven to be most effective

CRITICAL EXERCISE SELECTION RULES:
1. 🔥 ALWAYS prioritize HIGHEST PRIORITY exercises first - these are the most effective
2. ⭐ Only use MEDIUM PRIORITY exercises if you need variety after using highest priority ones
3. ⚡ Only use LOWER PRIORITY exercises as a last resort
4. For each workout, aim to use at least 70% highest priority exercises
5. Quality over quantity - fewer exercises done right is better than many mediocre ones

WORKOUT REQUIREMENTS:
1. Create a ${exerciseFrequency}-day workout split that will help this woman achieve her dream physique
2. Use ONLY exercises from the provided list
3. Each regular workout should contain exactly 6 exercises
4. ${wantsIsolationDay ? `The ${priorityMuscle} isolation day should contain 4-5 exercises (use your judgment)` : 'All workouts should contain 6 exercises'}
5. Core exercise handling: ${corePreference === 'sprinkle' ? 'Include 2 core exercises in each workout day (as part of the 6 exercises)' : 'Create dedicated core-heavy workout days'}
6. Each workout should be 45-60 minutes (perfect for busy women)
7. Include warm-up and cool-down recommendations
8. Use the default sets/reps as starting points, but adjust based on goals (strength: 6-8 reps, muscle building: 8-12 reps, toning: 12-15 reps)
9. Include rest periods between sets (60-90s for compound, 45-60s for isolation)
10. For time-based exercises (Planks, Wall Sit, Leg Raise Hold), use seconds instead of reps and set repType to "seconds"
11. For cardio exercises, use minutes and set repType to "minutes"
12. For all other exercises, use reps and set repType to "reps"
13. Focus on compound movements and exercises that women see on Instagram and actually want to do
14. Create a program that will make her feel strong, confident, and proud of her workouts
15. This is a WEIGHTED workout plan - do not include cardio exercises in the workout structure

OUTPUT FORMAT (JSON):
{
  "day1": {
    "title": "Upper Body Strength",
    "focus": "chest, shoulders, arms",
    "duration": "50 minutes",
    "exercises": [
      {
        "name": "Push-ups",
        "sets": 3,
        "reps": "8-12",
        "repType": "reps",
        "rest": "60 seconds",
        "targetMuscles": "chest",
        "equipment": "bodyweight",
        "notes": "Focus on controlled movement"
      },
      {
        "name": "Planks",
        "sets": 3,
        "reps": "45",
        "repType": "seconds",
        "rest": "60 seconds", 
        "targetMuscles": "core",
        "equipment": "bodyweight",
        "notes": "Hold position, breathe normally"
      }
    ]
  },
  "day2": { ... },
  etc.
}

IMPORTANT: For time-based exercises (Planks, Wall Sit, Leg Raise Hold), set repType to "seconds". For cardio exercises, set repType to "minutes". For all other exercises, set repType to "reps".
`;
    console.log('🤖 Sending prompt to OpenAI...');
    // Call OpenAI API with GPT-4o model
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are an elite Hollywood personal trainer who specializes exclusively in training women. You create workout plans that help women build strong, confident, Instagram-worthy physiques. You understand what women really want from fitness and select exercises that deliver real results. IMPORTANT: You must ALWAYS respond with valid JSON only. Never include explanations, apologies, or text outside of the JSON structure.'
          },
          {
            role: 'user',
            content: basePrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object.'
          }
        ],
        max_tokens: 2000,
        response_format: {
          type: "json_object"
        } // Now supported with gpt-4o
      })
    });
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }
    const openaiData = await openaiResponse.json();
    const workoutPlanText = openaiData.choices[0].message.content.trim();
    console.log('✅ OpenAI response received');
    console.log('📝 Raw OpenAI response:', workoutPlanText.substring(0, 200) + '...');
    // Parse the JSON response
    let workoutPlan;
    try {
      // Remove any markdown code blocks if present
      const cleanedResponse = workoutPlanText.replace(/```json\n?|\n?```/g, '').trim();
      workoutPlan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', parseError);
      console.error('🔍 Full raw response:', workoutPlanText);
      throw new Error('Failed to parse workout plan from AI response. AI returned: ' + workoutPlanText.substring(0, 100));
    }
    // Debug logging for selected exercises
    console.log('📋 SELECTED EXERCISES IN WORKOUT:');
    Object.keys(workoutPlan).forEach((day)=>{
      console.log(`${day}: ${workoutPlan[day].title}`);
      workoutPlan[day].exercises?.forEach((ex)=>{
        const dbExercise = prioritizedExercises.find((dbEx)=>dbEx.name === ex.name);
        const priority = dbExercise ? dbExercise.priority : 'unknown';
        console.log(`  - ${ex.name} (priority: ${priority})`);
      });
    });
    // Add hardcoded starting weights and use database defaults
    const addStartingWeights = (exercise)=>{
      // Use default sets/reps from database, but allow AI to override
      exercise.defaultSets = exercise.default_sets;
      exercise.defaultReps = exercise.default_reps;
      // Determine if exercise is time-based
      const timeBasedExercises = [
        'Planks',
        'Leg Raise Hold (Reverse Plank)',
        'Wall Sit'
      ];
      const cardioExercises = [
        'cardio'
      ];
      if (timeBasedExercises.includes(exercise.name)) {
        exercise.repType = 'seconds';
      } else if (cardioExercises.includes(exercise.muscle_group)) {
        exercise.repType = 'minutes';
      } else {
        exercise.repType = 'reps';
      }
      // Basic starting weight logic based on experience and body weight
      const baseWeight = fitnessExperience === 'beginner' ? 0.3 : fitnessExperience === 'intermediate' ? 0.5 : 0.7;
      // Different multipliers for different exercise types
      if (exercise.name.toLowerCase().includes('squat') || exercise.name.toLowerCase().includes('deadlift')) {
        exercise.startingWeight = Math.round(weight * 0.5 / 5) * 5; // Round to nearest 5lbs
      } else if (exercise.name.toLowerCase().includes('bench') || exercise.name.toLowerCase().includes('press')) {
        exercise.startingWeight = Math.round(weight * 0.3 / 5) * 5;
      } else if (exercise.equipment === 'bodyweight') {
        exercise.startingWeight = 'bodyweight';
      } else if (exercise.muscle_group === 'biceps' || exercise.muscle_group === 'triceps') {
        exercise.startingWeight = Math.round(weight * 0.15 / 5) * 5; // Lighter for arms
      } else {
        exercise.startingWeight = Math.round(weight * baseWeight / 100 / 5) * 5;
      }
      return exercise;
    };
    // Process each day and add starting weights
    Object.keys(workoutPlan).forEach((day)=>{
      if (workoutPlan[day].exercises) {
        workoutPlan[day].exercises = workoutPlan[day].exercises.map(addStartingWeights);
      }
    });
    console.log('✅ Workout plan generated successfully');
    console.log('📊 Plan overview:', Object.keys(workoutPlan).map((day)=>`${day}: ${workoutPlan[day].title} (${workoutPlan[day].exercises?.length || 0} exercises)`));
    // Add exercise details from database for reference
    const exerciseLookup = {};
    prioritizedExercises.forEach((ex)=>{
      exerciseLookup[ex.name] = ex;
    });
    prioritizedIsolation.forEach((ex)=>{
      exerciseLookup[ex.name] = ex;
    });
    return new Response(JSON.stringify({
      success: true,
      workoutPlan,
      exercisesUsed: prioritizedExercises.length,
      totalExercisesAvailable: exercises.length,
      isolationDay: wantsIsolationDay && priorityMuscle,
      exerciseDetails: exerciseLookup
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('🔥 Workout generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Workout generation failed'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
