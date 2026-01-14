
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import htm from 'htm';

const html = htm.bind(React.createElement);

const OT_QUESTIONS = [
  { id: '1', text: "How do you approach creating a child-centered treatment plan for a 5-year-old with SPD who is tactile avoidant?", timeLimit: 60 },
  { id: '2', text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to your clinical recommendations.", timeLimit: 90 },
  { id: '3', text: "In a pediatric inpatient setting, how do you prioritize safety while still addressing developmental milestones?", timeLimit: 75 }
];

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
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 font-bold">OT</div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase">Recruiter AI</h1>
        </div>
        ${status !== 'IDLE' && status !== 'DONE' && html`
          <span className="text-xs font-black text-slate-400 uppercase">Quest ${idx + 1} / ${OT_QUESTIONS.length}</span>
        `}
      </header>

      <main className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        ${status === 'IDLE' && html`
          <div className="p-10 text-center">
            <h2 className="text-3xl font-black mb-4 text-slate-900 leading-tight">Pediatric OT Practice</h2>
            <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed font-medium">Get immediate clinical feedback on your interview responses.</p>
            <button onClick=${start} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100">Start Session</button>
          </div>
        `}

        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <div className="p-8 md:p-12">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">${question.text}</h2>
            </div>
            <div className="flex flex-col items-center">
              ${status === 'PREP' && html`
                <button onClick=${record} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Start Recording</button>
              `}
              ${status === 'REC' && html`
                <div className="w-full flex flex-col items-center space-y-8">
                  <${Timer} duration=${question.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-6 bg-slate-900 rounded-2xl text-slate-400 min-h-[140px] shadow-inner relative border border-slate-800 font-mono text-sm italic">
                    ${transcript || "Waiting for your answer..."}
                  </div>
                  <button onClick=${analyze} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold shadow-lg">Submit Response</button>
                </div>
              `}
              ${status === 'WAIT' && html`<div className="py-20 animate-pulse text-slate-400 font-bold">Analyzing clinical reasoning...</div>`}
            </div>
          </div>
        `}

        ${status === 'DONE' && html`
          <div className="p-8 md:p-12 space-y-8">
            <h2 className="text-2xl font-black text-slate-800 border-b pb-4">Results</h2>
            ${history.map(item => html`
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-slate-800 flex-1 pr-6 leading-tight">${item.q}</h3>
                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center">
                    <div className="text-2xl font-black text-indigo-600">${item.data.overall}</div>
                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Points</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 mb-4">
                  <${ScoreBar} label="Logic" val=${item.data.clinical} />
                  <${ScoreBar} label="Empathy" val=${item.data.empathy} />
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 italic text-sm text-slate-700 leading-relaxed font-medium">
                  "${item.data.feedback}"
                </div>
              </div>
            `)}
            <button onClick=${() => setStatus('IDLE')} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-xl">Restart Simulation</button>
          </div>
        `}
      </main>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
