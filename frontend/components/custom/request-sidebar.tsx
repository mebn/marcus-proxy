import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HostStat, TrafficEntry } from "./proxy-data";

type RequestSidebarProps = {
  entriesCount: number;
  hostFilter: string | null;
  hostStats: HostStat[];
  pinnedEntries: TrafficEntry[];
  selectedID: number | null;
  width: number;
  onClose: () => void;
  onHostFilter: (host: string | null) => void;
  onOpen: (entry: TrafficEntry) => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onUnpin: (id: number) => void;
};

type PinnedRequestsProps = {
  entries: TrafficEntry[];
  selectedID: number | null;
  onOpen: (entry: TrafficEntry) => void;
  onUnpin: (id: number) => void;
};

type HostFiltersProps = {
  count: number;
  hostFilter: string | null;
  hostStats: HostStat[];
  onHostFilter: (host: string | null) => void;
};

type HostButtonProps = {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
};

export function RequestSidebar({
  entriesCount,
  hostFilter,
  hostStats,
  pinnedEntries,
  selectedID,
  width,
  onClose,
  onHostFilter,
  onOpen,
  onResizeStart,
  onUnpin,
}: RequestSidebarProps) {
  return (
    <aside
      className="relative flex min-w-0 shrink-0 flex-col border-l bg-card"
      style={{ width }}
    >
      <PanelHeader title="Requests" onClose={onClose} />

      <PinnedRequests
        entries={pinnedEntries}
        selectedID={selectedID}
        onOpen={onOpen}
        onUnpin={onUnpin}
      />

      <HostFilters
        count={entriesCount}
        hostFilter={hostFilter}
        hostStats={hostStats}
        onHostFilter={onHostFilter}
      />
      <div
        className="absolute top-0 left-[-3px] z-20 h-full w-1.5 cursor-col-resize"
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}

function PinnedRequests({
  entries,
  onOpen,
  onUnpin,
  selectedID,
}: PinnedRequestsProps) {
  return (
    <section className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-b p-2">
      <div className="mb-2 shrink-0 px-2 text-xs font-medium text-muted-foreground">
        Pinned
      </div>

      {entries.length === 0 ? (
        <div className="px-2 pb-1 text-xs text-muted-foreground">
          No pinned requests
        </div>
      ) : (
        <div className="min-h-0 overflow-auto">
          <div className="grid gap-1 pr-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex min-w-0 items-center gap-1 overflow-hidden"
              >
                <Button
                  variant={selectedID === entry.id ? "secondary" : "ghost"}
                  size="sm"
                  className="h-auto min-w-0 flex-1 overflow-hidden px-2 py-1 text-left"
                  onClick={() => onOpen(entry)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {entry.isConnect ? "CONNECT" : entry.method}{" "}
                      {entry.host || "(unknown)"}
                    </span>

                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.error || entry.url}
                    </span>
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onUnpin(entry.id)}
                  aria-label="Unpin request"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HostFilters({
  count,
  hostFilter,
  hostStats,
  onHostFilter,
}: HostFiltersProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col p-2">
      <div className="mb-2 shrink-0 px-2 text-xs font-medium text-muted-foreground">
        Hosts
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid gap-1 pl-1">
          <HostButton
            active={hostFilter === null}
            count={count}
            label="All"
            onClick={() => onHostFilter(null)}
          />

          {hostStats.map((item) => (
            <HostButton
              key={item.host}
              active={hostFilter === item.host}
              count={item.count}
              label={item.host}
              onClick={() => onHostFilter(item.host)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HostButton({ active, count, label, onClick }: HostButtonProps) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="h-8 min-w-0 justify-between gap-2 overflow-hidden px-2"
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
    </Button>
  );
}

function PanelHeader({
  onClose,
  title,
}: {
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b p-3">
      <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        aria-label="Close right panel"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
