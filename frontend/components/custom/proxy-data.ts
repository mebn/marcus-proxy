export type TrafficEntry = {
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
  paused?: boolean;
  interceptPhase?: "request" | "response";
};

export type ProxyStatus = {
  running: boolean;
  address: string;
  lanUrls: string[];
  certUrls: string[];
  certPath: string;
  certFingerprint: string;
  httpsInterceptOn: boolean;
  recent: TrafficEntry[];
};

export type SortDirection = "asc" | "desc";

export type SortKey =
  | "index"
  | "time"
  | "method"
  | "contentType"
  | "host"
  | "url"
  | "status"
  | "bytes"
  | "durationMs"
  | "client";

export type SortState = {
  key: SortKey;
  direction: SortDirection;
};

export type HostStat = {
  host: string;
  count: number;
};

export type Project = {
  id: string;
  name: string;
};

export type ProxyDetails = {
  host: string;
  port: string;
  url: string;
};

export type InterceptSettings = {
  editRequest: boolean;
  editResponse: boolean;
};

export const defaultProjectID = "default";

export const defaultProject: Project = {
  id: defaultProjectID,
  name: "Quick session",
};

export const emptyStatus: ProxyStatus = {
  running: false,
  address: "",
  lanUrls: [],
  certUrls: [],
  certPath: "",
  certFingerprint: "",
  httpsInterceptOn: false,
  recent: [],
};

export type TableColumn = {
  id: string;
  label: string;
  sortKey?: SortKey;
  width: number;
  minWidth?: number;
  align?: "left" | "right";
};

export const tableColumns: TableColumn[] = [
  {
    id: "index",
    label: "#",
    sortKey: "index",
    width: 44,
    minWidth: 36,
    align: "right",
  },
  { id: "time", label: "Time", sortKey: "time", width: 112, minWidth: 88 },
  { id: "method", label: "Method", sortKey: "method", width: 96, minWidth: 76 },
  {
    id: "contentType",
    label: "Type",
    sortKey: "contentType",
    width: 112,
    minWidth: 80,
  },
  { id: "host", label: "Host", sortKey: "host", width: 192, minWidth: 120 },
  { id: "url", label: "URL", sortKey: "url", width: 360, minWidth: 160 },
  {
    id: "status",
    label: "Status",
    sortKey: "status",
    width: 80,
    minWidth: 68,
    align: "right",
  },
  {
    id: "bytes",
    label: "Bytes",
    sortKey: "bytes",
    width: 96,
    minWidth: 72,
    align: "right",
  },
  {
    id: "durationMs",
    label: "Duration",
    sortKey: "durationMs",
    width: 104,
    minWidth: 84,
    align: "right",
  },
  {
    id: "client",
    label: "Client",
    sortKey: "client",
    width: 112,
    minWidth: 80,
  },
];

export const methodPillClassNames = [
  "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
  "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  "bg-cyan-100 text-cyan-800 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-200 dark:ring-cyan-800",
  "bg-lime-100 text-lime-900 ring-lime-200 dark:bg-lime-950 dark:text-lime-200 dark:ring-lime-800",
  "bg-pink-100 text-pink-800 ring-pink-200 dark:bg-pink-950 dark:text-pink-200 dark:ring-pink-800",
];

export const normalizeStatus = (
  value: Partial<ProxyStatus> | null,
): ProxyStatus => ({
  running: Boolean(value?.running),
  address: value?.address ?? "",
  lanUrls: value?.lanUrls ?? [],
  certUrls: value?.certUrls ?? [],
  certPath: value?.certPath ?? "",
  certFingerprint: value?.certFingerprint ?? "",
  httpsInterceptOn: Boolean(value?.httpsInterceptOn),
  recent: value?.recent ?? [],
});

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));

export const formatBytes = (bytes: number) => {
  if (bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatHeaders = (headers?: Record<string, string[]>) => {
  if (!headers || Object.keys(headers).length === 0) return "-";
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .join("\n");
};

export const getMethodType = (entry: TrafficEntry) =>
  entry.isConnect ? "CONNECT" : entry.method || "(unknown)";

export const getHeaderValues = (
  headers: Record<string, string[]> | undefined,
  name: string,
) => {
  if (!headers) return [];
  const target = name.toLowerCase();
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === target)
    .flatMap(([, values]) => values);
};

export const normalizeContentType = (value: string) => {
  const mimeType = value.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) return "(unknown)";
  const subtype = mimeType.includes("/") ? mimeType.split("/").pop() : mimeType;
  if (!subtype) return mimeType;
  if (!subtype.includes("+")) return subtype;
  const [base, suffix] = subtype.split("+");
  if (suffix === "json") return "json";
  if (suffix === "xml") return base || "xml";
  return base || suffix || subtype;
};

