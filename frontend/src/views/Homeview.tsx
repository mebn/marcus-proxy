import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Search,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GetProxyStatus, StartProxy } from "@/wailsjs/go/app/App";
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

type SortDirection = "asc" | "desc";
type SortKey =
  | "time"
  | "method"
  | "host"
  | "url"
  | "status"
  | "bytes"
  | "durationMs"
  | "client";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type HostStat = {
  host: string;
  count: number;
};

type Project = {
  id: string;
  name: string;
};

const defaultProjectID = "default";

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

const defaultProject: Project = {
  id: defaultProjectID,
  name: "Quick session",
};

const tableColumns: Array<{
  key: SortKey;
  label: string;
  className?: string;
  align?: "left" | "right";
}> = [
  { key: "time", label: "Time", className: "w-32" },
  { key: "method", label: "Method", className: "w-24" },
  { key: "host", label: "Host", className: "w-52" },
  { key: "url", label: "URL" },
  { key: "status", label: "Status", className: "w-24", align: "right" },
  { key: "bytes", label: "Bytes", className: "w-28", align: "right" },
  {
    key: "durationMs",
    label: "Duration",
    className: "w-28",
    align: "right",
  },
  { key: "client", label: "Client", className: "w-32" },
];

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

const getSortValue = (entry: TrafficEntry, key: SortKey) => {
  if (key === "time") return new Date(entry.time).getTime();
  if (key === "method") return entry.isConnect ? "CONNECT" : entry.method;
  if (key === "url") return entry.error || entry.url;
  return entry[key];
};

const getSearchText = (entry: TrafficEntry) =>
  [
    entry.isConnect ? "CONNECT" : entry.method,
    entry.host,
    entry.url,
    entry.status,
    entry.bytes,
    entry.durationMs,
    entry.client,
    entry.error,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();

const getScrollableParent = (target: EventTarget | null) => {
  let element = target instanceof Element ? target : null;

  while (element) {
    const style = window.getComputedStyle(element);
    const canScrollY =
      /(auto|scroll)/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight;
    const canScrollX =
      /(auto|scroll)/.test(style.overflowX) &&
      element.scrollWidth > element.clientWidth;

    if (canScrollY || canScrollX) return element;
    element = element.parentElement;
  }

  return null;
};

const shouldBlockRubberBand = (event: WheelEvent) => {
  const element = getScrollableParent(event.target);
  if (!element) return true;

  const canScrollY = element.scrollHeight > element.clientHeight;
  const canScrollX = element.scrollWidth > element.clientWidth;
  const atTop = element.scrollTop <= 0;
  const atBottom =
    Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight;
  const atLeft = element.scrollLeft <= 0;
  const atRight =
    Math.ceil(element.scrollLeft + element.clientWidth) >= element.scrollWidth;
  const blocksY = (event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom);
  const blocksX = (event.deltaX < 0 && atLeft) || (event.deltaX > 0 && atRight);

  if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
    return !canScrollY || blocksY;
  }

  return !canScrollX || blocksX;
};

function DetailBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
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

