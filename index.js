
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import htm from 'htm';

const html = htm.bind(React.createElement);

const DEFAULT_QUESTIONS = [
  { id: Date.now() + 1, text: "How do you approach creating a child-centered treatment plan for a 5-year-old with SPD who is tactile avoidant?", timeLimit: 60 },
  { id: Date.now() + 2, text: "Describe a time you had to manage a difficult conversation with a parent who was resistant to your clinical recommendations.", timeLimit: 90 },
  { id: Date.now() + 3, text: "In a pediatric inpatient setting, how do you prioritize safety while still addressing developmental milestones?", timeLimit: 75 }
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
        <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
        <circle cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent" 
          strokeDasharray="251.2" style=${{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="absolute text-xl font-black text-slate-800">${timeLeft}s</span>
    </div>
  `;
};

const ScoreBar = ({ label, val, colorClass = "bg-indigo-600" }) => html`
  <div className="mb-4">
    <div className="flex justify-between text-[9px] font-black text-slate-500 mb-1.5 uppercase tracking-widest">
      <span>${label}</span>
      <span className="text-slate-900">${val}%</span>
    </div>
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
      <div className="h-full ${colorClass} transition-all duration-1000 shadow-sm" style=${{ width: `${val}%` }} />
    </div>
  </div>
`;

function App() {
  const [status, setStatus] = useState('IDLE');
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);

  const question = questions[idx];

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

  const addQuestion = (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setQuestions([...questions, { id: Date.now(), text: newQuestionText.trim(), timeLimit: 75 }]);
    setNewQuestionText('');
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const startSimulation = () => {
    if (questions.length === 0) return alert("Please add at least one question.");
    setHistory([]);
    setIdx(0);
    setStatus('PREP');
  };

  const record = () => {
    setTranscript('');
    setStatus('REC');
    try { recRef.current?.start(); } catch(e){}
  };

  const analyze = async () => {
    recRef.current?.stop();
    setStatus('WAIT');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a Senior Occupational Therapy Hiring Director. Evaluate this interview response.
        
        Question: "${question.text}"
        Response: "${transcript || '[No audible response provided]'}"
        
        Provide a detailed technical and soft-skill breakdown using the required schema.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall: { type: Type.NUMBER, description: "Total score out of 100" },
              reasoning: { type: Type.NUMBER, description: "Depth of clinical reasoning/evidence-based practice" },
              clarity: { type: Type.NUMBER, description: "Logical flow and structural organization" },
              conciseness: { type: Type.NUMBER, description: "Ability to convey complex ideas efficiently" },
              empathy: { type: Type.NUMBER, description: "Client-centeredness and rapport building" },
              safety: { type: Type.NUMBER, description: "Risk management and ethical awareness" },
              professionalism: { type: Type.NUMBER, description: "Tone and clinical vocabulary usage" },
              feedback: { type: Type.STRING, description: "3-4 sentences of actionable clinical advice" }
            },
            required: ["overall", "reasoning", "clarity", "conciseness", "empathy", "safety", "professionalism", "feedback"]
          }
        }
      });
      const data = JSON.parse(resp.text);
      setHistory(prev => [...prev, { q: question.text, data }]);
      if (idx < questions.length - 1) {
        setIdx(i => i + 1);
        setStatus('PREP');
      } else {
        setStatus('DONE');
      }
    } catch (e) {
      console.error(e);
      setStatus('DONE');
    }
  };

  return html`
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans antialiased text-slate-900">
      <header className="w-full max-w-2xl flex items-center justify-between mb-8 mt-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 font-black">OT</div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase">Recruiter <span className="text-indigo-600">Pro</span></h1>
        </div>
        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <span className="text-xs font-black text-slate-400 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
            ${idx + 1} / ${questions.length}
          </span>
        `}
      </header>

      <main className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
        
        ${status === 'IDLE' && html`
          <div className="p-12 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-indigo-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
            </div>
            <h2 className="text-4xl font-black mb-4 text-slate-900 leading-tight">Precision Interviewing</h2>
            <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed font-medium">Evaluate your clinical reasoning, clarity, and safety protocols with high-fidelity AI feedback.</p>
            <div className="flex flex-col space-y-4">
              <button onClick=${() => setStatus('SETUP')} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Customize Scenarios</button>
              <button onClick=${startSimulation} className="w-full py-5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-2xl font-bold hover:bg-indigo-50 transition-all">Start Default Evaluation</button>
            </div>
          </div>
        `}

        ${status === 'SETUP' && html`
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-800">Clinical Question Set</h2>
              <button onClick=${() => setStatus('IDLE')} className="text-slate-400 hover:text-slate-600 p-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit=${addQuestion} className="mb-8 flex space-x-2">
              <input 
                type="text" 
                value=${newQuestionText} 
                onChange=${(e) => setNewQuestionText(e.target.value)}
                placeholder="Paste an interview prompt here..."
                className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
              />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all">Add</button>
            </form>

            <div className="space-y-3 mb-10 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              ${questions.map((q, i) => html`
                <div key=${q.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                  <span className="text-sm font-semibold text-slate-700 line-clamp-2 pr-4"><span className="text-indigo-300 font-black mr-2">Q${i+1}.</span> ${q.text}</span>
                  <button onClick=${() => removeQuestion(q.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              `)}
              ${questions.length === 0 && html`
                <div className="text-center py-10 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-2xl">No questions defined. Add one above to begin.</div>
              `}
            </div>

            <button onClick=${startSimulation} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2">
              <span>Start Clinical Review</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">${questions.length}</span>
            </button>
          </div>
        `}

        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <div className="p-8 md:p-12">
            <div className="mb-10 text-center animate-in fade-in zoom-in duration-500">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-4 block">Active Clinical Prompt</span>
              <h2 className="text-3xl font-bold text-slate-900 leading-tight">${question.text}</h2>
            </div>

            <div className="flex flex-col items-center">
              ${status === 'PREP' && html`
                <div className="flex flex-col items-center py-10 w-full animate-in slide-in-from-bottom-8 duration-700">
                  <button onClick=${record} className="w-28 h-28 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-indigo-200 hover:scale-110 active:scale-95 transition-all mb-8 group">
                    <svg className="w-10 h-10 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
                  </button>
                  <span className="font-black text-indigo-600 text-[10px] uppercase tracking-[0.2em]">Initial Response Mode</span>
                </div>
              `}

              ${status === 'REC' && html`
                <div className="w-full flex flex-col items-center space-y-8 animate-in fade-in duration-300">
                  <${Timer} duration=${question.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-8 bg-slate-900 rounded-[2.5rem] text-slate-300 min-h-[180px] shadow-2xl relative border border-slate-800 overflow-hidden ring-4 ring-indigo-500/10">
                    <div className="absolute top-6 right-6 flex items-center space-x-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                      <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>
                      <span className="text-[10px] font-black text-red-500 tracking-tighter">VOICE ANALYTICS ON</span>
                    </div>
                    <p className="text-base leading-relaxed italic font-medium opacity-90 transition-opacity duration-300">${transcript || "Awaiting clinical explanation..."}</p>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-40 animate-pulse"></div>
                  </div>
                  <button onClick=${analyze} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-700 active:scale-98 transition-all">Submit for Review</button>
                </div>
              `}

              ${status === 'WAIT' && html`
                <div className="text-center py-20 flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-8 shadow-sm"></div>
                  <div className="space-y-2">
                    <p className="text-slate-800 font-black text-sm tracking-widest uppercase">Benchmarking Evidence</p>
                    <p className="text-slate-400 font-medium italic text-xs">Cross-referencing best practices...</p>
                  </div>
                </div>
              `}
            </div>
          </div>
        `}

        ${status === 'DONE' && html`
          <div className="p-8 md:p-12 space-y-12 overflow-y-auto max-h-[85vh] custom-scrollbar">
            <div className="flex justify-between items-center pb-8 border-b border-slate-100">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Post-Clinical Assessment</h2>
              <div className="px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm">6-Metric Audit</div>
            </div>

            <div className="space-y-16">
              ${history.map((item, i) => html`
                <div key=${i} className="group animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex-1 pr-8">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Case ${i+1}</span>
                        ${item.data.overall >= 90 && html`<span className="text-[9px] font-black text-green-600 uppercase tracking-widest flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> High Impact
                        </span>`}
                      </div>
                      <h3 className="font-bold text-slate-800 leading-tight text-2xl">${item.q}</h3>
                    </div>
                    <div className="bg-white px-7 py-5 rounded-[2rem] border border-slate-200 text-center shadow-xl shadow-slate-200/50 min-w-[100px]">
                      <div className="text-4xl font-black text-slate-900 leading-none">${item.data.overall}</div>
                      <div className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-tighter">Overall</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 mb-8">
                    <div>
                      <${ScoreBar} label="Clinical Reasoning" val=${item.data.reasoning} colorClass="bg-indigo-600" />
                      <${ScoreBar} label="Structural Clarity" val=${item.data.clarity} colorClass="bg-indigo-500" />
                      <${ScoreBar} label="Clincial Conciseness" val=${item.data.conciseness} colorClass="bg-indigo-400" />
                    </div>
                    <div>
                      <${ScoreBar} label="Empathy & Rapport" val=${item.data.empathy} colorClass="bg-teal-500" />
                      <${ScoreBar} label="Safety Protocols" val=${item.data.safety} colorClass="bg-orange-500" />
                      <${ScoreBar} label="Professionalism" val=${item.data.professionalism} colorClass="bg-slate-700" />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200/50 italic text-sm text-slate-700 leading-relaxed font-medium shadow-inner relative overflow-hidden group-hover:bg-white transition-colors">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600/20 group-hover:bg-indigo-600 transition-colors"></div>
                    <div className="mb-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Director's Notes:</div>
                    "${item.data.feedback}"
                  </div>
                </div>
              `)}
            </div>
            
            <div className="pt-6 border-t border-slate-100 flex space-x-4">
              <button onClick=${() => setStatus('IDLE')} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl hover:bg-black active:scale-95 transition-all text-xs">Reset All</button>
              <button onClick=${() => window.print()} className="px-8 py-6 bg-white text-slate-400 border border-slate-200 rounded-[2rem] font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-widest">Print Report</button>
            </div>
          </div>
        `}
      </main>
      <footer className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] text-center">
        Clinical Simulation Engine • Pediatric OT • v3.0.1
      </footer>
      
      <style>${`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @media print {
          body { background: white; }
          main { shadow: none; border: none; }
          button { display: none; }
        }
      `}</style>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