export const getContentTypes = (entry: TrafficEntry) =>
  [
    ...getHeaderValues(entry.requestHeaders, "content-type"),
    ...getHeaderValues(entry.responseHeaders, "content-type"),
  ]
    .map(normalizeContentType)
    .filter((value, index, values) => values.indexOf(value) === index);

export const getPrimaryContentType = (entry: TrafficEntry) =>
  getContentTypes(entry)[0] ?? "-";

export const getSortValue = (entry: TrafficEntry, key: SortKey) => {
  if (key === "index") return new Date(entry.time).getTime();
  if (key === "time") return new Date(entry.time).getTime();
  if (key === "method") return getMethodType(entry);
  if (key === "contentType") return getPrimaryContentType(entry);
  if (key === "url") return entry.error || entry.url;
  return entry[key];
};

export const getSearchText = (entry: TrafficEntry) =>
  [
    getMethodType(entry),
    getContentTypes(entry).join(" "),
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

export function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function countProjects(
  projects: Project[],
  requestProjectIDs: Record<number, string>,
  entries: TrafficEntry[],
) {
  const counts = new Map<string, number>(
    projects.map((project) => [project.id, 0]),
  );
  for (const entry of entries) {
    const projectID = projectIDFor(entry.id, requestProjectIDs);
    counts.set(projectID, (counts.get(projectID) ?? 0) + 1);
  }
  return counts;
}

export function buildHostStats(entries: TrafficEntry[]): HostStat[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const host = entry.host || "(unknown)";
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return Array.from(counts, ([host, count]) => ({ host, count })).sort(
    (left, right) => left.host.localeCompare(right.host),
  );
}

export function filterAndSortEntries(
  entries: TrafficEntry[],
  filter: string,
  hostFilter: string | null,
  methodFilters: string[],
  contentTypeFilters: string[],
  sort: SortState,
) {
  const query = filter.trim().toLowerCase();
  const filtered = entries.filter((entry) =>
    isVisibleEntry(entry, query, hostFilter, methodFilters, contentTypeFilters),
  );
  return [...filtered].sort((left, right) => compareEntries(left, right, sort));
}

export function parseProxyDetails(proxyURL: string): ProxyDetails {
  if (!proxyURL) return { host: "-", port: "-", url: "-" };
  try {
    const parsed = new URL(
      proxyURL.includes("://") ? proxyURL : `http://${proxyURL}`,
    );
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    return { host: parsed.hostname || "-", port, url: proxyURL };
  } catch {
    const [host, port] = proxyURL.replace(/^https?:\/\//, "").split(":");
    return { host: host || proxyURL, port: port || "-", url: proxyURL };
  }
}

export function assignDefaultRequests(
  current: Record<number, string>,
  entries: TrafficEntry[],
  projectID: string,
) {
  const next = { ...current };
  for (const entry of entries) {
    if (projectIDFor(entry.id, next) === defaultProjectID)
      next[entry.id] = projectID;
  }
  return next;
}

export function removeProjectRequests(
  current: Record<number, string>,
  projectID: string,
) {
  const next = { ...current };
  for (const [entryID, assignedProjectID] of Object.entries(current)) {
    if (assignedProjectID === projectID) delete next[Number(entryID)];
  }
  return next;
}

export function projectIDFor(
  entryID: number,
  requestProjectIDs: Record<number, string>,
) {
  return requestProjectIDs[entryID] ?? defaultProjectID;
}

export function normalizeProject(session: Project) {
  return {
    id: session.id,
    name: session.id === defaultProjectID ? defaultProject.name : session.name,
  };
}

export function numberKeyMap(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([id, sessionID]) => [Number(id), sessionID]),
  );
}

export function stringKeyMap(values: Record<number, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([id, sessionID]) => [String(id), sessionID]),
  );
}

function isVisibleEntry(
  entry: TrafficEntry,
  query: string,
  hostFilter: string | null,
  methodFilters: string[],
  contentTypeFilters: string[],
) {
  if (hostFilter && (entry.host || "(unknown)") !== hostFilter) return false;
  if (methodFilters.length > 0 && !methodFilters.includes(getMethodType(entry)))
    return false;
  if (
    contentTypeFilters.length > 0 &&
    !getContentTypes(entry).some((type) => contentTypeFilters.includes(type))
  )
    return false;
  return !query || getSearchText(entry).includes(query);
}

function compareEntries(left: TrafficEntry, right: TrafficEntry, sort: SortState) {
  const leftValue = getSortValue(left, sort.key);
  const rightValue = getSortValue(right, sort.key);
  const modifier = sort.direction === "asc" ? 1 : -1;
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * modifier;
  }
  return (
    String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * modifier
  );
}
