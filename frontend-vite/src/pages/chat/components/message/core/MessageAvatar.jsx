import React from 'react';
import { UserCircle2 } from 'lucide-react';
import NonnaIcon from '../../../../../components/common/NonnaIcon';

const MessageAvatar = ({ url, name, isAssistant, isAdmin, isMine, onClick, size = 'w-8 h-8' }) => {
  // 1. Assistant (La Nonna AI)
  if (isAssistant && !url) {
    return (
      <button onClick={onClick} className={`shrink-0 mt-1 group ${onClick ? '' : 'cursor-default'}`} title="La Nonna (AI)">
        <div className={`${size} rounded-full flex items-center justify-center shadow-sm bg-pink-500/10 text-pink-500 border border-pink-200 dark:border-pink-900 group-hover:scale-105 transition-transform overflow-hidden`}>
          <NonnaIcon size={26} className="scale-125" />
        </div>
      </button>
    );
  }

  // 2. Admin (Delivery Local)
  if (isAdmin && !url) {
    return (
      <button onClick={onClick} className={`shrink-0 mt-1 group ${onClick ? '' : 'cursor-default'}`} title={name}>
        <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors`}>
          <span className="text-white text-xs font-bold">{name?.[0]?.toUpperCase() || 'L'}</span>
        </div>
      </button>
    );
  }

  // 3. Me (Current User) without avatar
  if (isMine && !url) {
    return (
      <button onClick={onClick} className={`shrink-0 mt-1 group ${onClick ? '' : 'cursor-default'}`} title={name}>
        <div className={`${size} rounded-full flex items-center justify-center text-sm font-bold shadow-sm bg-matrix-green/20 text-matrix-green border border-matrix-green/30 group-hover:border-matrix-green/50 transition-colors`}>
          {name?.[0]?.toUpperCase() || 'M'}
        </div>
      </button>
    );
  }

  // 4. Default / Provided URL
  return (
    <button onClick={onClick} className={`shrink-0 mt-1 group ${onClick ? '' : 'cursor-default'}`} title={name}>
      {url ? (
        <img
          src={url}
          alt={name}
          className={`${size} rounded-full object-cover border border-light-border/50 dark:border-dark-border/50 shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors`}
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div
        className={`${size} rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors`}
        style={{ display: url ? 'none' : 'flex' }}
      >
        {name ? (
          <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-xs font-bold">{name[0].toUpperCase()}</span>
        ) : (
          <UserCircle2 className="text-light-text-tertiary dark:text-dark-text-tertiary w-5 h-5" />
        )}
      </div>
    </button>
  );
};

export default MessageAvatar;
