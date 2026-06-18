import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatBytes, formatHeaders, type TrafficEntry } from "./proxy-data";

type RequestDetailsProps = {
  entry: TrafficEntry | null;
  height: number;
  onClose: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
};

type DetailBlockProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
};

export function RequestDetails({
  entry,
  height,
  onClose,
  onResizeStart,
}: RequestDetailsProps) {
  return (
    <aside
      className="relative flex w-full shrink-0 flex-col border-t bg-card text-card-foreground shadow-lg"
      style={{ height }}
    >
      <div
        className="flex cursor-row-resize items-start justify-between gap-3 border-b bg-muted/60 p-3"
        onPointerDown={onResizeStart}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {entry
              ? `${entry.isConnect ? "CONNECT" : entry.method} ${entry.status || "-"}`
              : "No request selected"}
          </div>

          <div className="truncate text-xs text-muted-foreground">
            {entry?.url ?? "Select table row to inspect request"}
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Close request details"
        >
          <X className="size-4" />
        </Button>
      </div>
      {entry ? <SelectedRequest entry={entry} /> : <EmptyDetails />}
    </aside>
  );
}

function SelectedRequest({ entry }: { entry: TrafficEntry }) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-2 text-sm">
        <InfoBox label="Host" value={entry.host || "-"} />
        <InfoBox label="Client" value={entry.client || "-"} />

        <div className="grid grid-cols-2 gap-2">
          <InfoBox label="Response" value={formatBytes(entry.bytes)} />
          <InfoBox label="Duration" value={`${entry.durationMs} ms`} />
        </div>

        {entry.error ? (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Error</div>
            <pre className="max-h-28 overflow-auto border p-2 text-xs whitespace-pre-wrap">
              {entry.error}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 content-start gap-2">
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

      <CollapsibleContent className="min-w-0 border-t">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailPre({ children }: { children: ReactNode }) {
  return (
    <pre className="max-h-44 max-w-full overflow-auto p-3 text-xs whitespace-pre">
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  );
}

function bodyText(value: string | undefined, truncated: boolean) {
  return `${value || "-"}${truncated ? "\n\n[truncated]" : ""}`;
}
