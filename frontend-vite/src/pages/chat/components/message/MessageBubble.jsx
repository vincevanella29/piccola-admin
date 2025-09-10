// src/pages/chat/components/client/MessageBubble.jsx
import React from 'react';

const MessageBubble = ({ role = 'bot', children }) => {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`${isUser ? 'bg-matrix-green text-dark-bg' : 'bg-white/10 text-light-text'} px-3 py-2 rounded-lg max-w-[80%]`}> 
        <div className="[&>div]:!m-0">{children}</div>
      </div>
    </div>
  );
};

export default MessageBubble;
