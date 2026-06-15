import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Square } from "lucide-react";
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
import {
  GetProxyStatus,
  StartProxy,
  StopProxy,
} from "@/wailsjs/go/app/App";
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

export default function Homeview() {
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus);
  const [error, setError] = useState("");

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
        recent: [entry, ...(current.recent ?? []).filter((item) => item.id !== entry.id)].slice(
          0,
          500,
        ),
      }));
    });
    return unsubscribe;
  }, []);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-4 border-b pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal">marcus-proxy</h1>
              <p className="text-sm text-muted-foreground">
                {status.running
                  ? `Set phone HTTP proxy to ${proxyURL}`
                  : "Proxy stopped"}
              </p>
            </div>
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

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm font-medium">
                {status.running ? "Running" : "Stopped"}
              </div>
            </div>
            <div className="border p-3">
              <div className="text-xs text-muted-foreground">Listen</div>
              <div className="truncate text-sm font-medium">{status.address || "-"}</div>
            </div>
            <div className="border p-3">
              <div className="text-xs text-muted-foreground">Phone URL</div>
              <div className="truncate text-sm font-medium">{proxyURL || "-"}</div>
            </div>
            <div className="border p-3">
              <div className="text-xs text-muted-foreground">Root CA</div>
              <div className="truncate text-sm font-medium">{certURL || "-"}</div>
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
                <div className="truncate text-sm font-medium">{certURL || "-"}</div>
              </div>
            </div>
            <div className="border p-3">
              <div className="text-xs text-muted-foreground">Fingerprint</div>
              <div className="mb-3 truncate text-sm font-medium">
                {status.certFingerprint || "-"}
              </div>
              <div className="text-xs text-muted-foreground">Certificate File</div>
              <div className="truncate text-sm font-medium">
                {status.certPath || "-"}
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

          <div className="border">
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
                    <TableRow key={entry.id}>
                      <TableCell>{formatTime(entry.time)}</TableCell>
                      <TableCell>{entry.isConnect ? "CONNECT" : entry.method}</TableCell>
                      <TableCell className="max-w-48 truncate">{entry.host}</TableCell>
                      <TableCell className="max-w-96 truncate">
                        {entry.error || entry.url}
                      </TableCell>
                      <TableCell className="text-right">{entry.status || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatBytes(entry.bytes)}
                      </TableCell>
                      <TableCell className="text-right">{entry.durationMs} ms</TableCell>
                      <TableCell>{entry.client}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </main>
  );
}
