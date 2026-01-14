
export enum InterviewStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  FINISHED = 'FINISHED'
}

export interface Question {
  id: string;
  text: string;
  category: 'clinical' | 'behavioral' | 'ethical';
  timeLimit: number; // in seconds
}

export interface InterviewScore {
  overall: number;
  clinicalReasoning: number;
  empathy: number;
  communication: number;
  professionalism: number;
  feedback: string;
}

export interface InterviewHistoryItem {
  question: string;
  transcription: string;
  score: InterviewScore;
}
