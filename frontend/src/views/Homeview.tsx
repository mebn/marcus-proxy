import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Square, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GetProxyStatus, StartProxy, StopProxy } from "@/wailsjs/go/app/App";
import { EventsOn } from "@/wailsjs/runtime/runtime";

type TrafficEntry = {
  id: number;
  time: string;
  method: string;
  url: string;
  host: string;
  status: number;
  bytes: number;
  durationMs: number;
  client: string;
  error?: string;
  isConnect: boolean;
  requestBytes: number;
  requestHeaders?: Record<string, string[]>;
  responseHeaders?: Record<string, string[]>;
  requestBody?: string;
  responseBody?: string;
  requestBodyTruncated: boolean;
  responseBodyTruncated: boolean;
};

type ProxyStatus = {
  running: boolean;
  address: string;
  lanUrls: string[];
  certUrls: string[];
  certPath: string;
  certFingerprint: string;
  httpsInterceptOn: boolean;
  recent: TrafficEntry[];
};

const emptyStatus: ProxyStatus = {
  running: false,
  address: "",
  lanUrls: [],
  certUrls: [],
  certPath: "",
  certFingerprint: "",
  httpsInterceptOn: false,
  recent: [],
};

const normalizeStatus = (value: Partial<ProxyStatus> | null): ProxyStatus => ({
  running: Boolean(value?.running),
  address: value?.address ?? "",
  lanUrls: value?.lanUrls ?? [],
  certUrls: value?.certUrls ?? [],
  certPath: value?.certPath ?? "",
  certFingerprint: value?.certFingerprint ?? "",
  httpsInterceptOn: Boolean(value?.httpsInterceptOn),
  recent: value?.recent ?? [],
});

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

const formatBytes = (bytes: number) => {
  if (bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatHeaders = (headers?: Record<string, string[]>) => {
  if (!headers || Object.keys(headers).length === 0) return "-";
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("\n");
};

export default function Homeview() {
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus);
  const [error, setError] = useState("");
  const [selectedID, setSelectedID] = useState<number | null>(null);

  const proxyURL = useMemo(
    () => status.lanUrls[0] ?? status.address,
    [status.address, status.lanUrls],
  );
  const certURL = useMemo(() => status.certUrls[0] ?? "", [status.certUrls]);
  const httpTraffic = useMemo(
    () => status.recent.filter((entry) => !entry.isConnect),
    [status.recent],
  );
  const tunnelCount = status.recent.length - httpTraffic.length;
  const selectedEntry = useMemo(
    () => status.recent.find((entry) => entry.id === selectedID) ?? null,
    [selectedID, status.recent],
  );

  async function refreshStatus() {
    const nextStatus = (await GetProxyStatus()) as ProxyStatus;
    setStatus(normalizeStatus(nextStatus));
  }

  async function startProxy() {
    setError("");
    try {
      const nextStatus = (await StartProxy()) as ProxyStatus;
      setStatus(normalizeStatus(nextStatus));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function stopProxy() {
    setError("");
    try {
      await StopProxy();
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refreshStatus();
    const unsubscribe = EventsOn("traffic:new", (entry: TrafficEntry) => {
      setStatus((current) => ({
        ...current,
        recent: [
          entry,
          ...(current.recent ?? []).filter((item) => item.id !== entry.id),
        ].slice(0, 500),
      }));
    });
    return unsubscribe;
  }, []);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-4 border-b pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void refreshStatus()}
                aria-label="Refresh status"
              >
                <RefreshCw className="size-4" />
              </Button>
              {status.running ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void stopProxy()}
                  aria-label="Stop proxy"
                >
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void startProxy()}
                  aria-label="Start proxy"
                >
                  <Play className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-4 border p-3">
              <div className="flex size-36 shrink-0 items-center justify-center bg-white p-2">
                {certURL ? (
                  <QRCodeSVG value={certURL} size={128} level="M" />
                ) : (
                  <div className="size-32 bg-muted" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Root CA QR</div>
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-normal">Traffic</h2>
            <span className="text-sm text-muted-foreground">
              {httpTraffic.length} HTTP requests
              {tunnelCount > 0 ? `, ${tunnelCount} tunnels` : ""}
            </span>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="min-w-0 flex-1 border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead className="w-24">Method</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-24 text-right">Status</TableHead>
                    <TableHead className="w-28 text-right">Bytes</TableHead>
                    <TableHead className="w-28 text-right">Duration</TableHead>
                    <TableHead className="w-32">Client</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.recent.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-28 text-center text-muted-foreground"
                      >
                        No traffic yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    status.recent.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer"
                        data-state={
                          selectedID === entry.id ? "selected" : undefined
                        }
                        onClick={() => setSelectedID(entry.id)}
                      >
                        <TableCell>{formatTime(entry.time)}</TableCell>
                        <TableCell>
                          {entry.isConnect ? "CONNECT" : entry.method}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">
                          {entry.host}
                        </TableCell>
                        <TableCell className="max-w-96 truncate">
                          {entry.error || entry.url}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.status || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBytes(entry.bytes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.durationMs} ms
                        </TableCell>
                        <TableCell>{entry.client}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {selectedEntry ? (
              <aside className="flex max-h-[70vh] w-full flex-col gap-4 overflow-auto border p-4 xl:w-96">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {selectedEntry.isConnect
                        ? "CONNECT"
                        : selectedEntry.method}{" "}
                      {selectedEntry.status || "-"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedEntry.url}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedID(null)}
                    aria-label="Close request details"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="border p-2">
                    <div className="text-xs text-muted-foreground">Host</div>
                    <div className="truncate">{selectedEntry.host || "-"}</div>
                  </div>
                  <div className="border p-2">
                    <div className="text-xs text-muted-foreground">Client</div>
                    <div className="truncate">
                      {selectedEntry.client || "-"}
                    </div>
                  </div>
                  <div className="border p-2">
                    <div className="text-xs text-muted-foreground">
                      Response
                    </div>
                    <div>{formatBytes(selectedEntry.bytes)}</div>
                  </div>
                  <div className="border p-2">
                    <div className="text-xs text-muted-foreground">
                      Duration
                    </div>
                    <div>{selectedEntry.durationMs} ms</div>
                  </div>
                </div>

                {selectedEntry.error ? (
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Error
                    </div>
                    <pre className="max-h-32 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                      {selectedEntry.error}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Request Headers
                  </div>
                  <pre className="max-h-40 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                    {formatHeaders(selectedEntry.requestHeaders)}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Request Body
                  </div>
                  <pre className="max-h-52 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                    {selectedEntry.requestBody || "-"}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Response Headers
                  </div>
                  <pre className="max-h-40 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                    {formatHeaders(selectedEntry.responseHeaders)}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Response Body
                  </div>
                  <pre className="max-h-52 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                    {selectedEntry.responseBody || "-"}
                  </pre>
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
