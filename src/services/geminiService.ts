import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeneratedWorkout {
  title: string;
  description: string;
  exercises: {
    name: string;
    sets: number;
    reps: string;
    notes: string;
  }[];
}

export async function generateWorkoutPlan(userProfile: any, prompt: string): Promise<GeneratedWorkout> {
  const model = "gemini-3.1-flash-lite-preview";
  
  const systemInstruction = `You are an expert fitness coach. 
  Generate a personalized workout plan based on the user's profile and specific request.
  User Profile:
  - Fitness Level: ${userProfile.fitnessLevel}
  - Goal: ${userProfile.goal}
  - Weight: ${userProfile.weight}kg
  - Height: ${userProfile.height}cm
  
  Return the plan in JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sets: { type: Type.NUMBER },
                reps: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: ["name", "sets", "reps"]
            }
          }
        },
        required: ["title", "description", "exercises"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function getFitnessAdvice(data: { sleep: number, steps: number, heartRate: number }): Promise<string> {
  const model = "gemini-3.1-flash-lite-preview";
  
  const prompt = `
    You are a professional fitness coach.
    
    User data:
    - Sleep: ${data.sleep} hours
    - Steps: ${data.steps}
    - Heart rate: ${data.heartRate} bpm
    
    Give concise, actionable advice on:
    - Workout intensity for today
    - Recovery strategies
    - Sleep improvement if needed
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "Unable to generate advice at this time.";
}
