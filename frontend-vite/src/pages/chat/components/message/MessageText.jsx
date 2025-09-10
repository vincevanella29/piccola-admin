// src/pages/chat/components/client/MessageText.jsx
import React from 'react';

const MessageText = ({ role = 'bot', text, optimistic }) => {
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {text}
      {optimistic && (
        <div className="text-[10px] mt-1 opacity-70">sending...</div>
      )}
    </div>
  );
};

export default MessageText;
