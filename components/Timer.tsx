
import React, { useEffect, useState } from 'react';

interface TimerProps {
  duration: number;
  onComplete: () => void;
  isActive: boolean;
}

const Timer: React.FC<TimerProps> = ({ duration, onComplete, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isActive) return;
    if (timeLeft <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isActive, onComplete]);

  const percentage = (timeLeft / duration) * 100;
  const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray="251.2"
          style={{ strokeDashoffset }}
          className="text-indigo-600 transition-all duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute text-xl font-bold">{timeLeft}s</span>
    </div>
  );
};

export default Timer;
