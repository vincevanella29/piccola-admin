import React from 'react';

const NonnaIcon = ({ className = '', size = 24 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </radialGradient>
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>
          {`
            .pulse { animation: pulse 2s infinite alternate ease-in-out; }
            .flow { animation: flow 3s infinite linear; stroke-dasharray: 10 5; }
            .node { transform-origin: center; animation: scale 1.5s infinite alternate ease-in-out; }
            @keyframes pulse { 0% { opacity: 0.7; } 100% { opacity: 1; filter: drop-shadow(0 0 8px #ec4899); } }
            @keyframes flow { 0% { stroke-dashoffset: 15; } 100% { stroke-dashoffset: 0; } }
            @keyframes scale { 0% { transform: scale(0.9); } 100% { transform: scale(1.1); } }
          `}
        </style>
      </defs>

      {/* Background Glow */}
      <circle cx="50" cy="50" r="45" fill="url(#glow)" />

      <g className="pulse" stroke="#ec4899" filter="url(#neon)">
        {/* Central Core / Brain */}
        <circle cx="50" cy="50" r="8" fill="#ec4899" className="node" style={{ animationDelay: '0s' }} />

        {/* Neural Pathways (Tree Branches) */}
        <path d="M50 42 C 50 30, 35 25, 30 15" className="flow" />
        <path d="M50 42 C 50 25, 65 30, 75 15" className="flow" />
        <path d="M42 50 C 25 50, 30 65, 15 70" className="flow" />
        <path d="M58 50 C 70 50, 70 65, 85 70" className="flow" />
        <path d="M50 58 C 50 75, 40 75, 35 85" className="flow" />
        <path d="M50 58 C 50 75, 65 75, 75 85" className="flow" />

        {/* Synapse Nodes */}
        <circle cx="30" cy="15" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '0.2s' }} />
        <circle cx="75" cy="15" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '0.4s' }} />
        <circle cx="15" cy="70" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '0.6s' }} />
        <circle cx="85" cy="70" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '0.8s' }} />
        <circle cx="35" cy="85" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '1.0s' }} />
        <circle cx="75" cy="85" r="4" fill="#fbcfe8" className="node" style={{ animationDelay: '1.2s' }} />

        {/* Interconnections */}
        <path d="M30 15 C 40 20, 50 15, 75 15" className="flow" style={{ opacity: 0.3 }} />
        <path d="M15 70 C 25 70, 30 85, 35 85" className="flow" style={{ opacity: 0.3 }} />
        <path d="M85 70 C 80 80, 80 85, 75 85" className="flow" style={{ opacity: 0.3 }} />
      </g>
    </svg>
  );
};

export default NonnaIcon;
