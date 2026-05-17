import React, { useEffect, useState } from 'react';
import { FaClock } from 'react-icons/fa';

const CountdownTimer = ({ targetDate, label = '', compact = false, textClass = '' }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const updateCountdown = () => {
      if (!targetDate) return;
      const now = Date.now();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  if (timeLeft.expired) {
    return (
      <div className={`flex items-center gap-1.5 ${textClass || 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
        {!compact && <FaClock />}
        {label && <span className="font-medium mr-1 opacity-70">{label}</span>}
        <span className="font-bold text-red-500 uppercase text-xs tracking-wider">Expirado</span>
      </div>
    );
  }

  if (compact) {
    let str = '';
    if (timeLeft.days > 0) {
      str = `${timeLeft.days}d ${timeLeft.hours}h`;
    } else if (timeLeft.hours > 0) {
      str = `${timeLeft.hours}h ${timeLeft.minutes}m`;
    } else {
      str = `${timeLeft.minutes}m ${timeLeft.seconds}s`;
    }
    return (
      <div className={`flex items-center gap-1 ${textClass || 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
        {label && <span className="font-medium mr-1">{label}</span>}
        <span className="font-bold tracking-tight">{str}</span>
      </div>
    );
  }

  const timeParts = [
    { value: timeLeft.days, label: 'd' },
    { value: timeLeft.hours, label: 'h' },
    { value: timeLeft.minutes, label: 'm' },
    { value: timeLeft.seconds, label: 's' },
  ];

  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && <span className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">{label}</span>}
      <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
        <FaClock className="hidden sm:block" />
        <div className="flex gap-1">
          {timeParts.map(({ value, label: partLabel }) => (
            <div key={partLabel} className="bg-matrix-green/10 border border-matrix-green/20 px-2.5 py-1.5 rounded-lg text-matrix-green font-mono text-sm flex flex-col items-center min-w-[40px] shadow-sm">
              <span className="font-bold leading-none">{value.toString().padStart(2, '0')}</span>
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest mt-1 opacity-80">{partLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;