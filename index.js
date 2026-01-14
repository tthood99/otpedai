
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import htm from 'htm';

const html = htm.bind(React.createElement);

// --- Icons (SVG paths for reliability) ---
const AcademicCapIcon = () => html`
  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
`;

const MicrophoneIcon = () => html`
  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" />
  </svg>
`;

// --- Data ---
const OT_QUESTIONS = [
  { id: '1', text: "How do you approach creating a child-centered treatment plan for a 5-year-old with SPD who is tactile avoidant?", timeLimit: 60 },
  { id: '2', text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to recommendations.", timeLimit: 90 },
  { id: '3', text: "In a pediatric inpatient setting, how do you prioritize safety while addressing developmental milestones?", timeLimit: 75 },
  { id: '4', text: "How do you incorporate evidence-based practice into your daily interventions in a busy clinic?", timeLimit: 60 }
];

// --- Sub-components ---
const Timer = ({ duration, onComplete, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  useEffect(() => {
    if (!isActive) return;
    if (timeLeft <= 0) { onComplete(); return; }
    const t = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, isActive]);

  const offset = 251.2 - (251.2 * (timeLeft / duration)) / 100;
  return html`
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent" 
          strokeDasharray="251.2" style=${{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="absolute text-xl font-bold">${timeLeft}s</span>
    </div>
  `;
};

const ScoreBar = ({ label, val }) => html`
  <div className="mb-3">
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase">
      <span>${label}</span>
      <span>${val}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 transition-all duration-1000" style=${{ width: `${val}%` }} />
    </div>
  </div>
`;

// --- Main App ---
function App() {
  const [status, setStatus] = useState('IDLE');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [history, setHistory] = useState([]);
  const [transcription, setTranscription] = useState('');
  const recognitionRef = useRef(null);

  const currentQuestion = OT_QUESTIONS[currentIdx];

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let t = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) t += e.results[i][0].transcript;
        }
        setTranscription(prev => (prev + ' ' + t).trim());
      };
      recognitionRef.current = rec;
    }
  }, []);

  const startInterview = () => { setHistory([]); setCurrentIdx(0); setStatus('PREPARING'); };
  const startRecording = () => { setTranscription(''); setStatus('RECORDING'); try { recognitionRef.current?.start(); } catch(e){} };

  const analyze = async () => {
    recognitionRef.current?.stop();
    setStatus('ANALYZING');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Evaluate Pediatric OT interview response. Q: "${currentQuestion.text}" A: "${transcription || 'No verbal response'}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall: { type: Type.NUMBER },
              clinical: { type: Type.NUMBER },
              empathy: { type: Type.NUMBER },
              comm: { type: Type.NUMBER },
              prof: { type: Type.NUMBER },
              feedback: { type: Type.STRING }
            },
            required: ["overall", "clinical", "empathy", "comm", "prof", "feedback"]
          }
        }
      });
      const data = JSON.parse(resp.text);
      setHistory(prev => [...prev, { q: currentQuestion.text, data }]);
      if (currentIdx < OT_QUESTIONS.length - 1) {
        setCurrentIdx(i => i + 1);
        setStatus('PREPARING');
      } else {
        setStatus('FINISHED');
      }
    } catch (e) {
      console.error(e);
      setStatus('FINISHED');
    }
  };

  return html`
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 flex flex-col items-center font-sans">
      <header className="w-full max-w-3xl flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-100"><${AcademicCapIcon} /></div>
          <h1 className="text-xl font-bold text-slate-800">Pediatric OT Recruiter</h1>
        </div>
        ${status !== 'IDLE' && status !== 'FINISHED' && html`
           <span className="text-xs font-bold text-slate-400">Step ${currentIdx + 1} / ${OT_QUESTIONS.length}</span>
        `}
      </header>

      <main className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        ${status === 'IDLE' && html`
          <div className="p-12 text-center">
             <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
               <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
             </div>
             <h2 className="text-3xl font-black mb-4 text-slate-900">OT Recruiter AI</h2>
             <p className="text-slate-600 mb-10 leading-relaxed">Practice your clinical reasoning with a simulated senior recruiter. Provide verbal answers to common pediatric scenarios.</p>
             <button onClick=${startInterview} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-105 transition-transform">Begin Simulation</button>
          </div>
        `}

        ${(status === 'PREPARING' || status === 'RECORDING' || status === 'ANALYZING') && html`
          <div className="p-8 md:p-12">
            <div className="mb-8">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Current Clinical Prompt</span>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">${currentQuestion.text}</h2>
            </div>

            <div className="flex flex-col items-center">
              ${status === 'PREPARING' && html`
                <button onClick=${startRecording} className="flex flex-col items-center py-8 group">
                  <div className="w-20 h-20 border-2 border-dashed border-indigo-200 rounded-full flex items-center justify-center mb-4 text-indigo-300 group-hover:border-indigo-500 group-hover:text-indigo-600 transition-all"><${MicrophoneIcon} /></div>
                  <span className="font-bold text-sm text-indigo-600">Click to start responding</span>
                </button>
              `}

              ${status === 'RECORDING' && html`
                <div className="w-full flex flex-col items-center space-y-8">
                  <${Timer} duration=${currentQuestion.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-6 bg-slate-900 rounded-2xl text-slate-300 min-h-[120px] shadow-inner relative">
                    <div className="absolute top-4 right-4 flex items-center space-x-1.5">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-black text-red-500">LIVE</span>
                    </div>
                    <p className="text-sm leading-relaxed font-mono italic">${transcription || "Listening for your response..."}</p>
                  </div>
                  <button onClick=${analyze} className="px-12 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg">Submit Answer</button>
                </div>
              `}

              ${status === 'ANALYZING' && html`
                <div className="text-center py-16">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-400 font-bold italic">Recruiter is reviewing your clinical logic...</p>
                </div>
              `}
            </div>
          </div>
        `}

        ${status === 'FINISHED' && html`
          <div className="p-8 md:p-12">
            <div className="flex justify-between items-center mb-10 pb-6 border-b">
              <h2 className="text-2xl font-black">Performance Summary</h2>
              <div className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase border border-green-100">Review Ready</div>
            </div>

            <div className="space-y-6">
              ${history.map(item => html`
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-bold text-slate-800 flex-1 pr-6 leading-snug">${item.q}</h3>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center shadow-sm">
                      <div className="text-2xl font-black text-indigo-600">${item.data.overall}</div>
                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-tighter">Points</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8">
                    <${ScoreBar} label="Clinical reasoning" val=${item.data.clinical} />
                    <${ScoreBar} label="Empathy" val=${item.data.empathy} />
                    <${ScoreBar} label="Communication" val=${item.data.comm} />
                    <${ScoreBar} label="Professionalism" val=${item.data.prof} />
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-xl mt-4 border border-indigo-100 italic text-sm text-slate-700 leading-relaxed shadow-sm">
                    "${item.data.feedback}"
                  </div>
                </div>
              `)}
            </div>
            <button onClick=${() => setStatus('IDLE')} className="w-full mt-10 py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-colors shadow-xl">New Simulation</button>
          </div>
        `}
      </main>
      <footer className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pediatric OT Clinical Simulator v1.2</footer>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
