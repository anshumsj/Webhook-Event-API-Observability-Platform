import React from 'react';
import { Search, X } from 'lucide-react';

export default function EventFilters({
  searchInput,
  setSearchInput,
  statusFilter,
  endpointFilter,
  eventTypeFilter,
  timeRangeFilter,
  sortOrder,
  endpoints,
  eventTypes,
  onFilterChange,
  onClearFilters,
}) {
  const hasActiveFilters = Boolean(
    statusFilter ||
    endpointFilter ||
    eventTypeFilter ||
    timeRangeFilter !== 'All' ||
    searchInput ||
    sortOrder !== 'desc'
  );

  return (
    <div className="bg-surface-1 border border-border rounded p-2 flex flex-wrap lg:flex-nowrap items-center gap-2 text-xs">
      {/* Search Input */}
      <div className="flex-1 min-w-[200px] relative">
        <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Filter by Event ID, Request ID, Type..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-8 pr-3 h-[30px] bg-canvas border border-border rounded text-xs text-text placeholder:text-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 transition-colors font-sans"
        />
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onFilterChange('status', e.target.value)}
        className="h-[30px] px-2.5 bg-canvas border border-border rounded text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 cursor-pointer font-sans"
      >
        <option value="">All Statuses</option>
        <option value="processed">Delivered</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
        <option value="retry_exhausted">Dead Lettered</option>
      </select>

      {/* Endpoint Filter */}
      <select
        value={endpointFilter}
        onChange={(e) => onFilterChange('endpoint', e.target.value)}
        className="h-[30px] px-2.5 bg-canvas border border-border rounded text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 max-w-[180px] truncate cursor-pointer font-sans"
      >
        <option value="">All Endpoints</option>
        {endpoints &&
          endpoints.map((ep) => {
            let hostname = ep.endpointId;
            if (ep.destinationUrl) {
              try {
                hostname = new URL(ep.destinationUrl).host;
              } catch {
                hostname = ep.destinationUrl;
              }
            }
            return (
              <option key={ep._id} value={ep.endpointId}>
                {hostname}
              </option>
            );
          })}
      </select>

      {/* Event Type Filter */}
      <select
        value={eventTypeFilter}
        onChange={(e) => onFilterChange('eventType', e.target.value)}
        className="h-[30px] px-2.5 bg-canvas border border-border rounded text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 max-w-[160px] truncate cursor-pointer font-sans"
      >
        <option value="">All Types</option>
        {eventTypes.map((et) => (
          <option key={et} value={et}>
            {et}
          </option>
        ))}
      </select>

      {/* Time Range Filter */}
      <select
        value={timeRangeFilter}
        onChange={(e) => onFilterChange('timeRange', e.target.value)}
        className="h-[30px] px-2.5 bg-canvas border border-border rounded text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 cursor-pointer font-sans"
      >
        <option value="All">All Time</option>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
      </select>

      {/* Sort Order */}
      <select
        value={sortOrder}
        onChange={(e) => onFilterChange('sortOrder', e.target.value)}
        className="h-[30px] px-2.5 bg-canvas border border-border rounded text-xs text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 cursor-pointer font-sans"
      >
        <option value="desc">Newest First</option>
        <option value="asc">Oldest First</option>
      </select>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 h-[30px] px-2.5 bg-surface-2 border border-border rounded text-xs text-muted hover:text-text hover:border-border-strong transition-colors font-mono shrink-0"
          title="Reset all active filters"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}
