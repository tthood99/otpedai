
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

const ScoreBar = ({ label, val }) => html`
  <div className="mb-3">
    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-tighter">
      <span>${label}</span>
      <span>${val}%</span>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
      <div className="h-full bg-indigo-600 transition-all duration-1000" style=${{ width: `${val}%` }} />
    </div>
  </div>
`;

function App() {
  const [status, setStatus] = useState('IDLE'); // IDLE, SETUP, PREP, REC, WAIT, DONE
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
    setQuestions([...questions, { id: Date.now(), text: newQuestionText.trim(), timeLimit: 60 }]);
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
          <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase">Recruiter AI</h1>
        </div>
        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <span className="text-xs font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
            QUEST ${idx + 1} / ${questions.length}
          </span>
        `}
      </header>

      <main className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
        
        ${status === 'IDLE' && html`
          <div className="p-12 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-indigo-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
            </div>
            <h2 className="text-4xl font-black mb-4 text-slate-900 leading-tight">Master Your OT Interview</h2>
            <p className="text-slate-500 mb-10 max-w-sm mx-auto leading-relaxed font-medium">Practice verbal clinical scenarios and receive feedback from a simulated senior recruiter.</p>
            <div className="flex flex-col space-y-4">
              <button onClick=${() => setStatus('SETUP')} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Setup Custom Questions</button>
              <button onClick=${startSimulation} className="w-full py-5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-2xl font-bold hover:bg-indigo-50 transition-all">Start with Defaults</button>
            </div>
          </div>
        `}

        ${status === 'SETUP' && html`
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-800">Question Manager</h2>
              <button onClick=${() => setStatus('IDLE')} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit=${addQuestion} className="mb-8 flex space-x-2">
              <input 
                type="text" 
                value=${newQuestionText} 
                onChange=${(e) => setNewQuestionText(e.target.value)}
                placeholder="Type your own interview question..."
                className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded-2xl font-bold hover:bg-indigo-700">Add</button>
            </form>

            <div className="space-y-3 mb-10 max-h-80 overflow-y-auto pr-2">
              ${questions.map((q, i) => html`
                <div key=${q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <span className="text-sm font-semibold text-slate-700 line-clamp-2 pr-4"><span className="text-slate-400 mr-2">${i+1}.</span> ${q.text}</span>
                  <button onClick=${() => removeQuestion(q.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              `)}
              ${questions.length === 0 && html`
                <div className="text-center py-10 text-slate-400 italic text-sm">No questions added yet.</div>
              `}
            </div>

            <button onClick=${startSimulation} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Start Simulation (${questions.length})</button>
          </div>
        `}

        ${(status === 'PREP' || status === 'REC' || status === 'WAIT') && html`
          <div className="p-8 md:p-12">
            <div className="mb-10 text-center">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4 block">Interview Prompt</span>
              <h2 className="text-3xl font-bold text-slate-900 leading-tight">${question.text}</h2>
            </div>

            <div className="flex flex-col items-center">
              ${status === 'PREP' && html`
                <div className="flex flex-col items-center py-10 w-full">
                  <button onClick=${record} className="w-28 h-28 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-indigo-200 hover:scale-110 active:scale-95 transition-all mb-6">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" /></svg>
                  </button>
                  <span className="font-bold text-indigo-600 text-sm uppercase tracking-widest">Tap to start responding</span>
                </div>
              `}

              ${status === 'REC' && html`
                <div className="w-full flex flex-col items-center space-y-8">
                  <${Timer} duration=${question.timeLimit} isActive=${true} onComplete=${analyze} />
                  <div className="w-full p-8 bg-slate-900 rounded-[2rem] text-slate-300 min-h-[160px] shadow-2xl relative border border-slate-800 overflow-hidden">
                    <div className="absolute top-6 right-6 flex items-center space-x-2 bg-red-500/10 px-3 py-1.5 rounded-full">
                      <div className="h-2 w-2 bg-red-500 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-black text-red-500 tracking-tighter">LIVE FEED</span>
                    </div>
                    <p className="text-base leading-relaxed italic font-medium opacity-80">${transcript || "Awaiting your clinical answer..."}</p>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30"></div>
                  </div>
                  <button onClick=${analyze} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-700 transition-all">Finish Answer</button>
                </div>
              `}

              ${status === 'WAIT' && html`
                <div className="text-center py-20 flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-8"></div>
                  <p className="text-slate-500 font-bold italic text-sm tracking-wide uppercase">Senior Recruiter is reviewing your response...</p>
                </div>
              `}
            </div>
          </div>
        `}

        ${status === 'DONE' && html`
          <div className="p-8 md:p-12 space-y-10 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center pb-6 border-b border-slate-100">
              <h2 className="text-3xl font-black text-slate-900">Final Assessment</h2>
              <div className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-100">Audit Complete</div>
            </div>

            <div className="space-y-10">
              ${history.map((item, i) => html`
                <div key=${i} className="group animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 pr-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Prompt ${i+1}</span>
                      <h3 className="font-bold text-slate-800 leading-tight text-xl">${item.q}</h3>
                    </div>
                    <div className="bg-indigo-50 px-6 py-4 rounded-3xl border border-indigo-100 text-center shadow-sm">
                      <div className="text-3xl font-black text-indigo-600 leading-none">${item.data.overall}</div>
                      <div className="text-[10px] text-indigo-400 font-black uppercase mt-1 tracking-tighter">Score</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 mb-6">
                    <${ScoreBar} label="Logic" val=${item.data.clinical} />
                    <${ScoreBar} label="Empathy" val=${item.data.empathy} />
                    <${ScoreBar} label="Comm." val=${item.data.comm} />
                  </div>
                  <div className="bg-indigo-50/30 p-6 rounded-[2rem] border border-indigo-100 italic text-sm text-slate-700 leading-relaxed font-medium shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    "${item.data.feedback}"
                  </div>
                </div>
              `)}
            </div>
            <button onClick=${() => setStatus('IDLE')} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-bold shadow-2xl hover:bg-black transition-all">Start New Practice Session</button>
          </div>
        `}
      </main>
      <footer className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">OT Clinical Suite • Pediatric Specialization • v2.0</footer>
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
