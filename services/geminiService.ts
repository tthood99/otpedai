
import { GoogleGenAI, Type } from "@google/genai";
import { InterviewScore } from "../types";
import { RECRUITER_PERSONA } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeResponse = async (question: string, transcription: string): Promise<InterviewScore> => {
  const prompt = `
    ${RECRUITER_PERSONA}
    
    Evaluate the following interview response for a Pediatric OT position.
    
    Question: "${question}"
    Candidate Response: "${transcription}"
    
    Provide a detailed score and qualitative feedback in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overall: { type: Type.NUMBER },
          clinicalReasoning: { type: Type.NUMBER },
          empathy: { type: Type.NUMBER },
          communication: { type: Type.NUMBER },
          professionalism: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["overall", "clinicalReasoning", "empathy", "communication", "professionalism", "feedback"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as InterviewScore;
};

// Simplified Audio Transcription Mock or Real using Live API logic
// For this app, we'll use the browser's SpeechRecognition API for simplicity in transcription 
// and Gemini for the heavy lifting of evaluation.
