import React, { useEffect, useState } from 'react';
import { FaClock } from 'react-icons/fa';

const CountdownTimer = ({ targetDate, label = '' }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const timeParts = [
    { value: timeLeft.days, label: 'd' },
    { value: timeLeft.hours, label: 'h' },
    { value: timeLeft.minutes, label: 'm' },
    { value: timeLeft.seconds, label: 's' },
  ];

  return (
    <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
      <FaClock />
      {label && <span className="font-medium">{label}</span>}
      <div className="flex gap-1">
        {timeParts.map(({ value, label: partLabel }) => (
          <div key={partLabel} className="bg-matrix-green/20 px-2 py-1 rounded-md text-matrix-green font-mono text-sm flex flex-col items-center">
            <span className="font-bold">{value.toString().padStart(2, '0')}</span>
            <span className="text-xs uppercase">{partLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountdownTimer;