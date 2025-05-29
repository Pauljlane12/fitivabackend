const exercises = [
  {
    "id": "03e6efe1-df02-4dde-8b2a-4fe231ea08f5",
    "name": "Hip Thrusts",
    "muscle_group": "glutes",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "tags": [
      "glutes",
      "strength"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 4,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "8fbad4a0-e7ad-4078-aa06-a428f63d739b",
    "name": "Incline Dumbbell Curls",
    "muscle_group": "biceps",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "biceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "a6c03507-07d2-4298-93df-6b55c4ec7d40",
    "name": "Incline Press (Machine or Dumbbell)",
    "muscle_group": "chest",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "chest"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "accc432c-623b-47e5-a620-282aa8dbd76d",
    "name": "Lat Pulldowns",
    "muscle_group": "back",
    "equipment": "cable",
    "difficulty": "beginner",
    "tags": [
      "back",
      "width"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "a8fef4d5-9f21-4ead-82d9-27aad359e325",
    "name": "Lat Pushdowns",
    "muscle_group": "back",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "back",
      "lat_activation"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "ec804ebc-7286-4870-ba1e-cde3dcf021ce",
    "name": "Leg Extensions",
    "muscle_group": "quads",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "quads"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "43f8aea6-fb10-490f-99f2-0f1462da3d02",
    "name": "Leg Lifts",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 20,
    "default_weight": null
  },
  {
    "id": "0efb37a7-a950-4a30-b353-c5e3ca9a890e",
    "name": "Leg Press Machine",
    "muscle_group": "quads",
    "equipment": "machine",
    "difficulty": "intermediate",
    "tags": [
      "quads",
      "glutes"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "45e739d2-dc75-40f5-8a28-09897a5e4d16",
    "name": "Leg Raise Hold (Reverse Plank)",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "intermediate",
    "tags": [
      "core"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 30,
    "default_weight": null
  },
  {
    "id": "1082e31b-cb04-486f-8628-867581b0ac61",
    "name": "Machine Chest Press",
    "muscle_group": "chest",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "chest"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "9866ede1-9411-4ad4-b380-67ea7e14512d",
    "name": "Oblique Taps",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core",
      "obliques"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 20,
    "default_weight": null
  },
  {
    "id": "68d9ffb1-9a6c-48c9-9167-4c61bb67d0ab",
    "name": "Overhead Cable Pushdowns",
    "muscle_group": "triceps",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "triceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "6f63b039-e8cb-45c5-9b61-df188318e7bd",
    "name": "Planks",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core",
      "stability"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 30,
    "default_weight": null
  },
  {
    "id": "4bc8d4c4-234c-4ce9-bab7-3c27f6acad8d",
    "name": "Preacher Curls",
    "muscle_group": "biceps",
    "equipment": "machine",
    "difficulty": "intermediate",
    "tags": [
      "biceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "5be62ae7-21a4-4b30-89b1-a46f6b6fa1df",
    "name": "Pull-Ups / Assisted Pull-Ups",
    "muscle_group": "back",
    "equipment": "bodyweight",
    "difficulty": "advanced",
    "tags": [
      "back",
      "compound"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 4,
    "default_reps": 6,
    "default_weight": null
  },
  {
    "id": "aea73dcb-9faf-4682-aab1-e4555cb686ee",
    "name": "Push-Ups",
    "muscle_group": "chest",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "chest",
      "triceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "b224814f-2a1f-41f2-9f71-6c0f54f1cb23",
    "name": "Rear Delt Flys",
    "muscle_group": "shoulders",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "rear_delts"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "0aa2fc30-d4ee-4aa2-884f-3664494f22da",
    "name": "Reverse Flys",
    "muscle_group": "back",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "rear_delts",
      "posture"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "061b9868-e85b-4a9e-9a2b-eef830d0679a",
    "name": "Reverse Lunges",
    "muscle_group": "glutes",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "quads"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "94eab946-cc83-490d-b9c6-e03c470aa45b",
    "name": "Romanian Deadlifts",
    "muscle_group": "glutes",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "glutes",
      "hamstrings",
      "hypertrophy"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "f83a54c5-9230-40c0-a089-7a70e7baf190",
    "name": "Russian Twists",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core",
      "obliques"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 20,
    "default_weight": null
  },
  {
    "id": "b7ab1b4e-d196-4597-83ca-bae7480c99b4",
    "name": "Seated Leg Raise Machine",
    "muscle_group": "core",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "core"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "3b184915-b221-4a96-98f2-0dabc6e7f714",
    "name": "Ab Crunch Machine",
    "muscle_group": "core",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "core"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "9cdab66d-6218-4167-9608-1f9b0f2ba300",
    "name": "Banded Lateral Walks",
    "muscle_group": "glutes",
    "equipment": "resistance_band",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "no_jump"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "0dda768c-9fe4-478c-a1ed-b8355485d54b",
    "name": "Bent Over Rows",
    "muscle_group": "back",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "tags": [
      "back",
      "posterior_chain"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 4,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "74f87358-58ef-407d-877b-90d4dfb34c7f",
    "name": "Bicycle Crunches",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core",
      "obliques"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 20,
    "default_weight": null
  },
  {
    "id": "983f0e85-4ade-419b-8774-db7869f87212",
    "name": "Box Step-Up (Quad Emphasis)",
    "muscle_group": "quads",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "quads",
      "glutes"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "095c146a-b96b-4f49-94ba-83f3a5b44e8d",
    "name": "Bulgarian Split Squats",
    "muscle_group": "glutes",
    "equipment": "dumbbell",
    "difficulty": "advanced",
    "tags": [
      "glutes",
      "quads",
      "balance"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 8,
    "default_weight": null
  },
  {
    "id": "4f1eb650-29cd-4b43-bf85-d60b9d5ed1a3",
    "name": "Cable Curls",
    "muscle_group": "biceps",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "biceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "8873fc0f-2a82-4f53-aa78-9acb3a2575a5",
    "name": "Cable Flys",
    "muscle_group": "chest",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "chest"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "252e6f3f-dc90-491a-8f64-4c50ff8f0fe2",
    "name": "Cable Kickbacks",
    "muscle_group": "glutes",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "glutes",
      "isolation"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "a414960f-b9eb-42c0-b1fc-283a2fcf5d70",
    "name": "Cable Pushdowns",
    "muscle_group": "triceps",
    "equipment": "cable",
    "difficulty": "beginner",
    "tags": [
      "triceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "75fe0050-3dd3-4e49-9dbd-7668a6f3abf9",
    "name": "Cross-Body Dumbbell Curls",
    "muscle_group": "biceps",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "biceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "eed16cd1-fec9-4503-918a-fc81c909802d",
    "name": "Curtsy Lunge",
    "muscle_group": "quads",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "quads"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "4ebae0d3-b299-40c3-a526-7d563617f8a8",
    "name": "Dumbbell Front Squat",
    "muscle_group": "quads",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "quads"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 4,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "d6e6d04c-fa55-466d-975f-c9f32b0c19f7",
    "name": "Dumbbell Lateral Raises",
    "muscle_group": "shoulders",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "shoulders",
      "isolation"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "a219a36e-3e30-48b4-843e-47d71d3b1bbf",
    "name": "Flutter Kicks",
    "muscle_group": "core",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "core",
      "lower_abs"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 20,
    "default_weight": null
  },
  {
    "id": "a81d1717-479b-4b88-ad07-e8fb5872a5d9",
    "name": "Frog Pumps",
    "muscle_group": "glutes",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "activation"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "bb8025e5-640b-4747-ab48-2ba49eee11c9",
    "name": "Front Plate Raise",
    "muscle_group": "shoulders",
    "equipment": "plate",
    "difficulty": "intermediate",
    "tags": [
      "shoulders"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "e0c10f5a-2699-44e8-b76b-a7dc61c853de",
    "name": "Glute Bridge (Machine or Floor)",
    "muscle_group": "glutes",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "no_jump"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "870f4b07-919e-4502-b3a1-bba758621d93",
    "name": "Glute Bridge Marches",
    "muscle_group": "glutes",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "core",
      "no_jump"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "395006d4-7ffc-44cf-b53e-e233da41cff2",
    "name": "Glute Extensions",
    "muscle_group": "glutes",
    "equipment": "machine",
    "difficulty": "intermediate",
    "tags": [
      "glutes"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "b86696a4-841e-4c41-98ec-1b1cbe00f567",
    "name": "Goblet Squat",
    "muscle_group": "quads",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "quads",
      "glutes"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "c955a294-e08b-49d2-8929-7dc3569e9062",
    "name": "Hack Squat / Quad-Biased Squat",
    "muscle_group": "quads",
    "equipment": "machine",
    "difficulty": "intermediate",
    "tags": [
      "quads"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "76f44803-6bdf-40d9-8c32-bbfa50205c26",
    "name": "Hammer Curls",
    "muscle_group": "biceps",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "biceps",
      "forearms"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "0f09ddcd-8a23-4e0e-a292-61fb8d8244a9",
    "name": "Hamstring Curl",
    "muscle_group": "hamstrings",
    "equipment": "machine",
    "difficulty": "intermediate",
    "tags": [
      "hamstrings"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "f37604bc-64a5-42b9-90ca-f34f189af4b2",
    "name": "Hip Abduction Machine",
    "muscle_group": "glutes",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "isolation"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 15,
    "default_weight": null
  },
  {
    "id": "d0f1f1aa-ecf9-49c4-9a39-b65f46c288f2",
    "name": "Seated Rows",
    "muscle_group": "back",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "back",
      "thickness"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "7f53a1ac-95a5-4d9a-9be9-d3c12a61ab9f",
    "name": "Shoulder Press (Smith or Dumbbells)",
    "muscle_group": "shoulders",
    "equipment": "dumbbell",
    "difficulty": "intermediate",
    "tags": [
      "shoulders"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "8cf8d9e1-633a-4cb1-91f6-0e22f9c7ad07",
    "name": "Single Arm Cable Pushdowns",
    "muscle_group": "triceps",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "triceps",
      "unilateral"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "8075d86b-5b10-4a31-9918-5dd729cc0712",
    "name": "Single Arm Dumbbell Row",
    "muscle_group": "back",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "back",
      "unilateral"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "1015dcf7-b1c3-4500-83b1-8d8fd7488769",
    "name": "Single Arm Lateral Cable Raise",
    "muscle_group": "shoulders",
    "equipment": "cable",
    "difficulty": "intermediate",
    "tags": [
      "shoulders"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "f69c5d4f-b8ff-4546-b379-60c16f7eed91",
    "name": "Skull Crushers",
    "muscle_group": "triceps",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "tags": [
      "triceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 10,
    "default_weight": null
  },
  {
    "id": "e69b14ba-4743-4cd9-a27e-02feb606a3cf",
    "name": "Standing Dumbbell Curls",
    "muscle_group": "biceps",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "biceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "4c01573f-2147-44fb-a8f1-542d6ad1a8ed",
    "name": "Step-Ups",
    "muscle_group": "glutes",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "quads",
      "bodyweight"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "1a8f323e-fe58-460f-a601-12ba309f5e22",
    "name": "Sumo Squats",
    "muscle_group": "glutes",
    "equipment": "dumbbell",
    "difficulty": "beginner",
    "tags": [
      "glutes",
      "inner_thighs"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "f2aaa434-b129-4b2f-9963-34571ea13d84",
    "name": "Tricep Seated Dip Machine",
    "muscle_group": "triceps",
    "equipment": "machine",
    "difficulty": "beginner",
    "tags": [
      "triceps"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "58964864-168f-4e26-a4f0-276754a50000",
    "name": "Upright Rows",
    "muscle_group": "shoulders",
    "equipment": "barbell",
    "difficulty": "intermediate",
    "tags": [
      "shoulders"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "d935fd0a-f224-4e95-83e6-1fc623a34277",
    "name": "Walking Lunges",
    "muscle_group": "quads",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "quads",
      "glutes"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 12,
    "default_weight": null
  },
  {
    "id": "b53b56dc-2639-4672-8752-cbbb1beb501d",
    "name": "Wall Sit",
    "muscle_group": "quads",
    "equipment": "bodyweight",
    "difficulty": "beginner",
    "tags": [
      "quads",
      "isometric"
    ],
    "description": null,
    "media_url": null,
    "default_sets": 3,
    "default_reps": 30,
    "default_weight": null
  }
];

export default exercises;
