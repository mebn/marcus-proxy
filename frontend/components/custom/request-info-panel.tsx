import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatBytes, formatHeaders, type TrafficEntry } from "./proxy-data";

type RequestInfoPanelProps = {
  entry: TrafficEntry | null;
  height?: number;
  placement?: "bottom" | "right";
  width?: number;
  onClose: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
};

type DetailBlockProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
};

export function RequestInfoPanel({
  entry,
  height,
  placement = "bottom",
  onClose,
  onResizeStart,
  width,
}: RequestInfoPanelProps) {
  const isBottom = placement === "bottom";
  return (
    <aside
      className={[
        "relative flex shrink-0 flex-col bg-card text-card-foreground shadow-lg",
        isBottom ? "w-full border-t" : "min-w-0 border-l",
      ].join(" ")}
      style={isBottom ? { height } : { width }}
    >
      <div
        className={[
          "flex items-center justify-between gap-2 p-3",
          isBottom ? "cursor-row-resize" : "",
        ].join(" ")}
        onPointerDown={isBottom ? onResizeStart : undefined}
      >
        <div className="min-w-0 truncate text-sm font-semibold">Request</div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Close request details"
        >
          <X className="size-3" />
        </Button>
      </div>
      {entry ? (
        <SelectedRequest entry={entry} placement={placement} />
      ) : (
        <EmptyDetails />
      )}

      {!isBottom ? (
        <div
          className="absolute top-0 left-[-3px] z-20 h-full w-1.5 cursor-col-resize"
          onPointerDown={onResizeStart}
        />
      ) : null}
    </aside>
  );
}

function SelectedRequest({
  entry,
  placement,
}: {
  entry: TrafficEntry;
  placement: "bottom" | "right";
}) {
  const compactInfo = placement === "right";
  return (
    <div
      className={[
        "grid min-h-0 overflow-auto p-4",
        placement === "bottom" ? "gap-2" : "gap-0",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid min-w-0 content-start gap-2 text-sm">
        <DetailBlock title="Info" defaultOpen>
          <div className="grid gap-2 p-2">
            <InfoBox
              compact={compactInfo}
              label="Summary"
              value={`${entry.isConnect ? "CONNECT" : entry.method} ${entry.status || "-"}`}
            />
            <InfoBox
              compact={compactInfo}
              label="URL"
              value={entry.url || "-"}
            />
            <InfoBox
              compact={compactInfo}
              label="Host"
              value={entry.host || "-"}
            />
            <InfoBox
              compact={compactInfo}
              label="Client"
              value={entry.client || "-"}
            />

            <div className="grid grid-cols-2 gap-2">
              <InfoBox
                compact={compactInfo}
                label="Response"
                value={formatBytes(entry.bytes)}
              />
              <InfoBox
                compact={compactInfo}
                label="Duration"
                value={`${entry.durationMs} ms`}
              />
            </div>
          </div>
        </DetailBlock>

        {entry.error ? (
          <DetailBlock title="Error" defaultOpen>
            <pre className="max-h-28 overflow-auto p-3 text-xs whitespace-pre-wrap">
              {entry.error}
            </pre>
          </DetailBlock>
        ) : null}

        <DetailBlock title="Request Headers" defaultOpen>
          <DetailPre>{formatHeaders(entry.requestHeaders)}</DetailPre>
        </DetailBlock>

        <DetailBlock title="Request Body">
          <DetailPre>
            {bodyText(entry.requestBody, entry.requestBodyTruncated)}
          </DetailPre>
        </DetailBlock>

        <DetailBlock title="Response Headers" defaultOpen>
          <DetailPre>{formatHeaders(entry.responseHeaders)}</DetailPre>
        </DetailBlock>

        <DetailBlock title="Response Body">
          <DetailPre>
            {bodyText(entry.responseBody, entry.responseBodyTruncated)}
          </DetailPre>
        </DetailBlock>
      </div>
    </div>
  );
}

function DetailBlock({
  children,
  defaultOpen = false,
  title,
}: DetailBlockProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="min-w-0 overflow-hidden border"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-9 w-full justify-between rounded-none px-3"
        >
          <span className="truncate text-xs font-medium">{title}</span>
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="min-w-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function DetailPre({ children }: { children: ReactNode }) {
  return (
    <pre className="max-h-44 max-w-full select-text overflow-auto p-3 text-xs whitespace-pre">
      {children}
    </pre>
  );
}

function EmptyDetails() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Select request row to show body, headers, timing, and errors.
    </div>
  );
}

function InfoBox({
  compact = false,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={compact ? "px-2 pt-1 pb-0" : "p-2"}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  );
}

function bodyText(value: string | undefined, truncated: boolean) {
  return `${value || "-"}${truncated ? "\n\n[truncated]" : ""}`;
}
