import React from 'react';

const MessageBubble = ({ role = 'bot', children }) => {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`
          relative px-5 py-3.5 w-full sm:max-w-[95%] shadow-md transition-all duration-200
          
          ${isUser 
            ? 'bg-gradient-to-br from-light-accent to-matrix-green text-dark-bg rounded-2xl rounded-tr-sm' 
            : 'bg-light-surface dark:bg-dark-surface/60 backdrop-blur-md border border-light-border/50 dark:border-dark-border/50 text-light-text-primary dark:text-dark-text-primary rounded-2xl rounded-tl-sm'
          }
        `}
      >
        {/* Contenido con márgenes ajustados para que no toque los bordes */}
        <div className="text-sm sm:text-[15px] [&>div]:!m-0">
          {children}
        </div>

        {/* Sutil efecto de brillo para mensajes del usuario */}
        {isUser && (
           <div className="absolute inset-0 rounded-2xl rounded-tr-sm bg-white/10 pointer-events-none mix-blend-overlay" />
        )}
      </div>
    </div>
  );
};

export default MessageBubble;