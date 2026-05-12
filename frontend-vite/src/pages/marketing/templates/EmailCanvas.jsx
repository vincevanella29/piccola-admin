// EmailCanvas.jsx — Sortable block canvas with toolbar
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BlockRenderer from './BlockRenderer';
import { BLOCK_TYPES, createBlock } from './blockCompiler';

const BlockToolbar = ({ onAdd }) => (
  <div className="flex flex-wrap gap-1 mb-2 p-2 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl border border-light-border/5 dark:border-dark-border/5">
    {BLOCK_TYPES.map(bt => (
      <button key={bt.type} onClick={() => onAdd(bt.type)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:border-matrix-green/30 hover:text-matrix-green transition-all">
        <span>{bt.icon}</span> {bt.label}
      </button>
    ))}
  </div>
);

const EmailCanvas = ({ blocks, onBlocksChange, onAddBlock }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'email-canvas' });
  const blockIds = blocks.map(b => b.id);

  const addBlock = (type) => {
    // Delegate to parent for product types (opens modal), handle rest locally
    if (onAddBlock) { onAddBlock(type); return; }
    onBlocksChange([...blocks, createBlock(type)]);
  };

  const updateBlock = (id, newData) => onBlocksChange(blocks.map(b => b.id === id ? { ...b, data: newData } : b));
  const deleteBlock = (id) => onBlocksChange(blocks.filter(b => b.id !== id));
  const duplicateBlock = (block) => {
    const idx = blocks.findIndex(b => b.id === block.id);
    const next = [...blocks];
    next.splice(idx + 1, 0, createBlock(block.type, { ...block.data }));
    onBlocksChange(next);
  };

  return (
    <div className="flex flex-col h-full">
      <BlockToolbar onAdd={addBlock} />
      <div ref={setNodeRef}
        className={`flex-1 min-h-[300px] p-2 rounded-xl border-2 border-dashed transition-colors ${
          isOver ? 'border-matrix-green/50 bg-matrix-green/5' : 'border-light-border/10 dark:border-dark-border/10'
        }`}>
        {blocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-16 opacity-40">
            <span className="text-3xl mb-2">📧</span>
            <p className="text-xs font-bold text-light-text-tertiary">Agrega bloques con la toolbar</p>
          </div>
        ) : (
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            {blocks.map(block => (
              <BlockRenderer key={block.id} block={block}
                onUpdate={updateBlock} onDelete={deleteBlock} onDuplicate={duplicateBlock} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
};

export default EmailCanvas;
