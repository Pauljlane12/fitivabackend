import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Smart rest day logic functions
const createSmartRestDaySchedule = (workoutPlan, exerciseFrequency, restPreferences = {})=>{
  const weekdays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  const dayAbbreviations = {
    'Mon': 'Monday',
    'Tue': 'Tuesday',
    'Wed': 'Wednesday',
    'Thu': 'Thursday',
    'Fri': 'Friday',
    'Sat': 'Saturday',
    'Sun': 'Sunday'
  };
  const frequency = parseInt(exerciseFrequency);
  const workoutDays = Object.keys(workoutPlan);
  // Parse user preferences
  const preferenceType = restPreferences.rest_day_preference || 'smart';
  const specificDays = restPreferences.specific_rest_days || [];
  // Convert abbreviated day names to full names
  const specificDaysFullNames = specificDays.map((abbr)=>dayAbbreviations[abbr]).filter(Boolean);
  console.log(`🗓️ Creating ${frequency}x/week schedule with ${preferenceType} rest preference`);
  console.log(`📅 Specific days: ${specificDaysFullNames.join(', ')}`);
  // Handle different preference types
  if (preferenceType === 'smart') {
    return createSmartSchedule(weekdays, workoutPlan, frequency, workoutDays);
  } else if (preferenceType === 'specific_unavailable') {
    return createUnavailableSchedule(weekdays, workoutPlan, frequency, workoutDays, specificDaysFullNames);
  } else if (preferenceType === 'preferred') {
    return createPreferredSchedule(weekdays, workoutPlan, frequency, workoutDays, specificDaysFullNames);
  }
  // Fallback to smart schedule
  return createSmartSchedule(weekdays, workoutPlan, frequency, workoutDays);
};
const createSmartSchedule = (weekdays, workoutPlan, frequency, workoutDays)=>{
  const schedule = {};
  let workoutIndex = 0;
  let consecutiveWorkouts = 0;
  // Smart patterns based on frequency
  const patterns = {
    3: {
      maxConsecutive: 2,
      preferWeekends: true
    },
    4: {
      maxConsecutive: 2,
      preferWeekends: true
    },
    5: {
      maxConsecutive: 3,
      preferWeekends: true
    },
    6: {
      maxConsecutive: 3,
      preferWeekends: false
    },
    7: {
      maxConsecutive: 4,
      preferWeekends: false
    } // Every day
  };
  const pattern = patterns[frequency] || patterns[4];
  weekdays.forEach((weekday, dayIndex)=>{
    const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
    const needsRest = consecutiveWorkouts >= pattern.maxConsecutive || pattern.preferWeekends && isWeekend && workoutIndex >= frequency || workoutIndex >= workoutDays.length;
    if (needsRest || workoutIndex >= workoutDays.length) {
      schedule[weekday] = createRestDay(weekday, 'smart_placement');
      consecutiveWorkouts = 0;
    } else {
      const workoutData = workoutPlan[workoutDays[workoutIndex]];
      schedule[weekday] = createWorkoutDay(weekday, workoutData);
      workoutIndex++;
      consecutiveWorkouts++;
    }
  });
  return schedule;
};
const createUnavailableSchedule = (weekdays, workoutPlan, frequency, workoutDays, unavailableDays)=>{
  const schedule = {};
  let workoutIndex = 0;
  let consecutiveWorkouts = 0;
  // Available days for workouts
  const availableDays = weekdays.filter((day)=>!unavailableDays.includes(day));
  console.log(`🚫 Unavailable days: ${unavailableDays.join(', ')}`);
  console.log(`✅ Available days: ${availableDays.join(', ')}`);
  // Check if we have enough available days
  if (availableDays.length < frequency) {
    console.warn(`⚠️ Not enough available days (${availableDays.length}) for ${frequency} workouts`);
  }
  weekdays.forEach((weekday, dayIndex)=>{
    if (unavailableDays.includes(weekday)) {
      // Force rest on unavailable days
      schedule[weekday] = createRestDay(weekday, 'unavailable');
      consecutiveWorkouts = 0;
    } else {
      // Available day - decide workout vs rest
      const needsRest = consecutiveWorkouts >= 3 || // Never more than 3 consecutive
      workoutIndex >= workoutDays.length || workoutIndex >= frequency;
      if (needsRest || workoutIndex >= workoutDays.length) {
        schedule[weekday] = createRestDay(weekday, 'recovery');
        consecutiveWorkouts = 0;
      } else {
        const workoutData = workoutPlan[workoutDays[workoutIndex]];
        schedule[weekday] = createWorkoutDay(weekday, workoutData);
        workoutIndex++;
        consecutiveWorkouts++;
      }
    }
  });
  return schedule;
};
const createPreferredSchedule = (weekdays, workoutPlan, frequency, workoutDays, preferredRestDays)=>{
  const schedule = {};
  let workoutIndex = 0;
  let consecutiveWorkouts = 0;
  console.log(`💤 Preferred rest days: ${preferredRestDays.join(', ')}`);
  // First pass: assign preferred rest days
  weekdays.forEach((weekday)=>{
    if (preferredRestDays.includes(weekday)) {
      schedule[weekday] = createRestDay(weekday, 'preferred');
    }
  });
  // Second pass: assign workouts and remaining rest days
  weekdays.forEach((weekday, dayIndex)=>{
    if (schedule[weekday]) {
      // Already assigned as preferred rest
      consecutiveWorkouts = 0;
      return;
    }
    const needsRest = consecutiveWorkouts >= 3 || workoutIndex >= workoutDays.length || workoutIndex >= frequency;
    if (needsRest || workoutIndex >= workoutDays.length) {
      schedule[weekday] = createRestDay(weekday, 'additional');
      consecutiveWorkouts = 0;
    } else {
      const workoutData = workoutPlan[workoutDays[workoutIndex]];
      schedule[weekday] = createWorkoutDay(weekday, workoutData);
      workoutIndex++;
      consecutiveWorkouts++;
    }
  });
  return schedule;
};
const createRestDay = (weekday, reason)=>{
  const reasons = {
    'smart_placement': 'Optimal recovery timing',
    'unavailable': 'Unavailable for workout',
    'preferred': 'Preferred rest day',
    'recovery': 'Recovery day',
    'additional': 'Additional rest day'
  };
  return {
    dayName: weekday,
    title: `${weekday} Rest Day`,
    description: reasons[reason] || 'Rest day',
    focus: 'recovery',
    duration: '0 minutes',
    isRestDay: true,
    exercises: [],
    exerciseCount: 0,
    totalSets: 0,
    estimatedCalories: 0,
    intensity: 'rest',
    restReason: reason
  };
};
const createWorkoutDay = (weekday, workoutData)=>{
  if (!workoutData) {
    return createRestDay(weekday, 'no_workout_data');
  }
  const exerciseCount = workoutData.exercises?.length || 0;
  const totalSets = workoutData.exercises?.reduce((sum, ex)=>sum + (ex.sets || 0), 0) || 0;
  const estimatedCalories = Math.round(totalSets * 8);
  let intensity = 'moderate';
  if (exerciseCount >= 6 && workoutData.duration?.includes('60')) {
    intensity = 'high';
  } else if (exerciseCount <= 4) {
    intensity = 'low';
  }
  return {
    dayName: weekday,
    title: workoutData.title || `${weekday} Workout`,
    description: `${workoutData.focus} focused workout`,
    focus: workoutData.focus || 'full body',
    duration: workoutData.duration || '45 minutes',
    isRestDay: false,
    exercises: workoutData.exercises || [],
    exerciseCount,
    totalSets,
    estimatedCalories,
    intensity
  };
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
      const rawBody = await req.text();
      console.log('📥 Raw request body:', rawBody.substring(0, 500) + '...');
      console.log('📏 Body length:', rawBody.length);
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
    // Updated destructuring to include rest day preferences
    const { gender, age, height_feet: heightFeet, height_inches: heightInches, weight, fitness_experience: fitnessExperience, primary_goal: primaryGoal, fitness_areas: selectedMuscleGroups = [], exercise_frequency: exerciseFrequency, has_gym_access: gymAccess, home_equipment: equipment = [], health_risks: healthConcerns = [], priority_muscle: priorityMuscle = null, wants_isolation_day: wantsIsolationDay = false, core_preference: corePreference = 'sprinkle', // New rest day preferences
    rest_day_preference: restDayPreference = 'smart', specific_rest_days: specificRestDays = [] } = body;
    // Create rest preferences object
    const restPreferences = {
      rest_day_preference: restDayPreference,
      specific_rest_days: specificRestDays
    };
    console.log('📝 User Data:', {
      selectedMuscleGroups,
      exerciseFrequency,
      priorityMuscle,
      wantsIsolationDay,
      corePreference,
      restPreferences
    });
    // Query exercises based on user's selected muscle groups and equipment
    let equipmentFilter = gymAccess ? [] : equipment;
    if (!gymAccess && equipment.length === 0) {
      equipmentFilter = [
        'bodyweight'
      ];
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
      expandedMuscleGroups = expandedMuscleGroups.filter((group)=>group !== 'arms');
      expandedMuscleGroups.push('biceps', 'triceps');
    }
    if (lowerCaseMuscleGroups.includes('legs')) {
      expandedMuscleGroups = expandedMuscleGroups.filter((group)=>group !== 'legs');
      expandedMuscleGroups.push('quads', 'legs');
    }
    console.log('🔄 Expanded muscle groups:', expandedMuscleGroups);
    // Build the query for muscle groups
    let query = supabase.from('exercises_new').select('*').neq('muscle_group', 'cardio');
    // Filter by muscle groups
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
    // Order by priority then by name for consistency
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
      console.log(`🎯 Creating isolation day for ${priorityMuscle}`);
      let isoQuery = supabase.from('exercises_new').select('*').neq('muscle_group', 'cardio').or(`muscle_group.eq.${priorityMuscle},tags.ov.{${priorityMuscle}}`);
      if (!gymAccess && equipmentFilter.length > 0) {
        isoQuery = isoQuery.in('equipment', equipmentFilter);
      }
      isoQuery = isoQuery.order('priority', {
        ascending: true
      }).order('name', {
        ascending: true
      });
      const { data: isoExercises, error: isoError } = await isoQuery;
      if (isoError) {
        console.error('❌ Isolation query error:', isoError);
      } else if (isoExercises && isoExercises.length > 0) {
        isolationExercises = isoExercises;
        console.log(`🎯 Found ${isolationExercises.length} isolation exercises for ${priorityMuscle}`);
        console.log('🎯 Isolation exercises:', isolationExercises.map((ex)=>ex.name));
      } else {
        console.log(`⚠️ No isolation exercises found for ${priorityMuscle}`);
      }
    }
    // Separate exercises by priority levels
    const priority1Exercises = exercises.filter((ex)=>ex.priority === 1);
    const priority2Exercises = exercises.filter((ex)=>ex.priority === 2);
    const priority3Exercises = exercises.filter((ex)=>ex.priority === 3);
    console.log(`📊 Priority breakdown: P1=${priority1Exercises.length}, P2=${priority2Exercises.length}, P3=${priority3Exercises.length}`);
    // Limit exercises sent to AI
    const maxExercises = 25;
    const prioritizedExercises = [
      ...priority1Exercises.slice(0, 15),
      ...priority2Exercises.slice(0, 7),
      ...priority3Exercises.slice(0, 3)
    ].slice(0, maxExercises);
    const prioritizedIsolation = isolationExercises.slice(0, 15);
    console.log(`📋 Sending ${prioritizedExercises.length} exercises to AI (prioritized)`);
    // Create the summary
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
    // Sanitize the summary with OpenAI
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
    // Format exercises for AI
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
    // Create exercise database string
    const exerciseDatabase = `
🔥 HIGHEST PRIORITY EXERCISES (Use these first!):
${priority1Exercises.slice(0, 15).map(formatExerciseForAI).join('\n')}

⭐ MEDIUM PRIORITY EXERCISES (Use if needed):
${priority2Exercises.slice(0, 7).map(formatExerciseForAI).join('\n')}

⚡ LOWER PRIORITY EXERCISES (Use only if necessary):
${priority3Exercises.slice(0, 3).map(formatExerciseForAI).join('\n')}
`.trim();
    // Create AI prompt (keeping your existing detailed prompt)
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
- ${heightFeet}'${heightInches}" tall (${heightFeet * 12 + heightInches} inches total)
- ${weight} lbs body weight
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

