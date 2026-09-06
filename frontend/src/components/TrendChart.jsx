import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';

const TrendChart = ({ data, timeRange }) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.totalDeliveries), 5);

  // Fixed viewBox coordinate system with non-scaling-stroke for responsiveness
  const chartWidth = 1000;
  const chartHeight = 220;

  const getX = (index) => (index / Math.max(data.length - 1, 1)) * chartWidth;
  const getY = (val) => chartHeight - (val / maxTotal) * chartHeight;

  const generatePath = (key) => {
    return data
      .map((d, i) => {
        const command = i === 0 ? 'M' : 'L';
        return `${command} ${getX(i)},${getY(d[key])}`;
      })
      .join(' ');
  };

  const totalPath = generatePath('totalDeliveries');
  const successPath = generatePath('successfulDeliveries');
  const failPath = generatePath('failedDeliveries');

  const formatTooltipDate = (ts) => {
    const d = parseISO(ts);
    if (timeRange === '24h') {
      return format(d, 'MMM d, HH:mm');
    }
    return format(d, 'MMM d, yyyy');
  };

  const formatXAxisDate = (ts) => {
    const d = parseISO(ts);
    if (timeRange === '24h') {
      return format(d, 'HH:mm');
    }
    return format(d, 'MMM d');
  };

  return (
    <div className="w-full bg-surface-1 border border-border rounded p-4 sm:p-5 flex flex-col">
      {/* Chart Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-text">
            Delivery Throughput & Trends
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Real-time webhook ingestion and forwarding over the selected period
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono select-none">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2.5 h-0.5 bg-primary rounded-full" />
            <span>Total</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2.5 h-0.5 bg-success rounded-full" />
            <span>Success</span>
          </div>
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-2.5 h-0.5 bg-failure rounded-full" />
            <span>Failed</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative w-full h-56">
        {/* Horizontal Background Grid */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-25">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full border-b border-border/70" />
          ))}
        </div>

        {/* Y Axis Labels */}
        <div className="absolute left-0 inset-y-0 flex flex-col justify-between pointer-events-none -ml-1 py-0.5 font-mono text-[10px] text-muted select-none">
          <span className="-translate-y-1/2">{maxTotal}</span>
          <span>{Math.round(maxTotal / 2)}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        {/* SVG Paths */}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
        >
          {/* Total line */}
          <path
            d={totalPath}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
          />

          {/* Success line */}
          <path
            d={successPath}
            fill="none"
            stroke="currentColor"
            className="text-success"
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
          />

          {/* Failed line */}
          <path
            d={failPath}
            fill="none"
            stroke="currentColor"
            className="text-failure"
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
          />

          {/* Render points for hover state */}
          {hoverIndex !== null && (
            <g>
              <circle
                cx={getX(hoverIndex)}
                cy={getY(data[hoverIndex].totalDeliveries)}
                r="3.5"
                fill="currentColor"
                className="text-primary"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(data[hoverIndex].successfulDeliveries)}
                r="3.5"
                fill="currentColor"
                className="text-success"
              />
              {data[hoverIndex].failedDeliveries > 0 && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(data[hoverIndex].failedDeliveries)}
                  r="3.5"
                  fill="currentColor"
                  className="text-failure"
                />
              )}
            </g>
          )}
        </svg>

        {/* Hover interaction columns */}
        <div className="absolute inset-0 flex z-20">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 h-full relative cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Vertical guideline */}
              {hoverIndex === i && (
                <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong border-l border-dashed border-muted pointer-events-none -translate-x-1/2" />
              )}

              {/* High-density Telemetry Tooltip */}
              {hoverIndex === i && (
                <div
                  className={`absolute top-0 -translate-y-2 ${
                    i > data.length / 2 ? 'right-full mr-3' : 'left-full ml-3'
                  } min-w-[210px] z-50 bg-surface-2 border border-border-strong rounded p-2.5 text-xs font-mono text-text shadow-2xl pointer-events-none select-none`}
                >
                  <div className="text-muted border-b border-border/70 pb-1.5 mb-2 font-semibold text-[11px]">
                    {formatTooltipDate(d.timestamp)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span className="text-muted">Total Events:</span>
                      <span className="font-semibold text-text">
                        {d.totalDeliveries}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-success">
                      <span>Successful:</span>
                      <span className="font-semibold">
                        {d.successfulDeliveries}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-failure">
                      <span>Failed:</span>
                      <span className="font-semibold">
                        {d.failedDeliveries}
                      </span>
                    </div>

                    {(d.retriedDeliveries > 0 || d.deadLettered > 0) && (
                      <div className="border-t border-border/70 mt-1.5 pt-1.5 space-y-1">
                        {d.retriedDeliveries > 0 && (
                          <div className="flex justify-between items-center text-warning">
                            <span>Retries:</span>
                            <span>{d.retriedDeliveries}</span>
                          </div>
                        )}
                        {d.deadLettered > 0 && (
                          <div className="flex justify-between items-center text-failure font-bold">
                            <span>Dead Lettered:</span>
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

      {/* X Axis Timestamps */}
      <div className="relative mt-3 h-4 w-full flex justify-between text-[10px] text-muted font-mono px-1 select-none">
        {data.map((d, i) => {
          const step = Math.max(1, Math.floor(data.length / 6));
          if (i === 0 || i === data.length - 1 || i % step === 0) {
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 text-center"
                style={{
                  left: `${(i / Math.max(data.length - 1, 1)) * 100}%`,
                }}
              >
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
