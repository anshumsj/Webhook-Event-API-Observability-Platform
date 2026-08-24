import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';

const TrendChart = ({ data, timeRange }) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.totalDeliveries), 5);
  
  // Use a fixed viewBox coordinate system, allowing non-scaling-stroke to handle responsiveness
  const chartWidth = 1000;
  const chartHeight = 240;

  const getX = (index) => (index / Math.max(data.length - 1, 1)) * chartWidth;
  const getY = (val) => chartHeight - (val / maxTotal) * chartHeight;

  const generatePath = (key) => {
    return data.map((d, i) => {
      const command = i === 0 ? 'M' : 'L';
      return `${command} ${getX(i)},${getY(d[key])}`;
    }).join(' ');
  };

  const totalPath = generatePath('totalDeliveries');
  const successPath = generatePath('successfulDeliveries');
  const failPath = generatePath('failedDeliveries');

  // Format date helper for tooltip
  const formatTooltipDate = (ts) => {
    const d = parseISO(ts);
    if (timeRange === '24h') {
      return format(d, 'MMM d, h:mm a');
    }
    return format(d, 'MMM d, yyyy');
  };

  const formatXAxisDate = (ts) => {
    const d = parseISO(ts);
    if (timeRange === '24h') {
      return format(d, 'ha');
    }
    return format(d, 'MMM d');
  };

  return (
    <div className="relative w-full h-80 bg-surface border border-border rounded-xl p-6 pt-8 pb-10 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-text">Delivery Activity</h3>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            Total
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Successful
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            Failed
          </div>
        </div>
      </div>
      
      <div className="relative flex-1 w-full min-h-[200px]">
        {/* Background Grid */}
        <div className="absolute inset-0 flex flex-col justify-between z-0 pointer-events-none opacity-20">
          {[...Array(5)].map((_, i) => (
             <div key={i} className="w-full border-b border-muted"></div>
          ))}
        </div>
        
        {/* Y Axis Labels */}
        <div className="absolute left-0 inset-y-0 flex flex-col justify-between z-0 pointer-events-none -ml-4 py-[1px]">
          <span className="text-[10px] text-muted -translate-y-1/2">{maxTotal}</span>
          <span className="text-[10px] text-muted translate-y-1/2">0</span>
        </div>

        {/* The SVG lines */}
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          preserveAspectRatio="none" 
          className="absolute inset-0 w-full h-full z-10 overflow-visible pointer-events-none"
        >
          <path d={totalPath} fill="none" stroke="currentColor" className="text-indigo-500/80" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={successPath} fill="none" stroke="currentColor" className="text-emerald-500/90" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={failPath} fill="none" stroke="currentColor" className="text-rose-500/90" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          
          {/* Render points for hover state */}
          {hoverIndex !== null && (
            <g>
              <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].totalDeliveries)} r="4" fill="currentColor" className="text-indigo-400 shadow-xl" />
              <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].successfulDeliveries)} r="4" fill="currentColor" className="text-emerald-400 shadow-xl" />
              <circle cx={getX(hoverIndex)} cy={getY(data[hoverIndex].failedDeliveries)} r="4" fill="currentColor" className="text-rose-400 shadow-xl" />
            </g>
          )}
        </svg>

        {/* Hover interaction columns */}
        <div className="absolute inset-0 flex z-20">
          {data.map((d, i) => (
            <div 
              key={i} 
              className="flex-1 h-full relative group cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Vertical guideline */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-1/2 pointer-events-none" />
              
              {/* Tooltip */}
              {hoverIndex === i && (
                <div className={`absolute top-0 transform -translate-y-4 ${i > data.length / 2 ? 'right-1/2 mr-2' : 'left-1/2 ml-2'} min-w-[200px] z-50 bg-surface/95 backdrop-blur border border-border rounded-lg shadow-xl p-3 text-xs font-medium text-text pointer-events-none`}>
                  <div className="text-muted border-b border-border pb-2 mb-2 font-mono">
                    {formatTooltipDate(d.timestamp)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Total</span>
                      <span>{d.totalDeliveries}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400">Successful</span>
                      <span>{d.successfulDeliveries}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-rose-400">Failed</span>
                      <span>{d.failedDeliveries}</span>
                    </div>
                    {(d.retriedDeliveries > 0 || d.deadLettered > 0) && (
                      <div className="border-t border-border mt-1.5 pt-1.5 space-y-1.5">
                         {d.retriedDeliveries > 0 && (
                           <div className="flex justify-between items-center text-amber-400/90">
                             <span>Retried Events</span>
                             <span>{d.retriedDeliveries}</span>
                           </div>
                         )}
                         {d.deadLettered > 0 && (
                           <div className="flex justify-between items-center text-rose-500 font-semibold">
                             <span>Dead Lettered</span>
                             <span>{d.deadLettered}</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* X Axis Labels */}
      <div className="relative mt-2 h-4 w-full flex justify-between text-[10px] text-muted font-mono px-[2%]">
         {data.map((d, i) => {
           // Display about 6 labels evenly spaced
           const step = Math.max(1, Math.floor(data.length / 6));
           if (i === 0 || i === data.length - 1 || i % step === 0) {
             return (
               <div key={i} className="absolute transform -translate-x-1/2 text-center" style={{ left: `${(i / Math.max(data.length - 1, 1)) * 100}%` }}>
                 {formatXAxisDate(d.timestamp)}
               </div>
             );
           }
           return null;
         })}
      </div>
    </div>
  );
};

export default TrendChart;