WORKOUT REQUIREMENTS:
1. Create a ${exerciseFrequency}-day workout split that will help this woman achieve her dream physique
2. Use ONLY exercises from the provided list
3. Each workout should contain exactly 6 exercises
4. Each workout should be 45-60 minutes
5. Include rest periods between sets (60-90s for compound, 45-60s for isolation)
6. For time-based exercises (Planks, Wall Sit, Leg Raise Hold), use seconds instead of reps and set repType to "seconds"
7. For all other exercises, use reps and set repType to "reps"
8. Focus on compound movements and exercises that deliver results
9. Create a program that will make her feel strong, confident, and proud of her workouts

OUTPUT FORMAT (JSON):
{
  "day1": {
    "title": "Lower Body Strength",
    "focus": "glutes, quads",
    "duration": "50 minutes",
    "exercises": [
      {
        "name": "Barbell Back Squat",
        "sets": 3,
        "reps": "6-8",
        "repType": "reps",
        "rest": "90 seconds",
        "targetMuscles": "glutes, quads",
        "equipment": "barbell",
        "startingWeight": 95,
        "notes": "Focus on depth and control"
      }
    ]
  },
  "day2": { ... },
  etc.
}

IMPORTANT: Each exercise must have a realistic startingWeight that matches this user's experience level and body size. For time-based exercises, set repType to "seconds". For all other exercises, set repType to "reps".
`;
    console.log('🤖 Sending prompt to OpenAI...');
    // Call OpenAI API
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
            content: 'You are an elite Hollywood personal trainer who specializes exclusively in training women. You create workout plans that help women build strong, confident, Instagram-worthy physiques. IMPORTANT: You must ALWAYS respond with valid JSON only. Never include explanations, apologies, or text outside of the JSON structure.'
          },
          {
            role: 'user',
            content: basePrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any text before or after the JSON object.'
          }
        ],
        max_tokens: 3000,
        response_format: {
          type: "json_object"
        }
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
      const cleanedResponse = workoutPlanText.replace(/```json\n?|\n?```/g, '').trim();
      workoutPlan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', parseError);
      console.error('🔍 Full raw response:', workoutPlanText);
      throw new Error('Failed to parse workout plan from AI response. AI returned: ' + workoutPlanText.substring(0, 100));
    }
    // Process exercises and add metadata
    const addStartingWeights = (exercise)=>{
      const dbExercise = prioritizedExercises.find((dbEx)=>dbEx.name === exercise.name) || prioritizedIsolation.find((dbEx)=>dbEx.name === exercise.name);
      if (dbExercise) {
        exercise.defaultSets = dbExercise.default_sets;
        exercise.defaultReps = dbExercise.default_reps;
      }
      const timeBasedExercises = [
        'Planks',
        'Leg Raise Hold (Reverse Plank)',
        'Wall Sit'
      ];
      if (timeBasedExercises.includes(exercise.name)) {
        exercise.repType = 'seconds';
      } else {
        exercise.repType = 'reps';
      }
      return exercise;
    };
    // Process each day
    Object.keys(workoutPlan).forEach((day)=>{
      if (workoutPlan[day].exercises) {
        workoutPlan[day].exercises = workoutPlan[day].exercises.map(addStartingWeights);
      }
    });
    console.log('✅ Workout plan generated successfully');
    // Transform to weekly schedule with smart rest days
    const weeklySchedule = createSmartRestDaySchedule(workoutPlan, exerciseFrequency, restPreferences);
    console.log('📅 Final weekly schedule:');
    Object.keys(weeklySchedule).forEach((day)=>{
      const dayInfo = weeklySchedule[day];
      console.log(`  ${day}: ${dayInfo.isRestDay ? 'REST' : dayInfo.title} ${dayInfo.restReason ? `(${dayInfo.restReason})` : ''}`);
    });
    // Add exercise details for reference
    const exerciseLookup = {};
    prioritizedExercises.forEach((ex)=>{
      exerciseLookup[ex.name] = ex;
    });
    prioritizedIsolation.forEach((ex)=>{
      exerciseLookup[ex.name] = ex;
    });
    return new Response(JSON.stringify({
      success: true,
      workoutPlan: weeklySchedule,
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
