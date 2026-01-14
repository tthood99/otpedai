
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  PlayIcon, 
  MicrophoneIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  AcademicCapIcon, 
  UserIcon 
} from '@heroicons/react/24/solid';

// --- Constants & Questions ---
const OT_QUESTIONS = [
  {
    id: '1',
    text: "How do you approach creating a child-centered treatment plan for a 5-year-old with Sensory Processing Disorder (SPD) who is highly avoidant of tactile input?",
    timeLimit: 60
  },
  {
    id: '2',
    text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to your clinical recommendations. How did you handle it?",
    timeLimit: 90
  },
  {
    id: '3',
    text: "In a pediatric inpatient setting, how do you prioritize safety and discharge planning while still addressing developmental milestones?",
    timeLimit: 75
  },
  {
    id: '4',
    text: "How do you incorporate evidence-based practice into your daily interventions in a busy outpatient clinic?",
    timeLimit: 60
  }
];

const RECRUITER_PERSONA = `You are a Senior Occupational Therapy Recruiter for a premier Pediatric Health System. 
Your tone is professional, encouraging, but rigorous. 
Evaluate for clinical depth, OT core values, and family-centered care.`;

// --- Services ---
const analyzeResponse = async (question, transcription) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ${RECRUITER_PERSONA}
    Evaluate this Pediatric OT interview response.
    Question: "${question}"
    Candidate Response: "${transcription}"
    Return JSON with: overall (0-100), clinicalReasoning (0-100), empathy (0-100), communication (0-100), professionalism (0-100), feedback (string).
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

  return JSON.parse(response.text);
};

// --- Components ---
const Timer = ({ duration, onComplete, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive) return;
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isActive]);

  const percentage = (timeLeft / duration) * 100;
  const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle
          cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent"
          strokeDasharray="251.2" style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute text-xl font-bold">{timeLeft}s</span>
    </div>
  );
};

const ScoreBar = ({ label, val }) => (
  <div>
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
      <span>{label}</span>
      <span>{val}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${val}%` }} />
    </div>
  </div>
);

// --- Main App ---
export default function App() {
  const [status, setStatus] = useState('IDLE');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [transcription, setTranscription] = useState('');
  const recognitionRef = useRef(null);

  const currentQuestion = OT_QUESTIONS[currentQuestionIndex];

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) text += event.results[i][0].transcript;
        }
        setTranscription(prev => (prev + ' ' + text).trim());
      };
    }
  }, []);

  const startInterview = () => {
    setHistory([]);
    setCurrentQuestionIndex(0);
    setStatus('PREPARING');
  };

  const startRecording = () => {
    setTranscription('');
    setStatus('RECORDING');
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const stopAndAnalyze = async () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setStatus('ANALYZING');
    try {
      const finalTranscript = transcription || "No verbal response provided.";
      const result = await analyzeResponse(currentQuestion.text, finalTranscript);
      setHistory(prev => [...prev, { question: currentQuestion.text, score: result }]);
      
      if (currentQuestionIndex < OT_QUESTIONS.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setStatus('PREPARING');
      } else {
        setStatus('FINISHED');
      }
    } catch (error) {
      console.error(error);
      setStatus('FINISHED'); // Fallback to finish if API fails multiple times
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-slate-50 font-sans">
      <header className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-100">
            <AcademicCapIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Pediatric OT Recruiter</h1>
        </div>
        {status !== 'IDLE' && status !== 'FINISHED' && (
          <div className="text-sm font-bold text-slate-400">
            Question {currentQuestionIndex + 1} / {OT_QUESTIONS.length}
          </div>
        )}
      </header>

      <main className="w-full max-w-3xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {status === 'IDLE' && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserIcon className="h-10 w-10 text-indigo-600" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">OT Clinical Interview</h2>
            <p className="text-slate-600 mb-10 max-w-md mx-auto leading-relaxed">
              Welcome. This session focuses on pediatric interventions, sensory processing, and clinical ethics. Your responses will be evaluated in real-time.
            </p>
            <button 
              onClick={startInterview}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-105 transition-all flex items-center justify-center space-x-2 mx-auto"
            >
              <PlayIcon className="h-5 w-5" />
              <span>Begin Session</span>
            </button>
          </div>
        )}

        {(status === 'PREPARING' || status === 'RECORDING' || status === 'ANALYZING') && (
          <div className="p-8 md:p-12">
            <div className="mb-10">
              <div className="flex items-center space-x-2 mb-3">
                <div className="h-1.5 w-6 bg-indigo-500 rounded-full"></div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Clinical Prompt</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="flex flex-col items-center">
              {status === 'PREPARING' && (
                <button 
                  onClick={startRecording}
                  className="flex flex-col items-center group py-6"
                >
                  <div className="w-24 h-24 border-2 border-dashed border-indigo-200 rounded-full flex items-center justify-center mb-4 group-hover:border-indigo-500 transition-colors">
                    <MicrophoneIcon className="h-10 w-10 text-indigo-400 group-hover:text-indigo-600" />
                  </div>
                  <span className="text-indigo-600 font-bold text-sm">Click to provide your response</span>
                </button>
              )}

              {status === 'RECORDING' && (
                <div className="w-full flex flex-col items-center space-y-8">
                  <Timer duration={currentQuestion.timeLimit} isActive={true} onComplete={stopAndAnalyze} />
                  <div className="w-full p-6 bg-slate-900 rounded-2xl text-slate-300 min-h-[140px] relative shadow-inner">
                    <div className="absolute top-4 right-4 flex items-center space-x-1.5">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-black text-red-500 tracking-tighter">RECORDING</span>
                    </div>
                    <p className="text-sm leading-relaxed font-mono">
                      {transcription || "Listening to your response..."}
                    </p>
                  </div>
                  <button 
                    onClick={stopAndAnalyze}
                    className="px-12 py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all text-sm shadow-lg"
                  >
                    Finish Response
                  </button>
                </div>
              )}

              {status === 'ANALYZING' && (
                <div className="text-center py-16">
                  <ArrowPathIcon className="h-12 w-12 text-indigo-600 animate-spin mx-auto" />
                  <p className="mt-6 text-slate-500 font-bold italic tracking-tight">Recruiter is scoring your answer...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'FINISHED' && (
          <div className="p-8 md:p-12">
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
              <h2 className="text-3xl font-black text-slate-900">Final Report</h2>
              <div className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-black border border-green-100 uppercase">Success</div>
            </div>

            <div className="space-y-6">
              {history.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-bold text-slate-800 flex-1 pr-6 leading-tight">{item.question}</h3>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center shadow-sm">
                      <div className="text-2xl font-black text-indigo-600 leading-none">{item.score.overall}</div>
                      <div className="text-[9px] text-slate-400 font-black mt-1 uppercase">Points</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
                    <ScoreBar label="Reasoning" val={item.score.clinicalReasoning} />
                    <ScoreBar label="Empathy" val={item.score.empathy} />
                    <ScoreBar label="Communication" val={item.score.communication} />
                    <ScoreBar label="Professionalism" val={item.score.professionalism} />
                  </div>

                  <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 italic text-sm text-slate-700 leading-relaxed shadow-sm">
                    "{item.score.feedback}"
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setStatus('IDLE')}
              className="mt-12 w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
            >
              Start New Interview Practice
            </button>
          </div>
        )}
      </main>

      <footer className="mt-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest text-center">
        Pediatric Occupational Therapy Clinical Simulation • v1.0
      </footer>
    </div>
  );
}
