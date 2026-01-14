
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { OT_QUESTIONS } from './constants';
import { InterviewStatus, Question, InterviewScore, InterviewHistoryItem } from './types';
import { analyzeResponse } from './services/geminiService';
import Timer from './components/Timer';
import { 
  PlayIcon, 
  MicrophoneIcon, 
  ArrowPathIcon, 
  CheckCircleIcon,
  ChartBarIcon,
  AcademicCapIcon,
  ChevronRightIcon
} from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [status, setStatus] = useState<InterviewStatus>(InterviewStatus.IDLE);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [transcription, setTranscription] = useState('');
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currentQuestion = OT_QUESTIONS[currentQuestionIndex];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        setTranscription(prev => prev + ' ' + final);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecognitionActive(false);
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
    setIsRecognitionActive(true);
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }
  };

  const stopRecordingAndAnalyze = async () => {
    setIsRecognitionActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setStatus(InterviewStatus.ANALYZING);

    try {
      const result = await analyzeResponse(currentQuestion.text, transcription);
      const historyItem: InterviewHistoryItem = {
        question: currentQuestion.text,
        transcription: transcription.trim(),
        score: result
      };
      setHistory(prev => [...prev, historyItem]);
      
      if (currentQuestionIndex < OT_QUESTIONS.length - 1) {
        setStatus(InterviewStatus.PREPARING);
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setStatus(InterviewStatus.FINISHED);
      }
    } catch (error) {
      console.error("Analysis failed", error);
      setStatus(InterviewStatus.IDLE);
    }
  };

  const renderProgress = () => (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
      <div 
        className="bg-indigo-600 h-2 transition-all duration-500" 
        style={{ width: `${((currentQuestionIndex + (status === InterviewStatus.FINISHED ? 1 : 0)) / OT_QUESTIONS.length) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-12 max-w-5xl mx-auto">
      <header className="w-full text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
          <AcademicCapIcon className="h-8 w-8 text-indigo-600" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Pediatric OT Recruiter AI</h1>
        <p className="mt-2 text-lg text-gray-600">Simulate your clinical interview with professional feedback.</p>
      </header>

      <main className="w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 relative">
        {status === InterviewStatus.IDLE && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-6">Ready to start your session?</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              You'll face {OT_QUESTIONS.length} clinical questions. Prepare your mic and find a quiet space.
            </p>
            <button 
              onClick={startInterview}
              className="px-10 py-4 bg-indigo-600 text-white rounded-full font-bold text-lg hover:bg-indigo-700 transition-all flex items-center mx-auto space-x-2"
            >
              <PlayIcon className="h-5 w-5" />
              <span>Begin Interview</span>
            </button>
          </div>
        )}

        {(status === InterviewStatus.PREPARING || status === InterviewStatus.RECORDING || status === InterviewStatus.ANALYZING) && (
          <div className="animate-fade-in">
            {renderProgress()}
            <div className="mb-10">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
                Question {currentQuestionIndex + 1} of {OT_QUESTIONS.length}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold mt-4 leading-snug text-gray-800">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="flex flex-col items-center justify-center space-y-8">
              {status === InterviewStatus.PREPARING && (
                <div className="text-center">
                  <p className="text-gray-500 mb-6 italic">Review the question, then click to record your verbal response.</p>
                  <button 
                    onClick={startRecording}
                    className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-full font-bold hover:bg-indigo-50 transition-all flex items-center space-x-2"
                  >
                    <MicrophoneIcon className="h-5 w-5" />
                    <span>Start Speaking</span>
                  </button>
                </div>
              )}

              {status === InterviewStatus.RECORDING && (
                <div className="flex flex-col items-center space-y-6 w-full">
                  <Timer 
                    duration={currentQuestion.timeLimit} 
                    isActive={true} 
                    onComplete={stopRecordingAndAnalyze} 
                  />
                  <div className="w-full max-w-lg p-6 bg-red-50 rounded-2xl border border-red-100 text-center relative overflow-hidden">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-600 font-bold text-sm">RECORDING LIVE</span>
                    </div>
                    <p className="text-gray-700 min-h-[60px]">{transcription || "..."}</p>
                    <button 
                      onClick={stopRecordingAndAnalyze}
                      className="mt-6 px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-sm"
                    >
                      Finish Early
                    </button>
                  </div>
                </div>
              )}

              {status === InterviewStatus.ANALYZING && (
                <div className="flex flex-col items-center space-y-4 py-12">
                  <ArrowPathIcon className="h-12 w-12 text-indigo-600 animate-spin" />
                  <p className="text-gray-600 font-medium">Recruiter is analyzing your clinical reasoning...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === InterviewStatus.FINISHED && (
          <div className="animate-fade-in">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Interview Summary</h2>
                <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full flex items-center space-x-2">
                   <CheckCircleIcon className="h-5 w-5" />
                   <span className="font-bold">Completed</span>
                </div>
             </div>

             <div className="space-y-8">
                {history.map((item, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-2xl p-6 bg-gray-50 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800">Q: {item.question}</h3>
                      </div>
                      <div className="ml-4 flex items-center bg-white px-3 py-1 rounded-lg border border-gray-200">
                        <span className="text-2xl font-black text-indigo-600">{item.score.overall}</span>
                        <span className="text-gray-400 text-sm ml-1">/100</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <ScoreMetric label="Reasoning" val={item.score.clinicalReasoning} />
                      <ScoreMetric label="Empathy" val={item.score.empathy} />
                      <ScoreMetric label="Communication" val={item.score.communication} />
                      <ScoreMetric label="Professionalism" val={item.score.professionalism} />
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-500 font-bold uppercase mb-2">Recruiter Feedback</p>
                      <p className="text-gray-700 leading-relaxed text-sm italic">"{item.score.feedback}"</p>
                    </div>
                  </div>
                ))}
             </div>

             <div className="mt-12 text-center">
                <button 
                  onClick={() => setStatus(InterviewStatus.IDLE)}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-all"
                >
                  Restart Practice Session
                </button>
             </div>
          </div>
        )}
      </main>

      <footer className="mt-12 text-gray-400 text-sm">
        Designed for Occupational Therapy Students and Professionals. Built with Gemini AI.
      </footer>
    </div>
  );
};

const ScoreMetric: React.FC<{label: string, val: number}> = ({ label, val }) => (
  <div className="text-center">
    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{label}</p>
    <div className="text-sm font-bold text-gray-700">{val}/100</div>
    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
      <div className="bg-indigo-400 h-1 rounded-full" style={{ width: `${val}%` }} />
    </div>
  </div>
);

export default App;
