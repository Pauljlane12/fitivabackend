export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userInput = req.body;

  console.log("Received user input:", userInput);

  const samplePlan = {
    "Day 1": ["Hip Thrusts", "RDL", "Plank"],
    "Day 2": ["Leg Press", "Cable Kickbacks", "Russian Twists"],
    "Day 3": ["Shoulder Press", "Bicep Curls", "Tricep Pushdowns"],
    "Day 4": ["Glute Extensions", "Sumo Squats", "Oblique Taps"]
  };

  return res.status(200).json({ plan: samplePlan });
}
