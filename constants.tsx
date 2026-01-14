
import { Question } from './types';

export const OT_QUESTIONS: Question[] = [
  {
    id: '1',
    text: "How do you approach creating a child-centered treatment plan for a 5-year-old with Sensory Processing Disorder (SPD) who is highly avoidant of tactile input?",
    category: 'clinical',
    timeLimit: 60
  },
  {
    id: '2',
    text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to your clinical recommendations. How did you handle it?",
    category: 'behavioral',
    timeLimit: 90
  },
  {
    id: '3',
    text: "In a pediatric inpatient setting, how do you prioritize safety and discharge planning while still addressing developmental milestones?",
    category: 'clinical',
    timeLimit: 75
  },
  {
    id: '4',
    text: "How do you incorporate evidence-based practice into your daily interventions in a busy outpatient clinic?",
    category: 'clinical',
    timeLimit: 60
  }
];

export const RECRUITER_PERSONA = `You are a Senior Occupational Therapy Recruiter for a premier Pediatric Health System. 
Your tone is professional, encouraging, but rigorous. 
When scoring a candidate's response, look for clinical depth, adherence to OT core values (autonomy, justice, veracity), and family-centered care principles.`;
