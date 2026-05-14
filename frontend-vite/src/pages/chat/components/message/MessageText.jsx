import React from 'react';
import { Check, Clock } from 'lucide-react';

// Helper simple para detectar URLs y hacerlas clickeables
const formatText = (text) => {
  if (!text) return null;
  
  // Resiliencia contra objetos en la DB
  if (typeof text !== 'string') {
    if (text.lines && Array.isArray(text.lines)) {
      text = text.lines.join(' ');
    } else {
      text = JSON.stringify(text);
    }
  }

  // Regex simple para URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline opacity-90 hover:opacity-100 font-semibold break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

const MessageText = ({ role = 'bot', text, optimistic }) => {
  const isUser = role === 'user';

  return (
    <div className="flex flex-col gap-1">
      {/* Texto Principal */}
      <div className={`whitespace-pre-wrap break-words leading-relaxed tracking-wide ${isUser ? 'font-medium' : 'font-normal opacity-90'}`}>
        {formatText(text)}
      </div>

      {/* Estado de Envío (Optimistic UI) */}
      {optimistic && (
        <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
          <span className="text-[10px] font-medium opacity-70 italic tracking-wider">Enviando</span>
          <Clock size={10} className="animate-spin opacity-70" />
        </div>
      )}
    </div>
  );
};

export default MessageText;