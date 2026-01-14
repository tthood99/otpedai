
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import htm from 'htm';

const html = htm.bind(React.createElement);

// --- OT Scenario Data ---
const OT_QUESTIONS = [
  { id: '1', text: "How do you approach creating a child-centered treatment plan for a 5-year-old with SPD who is tactile avoidant?", timeLimit: 60 },
  { id: '2', text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to your clinical recommendations.", timeLimit: 90 },
  { id: '3', text: "In a pediatric inpatient setting, how do you prioritize safety while still addressing developmental milestones?", timeLimit: 75 }
];

// --- Functional Components ---
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
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tighter">
      <span>${label}</span>
      <span>${val}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
      <div className="h-full bg-indigo-500 transition-all duration-1000" style=${{ width: `${val}%` }} />
    </div>
  </div>
`;

// --- Main Application Component ---
function App() {
  const [status, setStatus] = useState('IDLE');
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);

  const question = OT_QUESTIONS[idx];

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let t = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) t += e.results[i][0].transcript;
        }
        if (t) setTranscript(prev => (prev + ' ' + t).trim());
      };
      recRef.current = r;
    }
  }, []);

  const start = () => { setHistory([]); setIdx(0); setStatus('PREP'); };
  const record = () => { setTranscript(''); setStatus('REC'); try { recRef.current?.start(); } catch(e){} };

  const analyze = async () => {
    recRef.current?.stop();
    setStatus('WAIT');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Evaluate Pediatric OT interview. Question: "${question.text}" Response: "${transcript || 'No response'}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall: { type: Type.NUMBER },
              clinical: { type: Type.NUMBER },
              empathy: { type: Type.NUMBER },
              comm: { type: Type.NUMBER },
              feedback: { type: Type.STRING }
            },
            required: ["overall", "clinical", "empathy", "comm", "feedback"]
          }
        }
      });
      const data = JSON.parse(resp.text);
      setHistory(prev => [...prev, { q: question.text, data }]);
      if (idx < OT_QUESTIONS.length - 1) { setIdx(i => i + 1); setStatus('PREP'); }
      else { setStatus('DONE'); }
    } catch (e) { setStatus('DONE'); }
  };

  return html`
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans antialiased text-slate-900">
      <header className="w-full max-w-2xl flex items-center justify-between mb-10 mt-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase">OT Recruiter AI</h1>
        </div>
        ${status !== 'IDLE' && status !== 'DONE' && html`
          <span className="text-xs font-black text-slate-400">QUEST ${idx + 1} / ${OT_QUESTIONS.length}</span>
        `}
      </header>

      <main className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        ${status === 'IDLE' && html`
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-600">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
            </div>
            <h2 className="text-3xl font-black mb-4 text-slate-900 leading-tight">Pediatric OT Simulation</h2>
            <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed font-medium">Test your clinical reasoning with verbal responses and get professional feedback in seconds.</p>
            <button onClick=${start} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all">Begin Practice</button>
          </div>
        `}

        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <div className="p-8 md:p-12">
            <div className="mb-10">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3 block">Scenario Prompt</span>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">${question.text}</h2>
            </div>

            <div className="flex flex-col items-center">
              ${status === 'PREP' && html`
                <button onClick=${record} className="flex flex-col items-center py-10 group w-full">
                  <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6 text-slate-300 group-hover:border-indigo-400 group-hover:text-indigo-600 transition-all">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
                  </div>
                  <span className="font-bold text-indigo-600 text-sm">Click to record response</span>
                </button>
              `}

              ${status === 'REC' && html`
                <div className="w-full flex flex-col items-center space-y-8">
                  <${Timer} duration=${question.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-6 bg-slate-900 rounded-2xl text-slate-400 min-h-[140px] shadow-inner relative border border-slate-800">
                    <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-red-500/10 px-2 py-1 rounded-md">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-black text-red-500">LISTENING</span>
                    </div>
                    <p className="text-sm leading-relaxed italic font-medium">${transcript || "Waiting for your answer..."}</p>
                  </div>
                  <button onClick=${analyze} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold shadow-lg">Submit Clinical Response</button>
                </div>
              `}

              ${status === 'WAIT' && html`
                <div className="text-center py-20">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-400 font-bold italic text-sm">Recruiter scoring your logic...</p>
                </div>
              `}
            </div>
          </div>
        `}

        ${status === 'DONE' && html`
          <div className="p-8 md:p-12">
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-800">Review Summary</h2>
              <div className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-100">Clinical Audit Ready</div>
            </div>

            <div className="space-y-8">
              ${history.map(item => html`
                <div className="group">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-bold text-slate-800 flex-1 pr-6 leading-tight text-lg">${item.q}</h3>
                    <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200 text-center shadow-sm">
                      <div className="text-2xl font-black text-indigo-600 leading-none">${item.data.overall}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase mt-1">Grade</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 mb-6">
                    <${ScoreBar} label="Logic" val=${item.data.clinical} />
                    <${ScoreBar} label="Empathy" val=${item.data.empathy} />
                    <${ScoreBar} label="Comm." val=${item.data.comm} />
                  </div>
                  <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 italic text-sm text-slate-700 leading-relaxed font-medium">
                    "${item.data.feedback}"
                  </div>
                </div>
              `)}
            </div>
            <button onClick=${() => setStatus('IDLE')} className="w-full mt-12 py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-xl">New Session</button>
          </div>
        `}
      </main>
      <footer className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">OT Recruiter AI • Pediatric Simulation • v1.3</footer>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
