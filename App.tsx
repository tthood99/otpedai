
import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon, MicrophoneIcon, ArrowPathIcon, CheckCircleIcon, AcademicCapIcon, UserIcon } from '@heroicons/react/24/solid';
import { OT_QUESTIONS, RECRUITER_PERSONA } from './constants';
import { InterviewStatus, InterviewHistoryItem } from './types';
import { analyzeResponse } from './services/geminiService';
import Timer from './components/Timer';

const App: React.FC = () => {
  const [status, setStatus] = useState<InterviewStatus>(InterviewStatus.IDLE);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [transcription, setTranscription] = useState('');
  const recognitionRef = useRef<any>(null);

  const currentQuestion = OT_QUESTIONS[currentQuestionIndex];

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscription(prev => (prev + ' ' + finalTranscript).trim());
      };
    }
  }, []);

  const startInterview = () => {
    setHistory([]);
    setCurrentQuestionIndex(0);
    setStatus(InterviewStatus.PREPARING);
  };

  const startRecording = () => {
    setTranscription('');
    setStatus(InterviewStatus.RECORDING);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Recognition already started or error:", e);
      }
    }
  };

  const stopRecordingAndAnalyze = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setStatus(InterviewStatus.ANALYZING);

    try {
      // Use fallback if transcription is empty to avoid API errors
      const finalTranscript = transcription || "The candidate provided a silent or non-verbal response.";
      const result = await analyzeResponse(currentQuestion.text, finalTranscript);
      
      const historyItem: InterviewHistoryItem = {
        question: currentQuestion.text,
        transcription: finalTranscript,
        score: result
      };
      
      setHistory(prev => [...prev, historyItem]);
      
      if (currentQuestionIndex < OT_QUESTIONS.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setStatus(InterviewStatus.PREPARING);
      } else {
        setStatus(InterviewStatus.FINISHED);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("There was an error analyzing your response. Let's try the next one.");
      setStatus(InterviewStatus.PREPARING);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-slate-50">
      <header className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <AcademicCapIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Pediatric OT Recruiter</h1>
        </div>
        {status !== InterviewStatus.IDLE && (
          <div className="text-sm font-medium text-slate-500">
            Step {currentQuestionIndex + 1} of {OT_QUESTIONS.length}
          </div>
        )}
      </header>

      <main className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {status === InterviewStatus.IDLE && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserIcon className="h-10 w-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Pediatric Clinic Interview</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Hello! I'm your Senior OT Recruiter. I'll be evaluating your clinical reasoning and 
              family-centered approach for our pediatric department. Are you ready?
            </p>
            <button 
              onClick={startInterview}
              className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 mx-auto"
            >
              <PlayIcon className="h-5 w-5" />
              <span>Start Interview</span>
            </button>
          </div>
        )}

        {(status === InterviewStatus.PREPARING || status === InterviewStatus.RECORDING || status === InterviewStatus.ANALYZING) && (
          <div className="p-8 md:p-12">
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Current Prompt</span>
              </div>
              <h2 className="text-2xl font-semibold text-slate-800 leading-snug">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="flex flex-col items-center">
              {status === InterviewStatus.PREPARING && (
                <div className="text-center py-6">
                  <button 
                    onClick={startRecording}
                    className="group relative flex flex-col items-center"
                  >
                    <div className="w-20 h-20 bg-white border-2 border-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-colors">
                      <MicrophoneIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <span className="text-indigo-600 font-bold">Click to start responding</span>
                  </button>
                </div>
              )}

              {status === InterviewStatus.RECORDING && (
                <div className="w-full flex flex-col items-center space-y-8">
                  <Timer 
                    duration={currentQuestion.timeLimit} 
                    isActive={true} 
                    onComplete={stopRecordingAndAnalyze} 
                  />
                  <div className="w-full p-6 bg-slate-900 rounded-xl text-slate-300 min-h-[120px] relative">
                    <div className="absolute top-4 right-4 flex items-center space-x-1">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-bold text-red-500">LIVE</span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {transcription || "Listening for your clinical response..."}
                    </p>
                  </div>
                  <button 
                    onClick={stopRecordingAndAnalyze}
                    className="px-8 py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors text-sm"
                  >
                    Submit Response
                  </button>
                </div>
              )}

              {status === InterviewStatus.ANALYZING && (
                <div className="text-center py-12">
                  <div className="inline-block relative">
                    <ArrowPathIcon className="h-12 w-12 text-indigo-600 animate-spin" />
                  </div>
                  <p className="mt-4 text-slate-500 font-medium italic">Evaluating clinical competency...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === InterviewStatus.FINISHED && (
          <div className="p-8 md:p-12">
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900">Performance Report</h2>
              <div className="px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-100">
                Interview Complete
              </div>
            </div>

            <div className="space-y-6">
              {history.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800 flex-1 pr-4">{item.question}</h3>
                    <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-center shadow-sm">
                      <div className="text-xl font-black text-indigo-600 leading-none">{item.score.overall}</div>
                      <div className="text-[10px] text-slate-400 font-bold">SCORE</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <ScoreBar label="Reasoning" val={item.score.clinicalReasoning} />
                    <ScoreBar label="Empathy" val={item.score.empathy} />
                    <ScoreBar label="Comm." val={item.score.communication} />
                    <ScoreBar label="Prof." val={item.score.professionalism} />
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-100 italic text-sm text-slate-600">
                    "{item.score.feedback}"
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setStatus(InterviewStatus.IDLE)}
              className="mt-10 w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
            >
              Start New Session
            </button>
          </div>
        )}
      </main>

      <footer className="mt-8 text-slate-400 text-xs text-center">
        © 2024 OT Recruiter AI • Pedatric Clinic Prep • Powered by Google Gemini
      </footer>
    </div>
  );
};

const ScoreBar: React.FC<{label: string, val: number}> = ({ label, val }) => (
  <div>
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
      <span>{label}</span>
      <span>{val}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${val}%` }} />
    </div>
  </div>
);

export default App;
