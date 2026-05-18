import React from 'react';
import MessageText from '../MessageText';
import ProductListPayload from './payloads/ProductListPayload';
import ProductPayload from './payloads/ProductPayload';
import DataTablePayload from './payloads/DataTablePayload';
import HistoryTimelinePayload from './payloads/HistoryTimelinePayload';
import ClubSectionPayload from './payloads/ClubSectionPayload';
import LocationListPayload from './payloads/LocationListPayload';
import LocationPayload from './payloads/LocationPayload';

const MessageContent = ({ msg, onRowClick }) => {
  const type = msg?.payload?.type;
  
  // 1. Plain Text Message
  if (!type || type === 'text') {
    return <MessageText text={msg.text} />;
  }

  // 2. Structured Payloads
  return (
    <div className="flex flex-col gap-2 mt-1 w-full min-w-0 max-w-full">
      {msg.text && msg.text !== '(respuesta estructurada)' && <MessageText text={msg.text} />}
      
      {type === 'product_list' && <ProductListPayload {...msg.payload} />}
      {type === 'product_card' && (
        <div className="flex flex-col gap-3 w-full">
          <ProductPayload product={msg.payload?.product || msg.payload} recipe={msg.payload?.recipe} onClick={() => onRowClick?.(msg.payload?.product || msg.payload, msg.payload)} />
          {msg.payload?.assistant_text && (
            <div className="px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <MessageText text={msg.payload.assistant_text} />
            </div>
          )}
        </div>
      )}
      {type === 'data_table' && <DataTablePayload {...msg.payload} onRowClick={onRowClick} />}
      {type === 'history_timeline' && <HistoryTimelinePayload payload={msg.payload} />}
      {type === 'club_section' && <ClubSectionPayload payload={msg.payload} />}
      {type === 'location_list' && <LocationListPayload {...msg.payload} />}
      {type === 'location_card' && <LocationPayload location={msg.payload?.location || msg.payload} />}
      {type === 'delivery_link' && <LocationPayload location={msg.payload} isDeliveryLink={true} />}
      {type === 'text_block_list' && Array.isArray(msg.payload?.lines) && (
        <div className="flex flex-col gap-1.5 mt-2">
          {msg.payload.lines.map((line, idx) => (
            <MessageText key={idx} text={line} />
          ))}
        </div>
      )}
      
      {/* Fallback for unknown types */}
      {!['text', 'product_list', 'product_card', 'data_table', 'history_timeline', 'club_section', 'location_list', 'location_card', 'delivery_link', 'text_block_list'].includes(type) && (
        <div className="text-[11px] opacity-60 italic px-2 py-1 bg-black/5 rounded">
          {msg.text ? null : `Contenido no soportado (${type})`}
        </div>
      )}
    </div>
  );
};

export default MessageContent;
