import React from 'react';
import { Search, X } from 'lucide-react';

export default function EventFilters({
  searchInput, setSearchInput,
  statusFilter, endpointFilter, eventTypeFilter, timeRangeFilter, sortOrder,
  endpoints, eventTypes,
  onFilterChange, onClearFilters
}) {
  const hasActiveFilters = statusFilter || endpointFilter || eventTypeFilter || timeRangeFilter !== 'All' || searchInput || sortOrder !== 'desc';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center flex-wrap">
      <div className="flex-1 min-w-[200px] relative">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search Event ID, Request ID, Type..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onFilterChange('status', e.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text"
      >
        <option value="">All Statuses</option>
        <option value="processed">Successful</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
        <option value="retry_exhausted">Dead Lettered</option>
      </select>

      <select
        value={endpointFilter}
        onChange={(e) => onFilterChange('endpoint', e.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text max-w-[200px]"
      >
        <option value="">All Endpoints</option>
        {endpoints.map(ep => (
          <option key={ep._id} value={ep._id}>
            {new URL(ep.destinationUrl).hostname}
          </option>
        ))}
      </select>

      <select
        value={eventTypeFilter}
        onChange={(e) => onFilterChange('eventType', e.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text max-w-[200px]"
      >
        <option value="">All Event Types</option>
        {eventTypes.map(et => (
          <option key={et} value={et}>{et}</option>
        ))}
      </select>

      <select
        value={timeRangeFilter}
        onChange={(e) => onFilterChange('timeRange', e.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text"
      >
        <option value="All">All Time</option>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
      </select>

      <select
        value={sortOrder}
        onChange={(e) => onFilterChange('sortOrder', e.target.value)}
        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text"
      >
        <option value="desc">Newest First</option>
        <option value="asc">Oldest First</option>
      </select>

      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-2 rounded-lg font-medium"
        >
          <X className="w-3.5 h-3.5" />
          Clear Filters
        </button>
      )}
    </div>
  );
}