function MobileSetupDialog({
  certURL,
  proxyDetails,
  trigger,
}: {
  certURL: string;
  proxyDetails: { host: string; port: string; url: string };
  trigger: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="select-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mobile Setup</DialogTitle>
          <DialogDescription>
            Wi-Fi proxy and root certificate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[2rem_1fr] gap-3">
              <div className="flex size-8 items-center justify-center border text-xs">
                1
              </div>
              <div>
                <div className="font-medium">Set Wi-Fi proxy</div>
                <div className="text-muted-foreground">
                  Open phone Wi-Fi network settings, choose manual proxy, use
                  host and port below.
                </div>
              </div>
            </div>
            <div className="grid gap-2 border p-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Host</div>
                <div className="break-all">{proxyDetails.host}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Port</div>
                <div>{proxyDetails.port}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[2rem_1fr] gap-3">
              <div className="flex size-8 items-center justify-center border text-xs">
                2
              </div>
              <div>
                <div className="font-medium">Install certificate</div>
                <div className="text-muted-foreground">
                  Scan QR code or open URL on phone.
                </div>
              </div>
            </div>
            <div className="grid justify-items-center gap-3 border p-4">
              <div className="flex size-44 items-center justify-center bg-white p-2">
                {certURL ? (
                  <QRCodeSVG value={certURL} size={160} level="M" />
                ) : (
                  <div className="size-40 bg-muted" />
                )}
              </div>
              <div className="max-w-full break-all text-center text-xs text-muted-foreground">
                {certURL || "Certificate URL unavailable"}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-[2rem_1fr] gap-3 text-sm">
            <div className="flex size-8 items-center justify-center border text-xs">
              3
            </div>
            <div>
              <div className="font-medium">Trust certificate</div>
              <div className="text-muted-foreground">
                Enable full trust for certificate in settings.
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Homeview() {
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus);
  const [error, setError] = useState("");
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortState>({
    key: "time",
    direction: "desc",
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsHeight, setDetailsHeight] = useState(320);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(256);
  const [hostFilter, setHostFilter] = useState<string | null>(null);
  const [pinnedIDs, setPinnedIDs] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([defaultProject]);
  const [activeProjectID, setActiveProjectID] = useState(defaultProjectID);
  const [newProjectName, setNewProjectName] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [requestProjectIDs, setRequestProjectIDs] = useState<
    Record<number, string>
  >({});
  const [isDark, setIsDark] = useState(true);
  const [isCapturing, setIsCapturing] = useState(true);
  const isCapturingRef = useRef(isCapturing);
  const activeProjectIDRef = useRef(activeProjectID);

  const proxyURL = useMemo(
    () => status.lanUrls[0] ?? status.address,
    [status.address, status.lanUrls],
  );
  const certURL = useMemo(() => status.certUrls[0] ?? "", [status.certUrls]);
  const selectedEntry = useMemo(
    () => status.recent.find((entry) => entry.id === selectedID) ?? null,
    [selectedID, status.recent],
  );
  const projectEntries = useMemo(
    () =>
      status.recent.filter(
        (entry) =>
          (requestProjectIDs[entry.id] ?? defaultProjectID) ===
          activeProjectID,
      ),
    [activeProjectID, requestProjectIDs, status.recent],
  );
  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>(
      projects.map((project) => [project.id, 0]),
    );

    for (const entry of status.recent) {
      const projectID = requestProjectIDs[entry.id] ?? defaultProjectID;
      counts.set(projectID, (counts.get(projectID) ?? 0) + 1);
    }

    return counts;
  }, [projects, requestProjectIDs, status.recent]);
  const pinnedEntries = useMemo(
    () =>
      pinnedIDs
        .map((id) => projectEntries.find((entry) => entry.id === id))
        .filter((entry): entry is TrafficEntry => Boolean(entry)),
    [pinnedIDs, projectEntries],
  );
  const hostStats = useMemo<HostStat[]>(() => {
    const counts = new Map<string, number>();

    for (const entry of projectEntries) {
      const host = entry.host || "(unknown)";
      counts.set(host, (counts.get(host) ?? 0) + 1);
    }

    return Array.from(counts, ([host, count]) => ({ host, count })).sort(
      (left, right) => left.host.localeCompare(right.host),
    );
  }, [projectEntries]);
  const visibleEntries = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const filtered = projectEntries.filter((entry) => {
      if (hostFilter && (entry.host || "(unknown)") !== hostFilter) {
        return false;
      }

      return !query || getSearchText(entry).includes(query);
    });

    return [...filtered].sort((left, right) => {
      const leftValue = getSortValue(left, sort.key);
      const rightValue = getSortValue(right, sort.key);
      const modifier = sort.direction === "asc" ? 1 : -1;

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * modifier;
      }

      return (
        String(leftValue ?? "").localeCompare(String(rightValue ?? "")) *
        modifier
      );
    });
  }, [filter, hostFilter, projectEntries, sort]);
  const proxyDetails = useMemo(() => {
    if (!proxyURL) return { host: "-", port: "-", url: "-" };

    try {
      const parsed = new URL(
        proxyURL.includes("://") ? proxyURL : `http://${proxyURL}`,
      );
      return {
        host: parsed.hostname || "-",
        port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
        url: proxyURL,
      };
    } catch {
      const [host, port] = proxyURL.replace(/^https?:\/\//, "").split(":");
      return { host: host || proxyURL, port: port || "-", url: proxyURL };
    }
  }, [proxyURL]);

  async function refreshStatus() {
    const nextStatus = (await GetProxyStatus()) as ProxyStatus;
    const normalizedStatus = normalizeStatus(nextStatus);
    setStatus(normalizedStatus);
    assignMissingRequests(normalizedStatus.recent, activeProjectIDRef.current);
  }

  async function startProxy() {
    setError("");
    try {
      const nextStatus = (await StartProxy()) as ProxyStatus;
      const normalizedStatus = normalizeStatus(nextStatus);
      setStatus(normalizedStatus);
      assignMissingRequests(normalizedStatus.recent, activeProjectIDRef.current);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async function toggleCapture() {
    setError("");
    if (isCapturing) {
      setIsCapturing(false);
      return;
    }

    if (status.running) {
      setIsCapturing(true);
      return;
    }

    if (await startProxy()) {
      setIsCapturing(true);
    }
  }

  function clearTable() {
    setStatus((current) => ({ ...current, recent: [] }));
    setSelectedID(null);
    setPinnedIDs([]);
    setHostFilter(null);
    setRequestProjectIDs({});
    setDetailsOpen(false);
  }

  function assignMissingRequests(entries: TrafficEntry[], projectID: string) {
    setRequestProjectIDs((current) => {
      let changed = false;
      const next = { ...current };

      for (const entry of entries) {
        if (next[entry.id] === undefined) {
          next[entry.id] = projectID;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }

  function saveNoProjectSession() {
    const name = newProjectName.trim();
    if (!name) return;

    const project: Project = {
      id: `project-${Date.now()}`,
      name,
    };
    setProjects((current) => [...current, project]);
    setRequestProjectIDs((current) => {
      const next = { ...current };

      for (const entry of status.recent) {
        if ((next[entry.id] ?? defaultProjectID) === defaultProjectID) {
          next[entry.id] = project.id;
        }
      }

      return next;
    });
    setActiveProjectID(project.id);
    setNewProjectName("");
    setHostFilter(null);
    setSelectedID(null);
  }

  function confirmDeleteProject() {
    if (!deleteProject) return;

    const projectID = deleteProject.id;
    setStatus((current) => ({
      ...current,
      recent: current.recent.filter(
        (entry) =>
          (requestProjectIDs[entry.id] ?? defaultProjectID) !== projectID,
      ),
    }));
    setRequestProjectIDs((current) => {
      const next = { ...current };

      for (const [entryID, assignedProjectID] of Object.entries(current)) {
        if (
          assignedProjectID === projectID ||
          (projectID === defaultProjectID &&
            assignedProjectID === undefined)
        ) {
          delete next[Number(entryID)];
        }
      }

      return next;
    });
    setPinnedIDs((current) =>
      current.filter((id) => {
        const assignedProjectID = requestProjectIDs[id] ?? defaultProjectID;
        return assignedProjectID !== projectID;
      }),
    );
    if (projectID !== defaultProjectID) {
      setProjects((current) =>
        current.filter((project) => project.id !== projectID),
      );
    }
    if (activeProjectID === projectID) {
      setActiveProjectID(defaultProjectID);
    }
    setHostFilter(null);
    setSelectedID(null);
    setDeleteProject(null);
  }

  function sortBy(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function openEntry(entry: TrafficEntry) {
    setSelectedID(entry.id);
    setDetailsOpen(true);
  }

  function pinEntry(entry: TrafficEntry) {
    setPinnedIDs((current) =>
      current.includes(entry.id) ? current : [entry.id, ...current],
    );
  }

  function unpinEntry(entryID: number) {
    setPinnedIDs((current) => current.filter((id) => id !== entryID));
  }

  function startDetailsResize(event: React.PointerEvent<HTMLElement>) {
    const startY = event.clientY;
    const startHeight = detailsHeight;
    const maxHeight = Math.max(220, window.innerHeight - 140);
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + startY - moveEvent.clientY;
      setDetailsHeight(Math.min(maxHeight, Math.max(180, nextHeight)));
    };
    const onPointerUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function startSidePanelResize(
    event: React.PointerEvent<HTMLElement>,
    side: "left" | "right",
  ) {
    const startX = event.clientX;
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    const maxWidth = Math.max(240, Math.floor(window.innerWidth * 0.45));
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta =
        side === "left"
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX;
      const nextWidth = startWidth + delta;
      const width = Math.min(maxWidth, Math.max(160, nextWidth));

      if (side === "left") {
        setLeftPanelWidth(width);
      } else {
        setRightPanelWidth(width);
      }
    };
    const onPointerUp = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  useEffect(() => {
    void refreshStatus();
    const unsubscribe = EventsOn("traffic:new", (entry: TrafficEntry) => {
      if (!isCapturingRef.current) return;

      setRequestProjectIDs((current) => ({
        ...current,
        [entry.id]: activeProjectIDRef.current,
      }));
      setStatus((current) => ({
        ...current,
        recent: [
          entry,
          ...(current.recent ?? []).filter((item) => item.id !== entry.id),
        ],
      }));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  useEffect(() => {
    activeProjectIDRef.current = activeProjectID;
  }, [activeProjectID]);

  useEffect(() => {
    return EventsOn("theme:dark-mode", (enabled: boolean) => {
      setIsDark(Boolean(enabled));
    });
  }, []);

  useEffect(() => {
    return EventsOn("certificate:regenerated", (nextStatus: ProxyStatus) => {
      setError("");
      setStatus(normalizeStatus(nextStatus));
    });
  }, []);

  useEffect(() => {
    return EventsOn("certificate:error", (message: string) => {
      setError(message);
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const stopRubberBand = (event: WheelEvent) => {
      if (shouldBlockRubberBand(event)) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", stopRubberBand, { passive: false });
    return () => document.removeEventListener("wheel", stopRubberBand);
  }, []);

  useEffect(() => {
    const openPanelShortcut = (event: KeyboardEvent) => {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "l") {
        event.preventDefault();
        setLeftPanelOpen((current) => !current);
      } else if (key === "r") {
        event.preventDefault();
        setRightPanelOpen((current) => !current);
      } else if (key === "b") {
        event.preventDefault();
        setDetailsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", openPanelShortcut);
    return () => window.removeEventListener("keydown", openPanelShortcut);
  }, []);

  return (
    <main className="flex h-screen w-screen max-w-screen select-none flex-col overflow-hidden bg-card text-card-foreground">
      <section className="flex min-h-0 w-full flex-1 bg-card">
        {leftPanelOpen ? (
          <aside
            className="relative flex min-w-0 shrink-0 flex-col border-r bg-card"
            style={{ width: leftPanelWidth }}
          >
            <div className="border-b p-3 text-sm font-semibold">Sessions</div>
            <section className="shrink-0 border-b p-2">
              <form
                className="flex gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveNoProjectSession();
                }}
              >
                <Input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Session name"
                  aria-label="Session name"
                  className="h-8 min-w-0"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  aria-label="Save quick session"
                >
                  Save
                </Button>
              </form>
            </section>

            <section className="min-h-0 flex-1 overflow-auto p-2">
              <div className="grid gap-1 pr-1">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex min-w-0 items-center gap-1 overflow-hidden"
                  >
                    <Button
                      variant={
                        activeProjectID === project.id ? "secondary" : "ghost"
                      }
                      size="sm"
                      className="h-8 min-w-0 flex-1 justify-between gap-2 overflow-hidden px-2"
                      onClick={() => {
                        setActiveProjectID(project.id);
                        setHostFilter(null);
                        setSelectedID(null);
                      }}
                    >
                      <span className="min-w-0 truncate">{project.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {projectCounts.get(project.id) ?? 0}
                      </span>
                    </Button>
                    {project.id === defaultProjectID ? (
                      <div className="size-6 shrink-0" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteProject(project)}
                        aria-label={`Delete ${project.name}`}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <div
              className="absolute top-0 right-[-3px] z-20 h-full w-1.5 cursor-col-resize"
              onPointerDown={(event) => startSidePanelResize(event, "left")}
            />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex w-full shrink-0 flex-col gap-3 border-b bg-muted/60 p-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
          {isCapturing ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => void toggleCapture()}
              aria-label="Pause table updates"
            >
              <Pause className="size-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={() => void toggleCapture()}
              aria-label="Resume table updates"
            >
              <Play className="size-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setClearConfirmOpen(true)}
            aria-label="Clear table"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search requests"
            aria-label="Search requests"
            className="pl-8"
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MobileSetupDialog
            certURL={certURL}
            proxyDetails={proxyDetails}
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label="Open mobile setup instructions"
              >
                <Smartphone className="size-4" />
              </Button>
            }
          />
        </div>

        {error ? (
          <div className="w-full text-sm text-destructive lg:basis-full">
            {error}
          </div>
        ) : null}
          </header>

          <div className="flex min-h-0 flex-1 flex-col bg-card">
          <div className="min-h-0 flex-1 border-b">
            <Table
              className="table-fixed"
              containerClassName="h-full overflow-y-auto !overflow-x-hidden"
            >
              <TableHeader className="sticky top-0 z-10 bg-muted/60">
                <TableRow>
                  {tableColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={[
                        column.className,
                        column.align === "right" ? "text-right" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={[
                          "h-8 px-0 hover:bg-transparent",
                          column.align === "right" ? "ml-auto" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => sortBy(column.key)}
                      >
                        {column.label}
                        {sort.key === column.key ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : null}
                      </Button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-36 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div>No traffic yet</div>
                        <MobileSetupDialog
                          certURL={certURL}
                          proxyDetails={proxyDetails}
                          trigger={
                            <Button variant="outline">
                              <Smartphone className="size-4" />
                              Setup
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEntries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      data-state={
                        selectedID === entry.id ? "selected" : undefined
                      }
                      onClick={() => openEntry(entry)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        pinEntry(entry);
                      }}
                    >
                    <TableCell className="whitespace-nowrap">
                      {formatTime(entry.time)}
                    </TableCell>
                    <TableCell className="truncate">
                      {entry.isConnect ? "CONNECT" : entry.method}
                    </TableCell>
                    <TableCell className="truncate">
                      {entry.host}
                    </TableCell>
                    <TableCell className="truncate">
                      {entry.error || entry.url}
                    </TableCell>
                    <TableCell className="truncate text-right">
                      {entry.status || "-"}
                    </TableCell>
                    <TableCell className="truncate text-right">
                      {formatBytes(entry.bytes)}
                    </TableCell>
                    <TableCell className="truncate text-right">
                      {entry.durationMs} ms
                    </TableCell>
                    <TableCell className="truncate">{entry.client}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {detailsOpen ? (
            <aside
              className="relative flex w-full shrink-0 flex-col border-t bg-card text-card-foreground shadow-lg"
              style={{ height: detailsHeight }}
            >
              <div
                className="flex cursor-row-resize items-start justify-between gap-3 border-b bg-muted/60 p-3"
                onPointerDown={startDetailsResize}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {selectedEntry
                      ? `${selectedEntry.isConnect ? "CONNECT" : selectedEntry.method} ${
                          selectedEntry.status || "-"
                        }`
                      : "No request selected"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selectedEntry?.url ??
                      "Select table row to inspect request"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDetailsOpen(false)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="Close request details"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {selectedEntry ? (
                <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
                  <div className="grid min-w-0 content-start gap-2 text-sm">
                    <div className="border p-2">
                      <div className="text-xs text-muted-foreground">Host</div>
                      <div className="break-all">
                        {selectedEntry.host || "-"}
                      </div>
                    </div>
                    <div className="border p-2">
                      <div className="text-xs text-muted-foreground">
                        Client
                      </div>
                      <div className="break-all">
                        {selectedEntry.client || "-"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                        <pre className="max-h-28 overflow-auto border p-2 text-xs whitespace-pre-wrap">
                          {selectedEntry.error}
                        </pre>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid min-w-0 content-start gap-2">
                    <DetailBlock title="Request Headers" defaultOpen>
                      <DetailPre>
                        {formatHeaders(selectedEntry.requestHeaders)}
                      </DetailPre>
                    </DetailBlock>

                    <DetailBlock title="Request Body">
                      <DetailPre>
                        {selectedEntry.requestBody || "-"}
                        {selectedEntry.requestBodyTruncated
                          ? "\n\n[truncated]"
                          : ""}
                      </DetailPre>
                    </DetailBlock>

                    <DetailBlock title="Response Headers" defaultOpen>
                      <DetailPre>
                        {formatHeaders(selectedEntry.responseHeaders)}
                      </DetailPre>
                    </DetailBlock>

                    <DetailBlock title="Response Body">
                      <DetailPre>
                        {selectedEntry.responseBody || "-"}
                        {selectedEntry.responseBodyTruncated
                          ? "\n\n[truncated]"
                          : ""}
                      </DetailPre>
                    </DetailBlock>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select request row to show body, headers, timing, and errors.
                </div>
              )}
            </aside>
          ) : null}

          </div>
        </div>

        {rightPanelOpen ? (
          <aside
            className="relative flex min-w-0 shrink-0 flex-col border-l bg-card"
            style={{ width: rightPanelWidth }}
          >
            <div className="border-b p-3 text-sm font-semibold">Requests</div>
            <section className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-b p-2">
              <div className="mb-2 shrink-0 px-2 text-xs font-medium text-muted-foreground">
                Pinned
              </div>
              {pinnedEntries.length === 0 ? (
                <div className="px-2 pb-1 text-xs text-muted-foreground">
                  No pinned requests
                </div>
              ) : (
                <div className="min-h-0 overflow-auto">
                  <div className="grid gap-1 pr-1">
                  {pinnedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex min-w-0 items-center gap-1 overflow-hidden"
                    >
                      <Button
                        variant={selectedID === entry.id ? "secondary" : "ghost"}
                        size="sm"
                        className="h-auto min-w-0 flex-1 overflow-hidden px-2 py-1 text-left"
                        onClick={() => openEntry(entry)}
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
                        onClick={() => unpinEntry(entry.id)}
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

            <section className="flex min-h-0 flex-1 flex-col p-2">
              <div className="mb-2 shrink-0 px-2 text-xs font-medium text-muted-foreground">
                Hosts
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid gap-1 pl-1">
                  <Button
                    variant={hostFilter === null ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 min-w-0 justify-between gap-2 overflow-hidden px-2"
                    onClick={() => setHostFilter(null)}
                  >
                    <span className="min-w-0 truncate">All</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {projectEntries.length}
                    </span>
                  </Button>
                  {hostStats.map((item) => (
                    <Button
                      key={item.host}
                      variant={
                        hostFilter === item.host ? "secondary" : "ghost"
                      }
                      size="sm"
                      className="h-8 min-w-0 justify-between gap-2 overflow-hidden px-2"
                      onClick={() => setHostFilter(item.host)}
                    >
                      <span className="min-w-0 truncate">{item.host}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.count}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </section>
            <div
              className="absolute top-0 left-[-3px] z-20 h-full w-1.5 cursor-col-resize"
              onPointerDown={(event) => startSidePanelResize(event, "right")}
            />
          </aside>
        ) : null}
      </section>

      <Dialog
        open={Boolean(deleteProject)}
        onOpenChange={(open) => {
          if (!open) setDeleteProject(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
            <DialogDescription>
              This removes {deleteProject?.name ?? "this session"} and its
              captured requests from this session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteProject}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear requests?</DialogTitle>
            <DialogDescription>
              This removes captured requests, pins, filters, and current table
              selection from this session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                clearTable();
                setClearConfirmOpen(false);
              }}
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="flex h-8 w-full shrink-0 items-center border-t bg-muted/60 px-2">
        <div className="flex items-center gap-1">
          <Button
            variant={leftPanelOpen ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={() => setLeftPanelOpen((current) => !current)}
            aria-label={leftPanelOpen ? "Close left panel" : "Open left panel"}
            aria-pressed={leftPanelOpen}
          >
            {leftPanelOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
          <Button
            variant={detailsOpen ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={() => setDetailsOpen((current) => !current)}
            aria-label={
              detailsOpen ? "Close bottom panel" : "Open bottom panel"
            }
            aria-pressed={detailsOpen}
          >
            {detailsOpen ? (
              <PanelBottomClose className="size-4" />
            ) : (
              <PanelBottomOpen className="size-4" />
            )}
          </Button>
          <Button
            variant={rightPanelOpen ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={() => setRightPanelOpen((current) => !current)}
            aria-label={
              rightPanelOpen ? "Close right panel" : "Open right panel"
            }
            aria-pressed={rightPanelOpen}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>
        </div>
      </footer>
    </main>
  );
}
