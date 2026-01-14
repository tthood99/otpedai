
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import htm from 'htm';

const html = htm.bind(React.createElement);

// --- Icons (SVG paths for HeroIcons replacement to avoid import issues) ---
const AcademicCapIcon = () => html`<svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.94 49.94 0 00-9.945 3.141.75.75 0 01-.612 0 49.94 49.94 0 00-9.945-3.141.75.75 0 01-.231-1.337A60.65 60.65 0 0111.7 2.805z" /><path d="M13.06 15.473a48.45 48.45 0 017.666-2.048v.033a.75.75 0 01-.512.712 47.058 47.058 0 00-8.214 3.012.75.75 0 01-.614 0 47.047 47.047 0 00-8.214-3.012.75.75 0 01-.512-.712V13.42a48.454 48.454 0 017.666 2.048.75.75 0 00.733 0z" /><path d="M4.5 14.54V18a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18v-3.46a48.454 48.454 0 00-7.5-1.54V13.1c0-.071-.01-.14-.03-.207A.75.75 0 0112 12.25a.75.75 0 01.03.643c.02.067.03.136.03.207v.36a48.454 48.454 0 00-7.5 1.54z" /></svg>`;
const MicrophoneIcon = () => html`<svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" /><path d="M6 10.5a.75.75 0 01.75.75 5.25 5.25 0 1010.5 0 .75.75 0 011.5 0 6.75 6.75 0 11-13.5 0A.75.75 0 016 10.5z" /><path d="M12 18.75a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25a.75.75 0 01.75-.75z" /></svg>`;

// --- Data ---
const OT_QUESTIONS = [
  { id: '1', text: "How do you approach creating a child-centered treatment plan for a 5-year-old with SPD who is tactile avoidant?", timeLimit: 60 },
  { id: '2', text: "Describe managing a difficult conversation with a resistant parent.", timeLimit: 90 },
  { id: '3', text: "How do you prioritize safety and discharge in pediatric inpatient settings?", timeLimit: 75 }
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
        <circle cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent" strokeDasharray="251.2" style=${{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="absolute text-xl font-bold">${timeLeft}s</span>
    </div>
  `;
};

const ScoreBar = ({ label, val }) => html`
  <div className="mb-3">
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
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
  const startRecording = () => { setTranscription(''); setStatus('RECORDING'); recognitionRef.current?.start(); };

  const analyze = async () => {
    recognitionRef.current?.stop();
    setStatus('ANALYZING');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Evaluate OT interview: Q: "${currentQuestion.text}" A: "${transcription || 'No response'}"`,
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
      if (currentIdx < OT_QUESTIONS.length - 1) { setCurrentIdx(i => i + 1); setStatus('PREPARING'); }
      else { setStatus('FINISHED'); }
    } catch (e) { setStatus('FINISHED'); }
  };

  return html`
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 flex flex-col items-center">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg"><${AcademicCapIcon} /></div>
          <h1 className="text-xl font-bold">Pediatric OT Recruiter</h1>
        </div>
      </header>

      <main className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 p-8 md:p-12">
        ${status === 'IDLE' && html`
          <div className="text-center">
            <h2 className="text-3xl font-black mb-4">OT Clinical Simulation</h2>
            <p className="text-slate-600 mb-8">Practice pediatric interview scenarios with AI evaluation.</p>
            <button onClick=${startInterview} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Begin Session</button>
          </div>
        `}

        ${(status === 'PREPARING' || status === 'RECORDING' || status === 'ANALYZING') && html`
          <div>
            <div className="mb-8">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Question ${currentIdx + 1}</span>
              <h2 className="text-2xl font-bold text-slate-800 mt-2">${currentQuestion.text}</h2>
            </div>
            <div className="flex flex-col items-center">
              ${status === 'PREPARING' && html`
                <button onClick=${startRecording} className="flex flex-col items-center py-6">
                  <div className="w-20 h-20 border-2 border-dashed border-indigo-200 rounded-full flex items-center justify-center mb-4 text-indigo-400"><${MicrophoneIcon} /></div>
                  <span className="font-bold text-sm text-indigo-600 tracking-tight">Click to start recording response</span>
                </button>
              `}
              ${status === 'RECORDING' && html`
                <div className="w-full flex flex-col items-center space-y-6">
                  <${Timer} duration=${currentQuestion.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-6 bg-slate-900 rounded-2xl text-slate-300 min-h-[120px] shadow-inner font-mono text-sm">
                    ${transcription || "Listening..."}
                  </div>
                  <button onClick=${analyze} className="px-10 py-3 bg-slate-800 text-white rounded-xl font-bold">Finish</button>
                </div>
              `}
              ${status === 'ANALYZING' && html`<div className="py-12 text-slate-400 font-bold animate-pulse">Recruiter is analyzing clinical depth...</div>`}
            </div>
          </div>
        `}

        ${status === 'FINISHED' && html`
          <div>
            <h2 className="text-2xl font-black mb-8">Performance Summary</h2>
            <div className="space-y-6">
              ${history.map(item => html`
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex justify-between mb-6">
                    <h3 className="font-bold text-slate-800 flex-1 pr-4">${item.q}</h3>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center">
                      <div className="text-xl font-black text-indigo-600">${item.data.overall}</div>
                      <div className="text-[8px] text-slate-400 font-black uppercase">Points</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6">
                    <${ScoreBar} label="Clinical" val=${item.data.clinical} />
                    <${ScoreBar} label="Empathy" val=${item.data.empathy} />
                  </div>
                  <p className="bg-white p-4 rounded-xl text-sm italic border border-slate-100 mt-4">"${item.data.feedback}"</p>
                </div>
              `)}
            </div>
            <button onClick=${() => setStatus('IDLE')} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-xl font-bold">Restart Simulation</button>
          </div>
        `}
      </main>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
