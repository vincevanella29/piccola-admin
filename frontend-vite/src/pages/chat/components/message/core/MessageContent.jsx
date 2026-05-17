import React from 'react';
import MessageText from '../MessageText';
import ProductList from '../../common/ProductList';
import ProductCard from '../../common/ProductCard';
import DataTable from '../../common/DataTable';
import HistoryTimeline from '../../common/HistoryTimeline';
import ClubSectionCard from '../../common/ClubSectionCard';
import LocationList from '../../common/LocationList';
import LocationCard from '../../common/LocationCard';

const MessageContent = ({ msg, onRowClick }) => {
  const type = msg?.payload?.type;
  
  // 1. Plain Text Message
  if (!type || type === 'text') {
    return <MessageText text={msg.text} />;
  }

  // 2. Structured Payloads
  return (
    <div className="flex flex-col gap-2 mt-1">
      {msg.text && msg.text !== '(respuesta estructurada)' && <MessageText text={msg.text} />}
      
      {type === 'product_list' && <ProductList {...msg.payload} />}
      {type === 'product_card' && (
        <div className="flex flex-col gap-3 w-full">
          <ProductCard product={msg.payload?.product || msg.payload} recipe={msg.payload?.recipe} onClick={() => onRowClick?.(msg.payload?.product || msg.payload, msg.payload)} />
          {msg.payload?.assistant_text && (
            <div className="px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
              <MessageText text={msg.payload.assistant_text} />
            </div>
          )}
        </div>
      )}
      {type === 'data_table' && <DataTable {...msg.payload} onRowClick={onRowClick} />}
      {type === 'history_timeline' && <HistoryTimeline payload={msg.payload} />}
      {type === 'club_section' && <ClubSectionCard payload={msg.payload} />}
      {type === 'location_list' && <LocationList {...msg.payload} />}
      {type === 'location_card' && <LocationCard location={msg.payload?.location || msg.payload} />}
      {type === 'delivery_link' && <LocationCard location={msg.payload} isDeliveryLink={true} />}
      {type === 'text_block_list' && Array.isArray(msg.payload?.lines) && (
        <div className="flex flex-col gap-1.5 mt-2">
          {msg.payload.lines.map((line, idx) => (
            <MessageText key={idx} text={line} />
          ))}
        </div>
      )}
      
      {/* Fallback for unknown types */}
      {!['text', 'product_list', 'product_card', 'data_table', 'history_timeline', 'club_section', 'location_list', 'location_card', 'delivery_link', 'text_block_list'].includes(type) && (
        <div className="text-xs opacity-50 italic">Contenido no soportado ({type})</div>
      )}
    </div>
  );
};

export default MessageContent;
