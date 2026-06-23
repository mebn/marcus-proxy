import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel, usePanelShortcut } from "./panel";
import { formatBytes, formatHeaders, type TrafficEntry } from "./proxy-data";

export type RequestEditMode =
  | "view"
  | "edit-request"
  | "edit-response"
  | "resend-request";

type RequestInfoPanelProps = {
  editMode?: RequestEditMode;
  entry: TrafficEntry | null;
  height?: number;
  open: boolean;
  placement?: "bottom" | "right";
  width?: number;
  active?: boolean;
  onChange?: (entry: TrafficEntry) => void;
  onActivate?: () => void;
  onContinue?: () => void;
  onOpenChange: (open: boolean) => void;
  onSizeChange: (size: number) => void;
};

type DetailBlockProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
};

export function RequestInfoPanel({
  editMode = "view",
  entry,
  height,
  open,
  placement = "bottom",
  active = true,
  onChange,
  onActivate,
  onContinue,
  onOpenChange,
  onSizeChange,
  width,
}: RequestInfoPanelProps) {
  usePanelShortcut({
    active,
    key: placement === "bottom" ? "b" : "r",
    open,
    onActivate,
    onOpenChange,
  });

  if (!open || !active) return null;

  return (
    <Panel
      actions={
        onContinue ? (
          <Button
            size="sm"
            onClick={onContinue}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {editMode === "resend-request" ? "Send" : "Continue"}
          </Button>
        ) : null
      }
      closeLabel="Close request details"
      height={height}
      placement={placement}
      subtitle={modeLabel(editMode, entry)}
      title="Request"
      width={width}
      onClose={() => onOpenChange(false)}
      onSizeChange={onSizeChange}
    >
      {entry ? (
        <SelectedRequest
          editMode={editMode}
          entry={entry}
          onChange={onChange}
          placement={placement}
        />
      ) : (
        <EmptyDetails />
      )}
    </Panel>
  );
}

function SelectedRequest({
  editMode,
  entry,
  onChange,
  placement,
}: {
  editMode: RequestEditMode;
  entry: TrafficEntry;
  onChange?: (entry: TrafficEntry) => void;
  placement: "bottom" | "right";
}) {
  const requestEditable =
    editMode === "edit-request" || editMode === "resend-request";
  const responseEditable = editMode === "edit-response";
  const update = (patch: Partial<TrafficEntry>) =>
    onChange?.({ ...entry, ...patch });

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
          <div className="grid gap-1 p-2 text-xs">
            {requestEditable || responseEditable ? (
              <>
                <InfoBox
                  editable={requestEditable}
                  label="Method"
                  value={entry.isConnect ? "CONNECT" : entry.method || ""}
                  onChange={(method) =>
                    update({ method, isConnect: method === "CONNECT" })
                  }
                />
                <InfoBox
                  editable={responseEditable}
                  label="Status"
                  value={entry.status ? String(entry.status) : ""}
                  onChange={(value) => update({ status: Number(value) || 0 })}
                />
              </>
            ) : (
              <InfoBox
                label="Summary"
                value={`${entry.isConnect ? "CONNECT" : entry.method} ${entry.status || "-"}`}
              />
            )}
            <InfoBox
              editable={requestEditable}
              label="URL"
              value={entry.url || ""}
              onChange={(url) => update({ url })}
            />
            <InfoBox
              editable={requestEditable}
              label="Host"
              value={entry.host || ""}
              onChange={(host) => update({ host })}
            />
            <InfoBox label="Client" value={entry.client || "-"} />
            <InfoBox label="Response" value={formatBytes(entry.bytes)} />
            <InfoBox label="Duration" value={`${entry.durationMs} ms`} />
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
          <DetailText
            editable={requestEditable}
            value={headersText(entry.requestHeaders)}
            onChange={(value) =>
              update({ requestHeaders: parseHeaders(value) })
            }
          />
        </DetailBlock>

        <DetailBlock title="Request Body">
          <DetailText
            editable={requestEditable}
            value={bodyText(entry.requestBody, entry.requestBodyTruncated)}
            onChange={(requestBody) => update({ requestBody })}
          />
        </DetailBlock>

        <DetailBlock title="Response Headers" defaultOpen>
          <DetailText
            editable={responseEditable}
            value={headersText(entry.responseHeaders)}
            onChange={(value) =>
              update({ responseHeaders: parseHeaders(value) })
            }
          />
        </DetailBlock>

        <DetailBlock title="Response Body">
          <DetailText
            editable={responseEditable}
            value={bodyText(entry.responseBody, entry.responseBodyTruncated)}
            onChange={(responseBody) => update({ responseBody })}
          />
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

function DetailText({
  editable,
  onChange,
  value,
}: {
  editable: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  if (editable) {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-h-44 min-h-24 resize-y rounded-none border-0 text-xs font-mono whitespace-pre"
      />
    );
  }

  return (
    <pre className="max-h-44 max-w-full select-text overflow-auto p-3 text-xs whitespace-pre">
      {value}
    </pre>
  );
}

function EmptyDetails() {
  return <div></div>;
}

function InfoBox({
  editable = false,
  label,
  onChange,
  value,
}: {
  editable?: boolean;
  label: string;
  onChange?: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex min-w-0 select-text gap-1 px-1 py-0.5 leading-snug">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      {editable ? (
        <Input
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="h-5 min-w-0 border-0 px-1 py-0 text-xs shadow-none"
        />
      ) : (
        <span className="min-w-0 break-all">{value || "-"}</span>
      )}
    </div>
  );
}

function bodyText(value: string | undefined, truncated: boolean) {
  return `${value || ""}${truncated ? "\n\n[truncated]" : ""}`;
}

function headersText(headers: Record<string, string[]> | undefined) {
  if (!headers || Object.keys(headers).length === 0) return "";
  return formatHeaders(headers);
}

function parseHeaders(value: string): Record<string, string[]> {
  const headers: Record<string, string[]> = {};
  for (const line of value.split("\n")) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const headerValue = line.slice(index + 1).trim();
    if (!key) continue;
    headers[key] = headerValue
      ? headerValue.split(",").map((item) => item.trim())
      : [""];
  }
  return headers;
}

function modeLabel(mode: RequestEditMode, entry: TrafficEntry | null) {
  if (mode === "edit-request") return "Editing paused request";
  if (mode === "edit-response") return "Editing paused response";
  if (mode === "resend-request") return "Editing request to resend";
  if (entry?.interceptPhase === "request") return "Viewing paused request";
  if (entry?.interceptPhase === "response") return "Viewing paused response";
  return "Viewing request and response";
}
