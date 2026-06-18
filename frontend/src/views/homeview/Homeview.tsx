import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import {
  defaultProject,
  defaultProjectID,
  emptyStatus,
  getContentTypes,
  getMethodType,
  getSearchText,
  getSortValue,
  methodPillClassNames,
  normalizeContentType,
  normalizeStatus,
  type HostStat,
  type Project,
  type ProxyDetails,
  type ProxyStatus,
  type SortDirection,
  type SortKey,
  type SortState,
  type TrafficEntry,
} from "@/components/custom/proxy-data";
import { RequestInfoPanel } from "@/components/custom/request-info-panel";
import { RequestsPanel } from "@/components/custom/requests-panel";
import {
  RequestFilterBar,
  RequestToolbar,
} from "@/components/custom/request-toolbar";
import { SessionsDialog } from "@/components/custom/sessions-dialog";
import { TrafficTable } from "@/components/custom/traffic-table";
import {
  GetProxyStatus,
  LoadAppState,
  SaveAppState,
  StartProxy,
} from "@/wailsjs/go/app/App";
import { EventsOn } from "@/wailsjs/runtime/runtime";

const defaultSort: SortState = { key: "time", direction: "desc" };
type RequestInfoPanelPlacement = "bottom" | "right";

export default function Homeview() {
  const [status, setStatus] = useState<ProxyStatus>(emptyStatus);
  const [error, setError] = useState("");
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPlacement, setDetailsPlacement] =
    useState<RequestInfoPanelPlacement>("bottom");
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [detailsHeight, setDetailsHeight] = useState(320);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(256);
  const [hostFilter, setHostFilter] = useState<string | null>(null);
  const [methodFilters, setMethodFilters] = useState<string[]>([]);
  const [contentTypeFilters, setContentTypeFilters] = useState<string[]>([]);
  const [pinnedIDs, setPinnedIDs] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([defaultProject]);
  const [activeProjectID, setActiveProjectID] = useState(defaultProjectID);
  const [newProjectName, setNewProjectName] = useState("");
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [requestProjectIDs, setRequestProjectIDs] = useState<
    Record<number, string>
  >({});
  const [storageReady, setStorageReady] = useState(false);
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
          projectIDFor(entry.id, requestProjectIDs) === activeProjectID,
      ),
    [activeProjectID, requestProjectIDs, status.recent],
  );
  const projectCounts = useMemo(
    () => countProjects(projects, requestProjectIDs, status.recent),
    [projects, requestProjectIDs, status.recent],
  );
  const pinnedEntries = useMemo(
    () =>
      pinnedIDs
        .map((id) => projectEntries.find((entry) => entry.id === id))
        .filter((entry): entry is TrafficEntry => Boolean(entry)),
    [pinnedIDs, projectEntries],
  );
  const hostStats = useMemo(
    () => buildHostStats(projectEntries),
    [projectEntries],
  );
  const methodOptions = useMemo(
    () =>
      sortedUnique([...methodFilters, ...projectEntries.map(getMethodType)]),
    [methodFilters, projectEntries],
  );
  const methodClassNames = useMemo(
    () =>
      new Map(
        methodOptions.map((method, index) => [
          method,
          methodPillClassNames[index % methodPillClassNames.length],
        ]),
      ),
    [methodOptions],
  );
  const contentTypeOptions = useMemo(
    () =>
      sortedUnique([
        ...contentTypeFilters,
        ...projectEntries.flatMap(getContentTypes),
      ]),
    [contentTypeFilters, projectEntries],
  );
  const visibleEntries = useMemo(
    () =>
      filterAndSortEntries(
        projectEntries,
        filter,
        hostFilter,
        methodFilters,
        contentTypeFilters,
        sort,
      ),
    [
      contentTypeFilters,
      filter,
      hostFilter,
      methodFilters,
      projectEntries,
      sort,
    ],
  );
  const proxyDetails = useMemo(() => parseProxyDetails(proxyURL), [proxyURL]);
  const activeSessionName = useMemo(
    () =>
      projects.find((project) => project.id === activeProjectID)?.name ??
      "Unknown",
    [activeProjectID, projects],
  );
  const bottomDetailsOpen = detailsOpen && detailsPlacement === "bottom";
  const rightDetailsOpen = detailsOpen && detailsPlacement === "right";

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
      assignMissingRequests(
        normalizedStatus.recent,
        activeProjectIDRef.current,
      );
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
    if (status.running || (await startProxy())) setIsCapturing(true);
  }

  function clearTable() {
    setStatus((current) => ({ ...current, recent: [] }));
    setSelectedID(null);
    setPinnedIDs([]);
    setHostFilter(null);
    setMethodFilters([]);
    setContentTypeFilters([]);
    setRequestProjectIDs({});
    setDetailsOpen(false);
  }

  function assignMissingRequests(entries: TrafficEntry[], projectID: string) {
    setRequestProjectIDs((current) => {
      let changed = false;
      const next = { ...current };
      for (const entry of entries) {
        if (next[entry.id] !== undefined) continue;
        next[entry.id] = projectID;
        changed = true;
      }
      return changed ? next : current;
    });
  }

  function saveNoProjectSession() {
    const name = newProjectName.trim();
    if (!name) return;
    const project = { id: `project-${Date.now()}`, name };
    setProjects((current) => [...current, project]);
    setRequestProjectIDs((current) =>
      assignDefaultRequests(current, status.recent, project.id),
    );
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
        (entry) => projectIDFor(entry.id, requestProjectIDs) !== projectID,
      ),
    }));
    setRequestProjectIDs((current) =>
      removeProjectRequests(current, projectID),
    );
    setPinnedIDs((current) =>
      current.filter((id) => projectIDFor(id, requestProjectIDs) !== projectID),
    );
    if (projectID !== defaultProjectID)
      setProjects((current) =>
        current.filter((project) => project.id !== projectID),
      );
    if (activeProjectID === projectID) setActiveProjectID(defaultProjectID);
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

  function selectProject(projectID: string) {
    setActiveProjectID(projectID);
    setHostFilter(null);
    setSelectedID(null);
  }

  function startDetailsResize(event: React.PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = detailsHeight;
    const maxHeight = Math.max(220, window.innerHeight - 140);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const nextHeight = startHeight + startY - moveEvent.clientY;
      setDetailsHeight(Math.min(maxHeight, Math.max(180, nextHeight)));
    };
    const onPointerUp = () => {
      document.body.style.userSelect = previousUserSelect;
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
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    const maxWidth = Math.max(240, Math.floor(window.innerWidth * 0.45));
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const delta =
        side === "left"
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX;
      const width = Math.min(maxWidth, Math.max(160, startWidth + delta));
      if (side === "left") setLeftPanelWidth(width);
      if (side === "right") setRightPanelWidth(width);
    };
    const onPointerUp = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  useEffect(() => {
    async function loadStoredState() {
      try {
        const savedState = await LoadAppState();
        applySavedState(savedState as SavedAppState);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStorageReady(true);
        void refreshStatus();
      }
    }
    void loadStoredState();
    return EventsOn("traffic:new", (entry: TrafficEntry) => {
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
  }, []);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  useEffect(() => {
    activeProjectIDRef.current = activeProjectID;
  }, [activeProjectID]);

  useEffect(() => {
    if (!storageReady) return;
    const timeout = window.setTimeout(saveState, 250);
    return () => window.clearTimeout(timeout);
  }, [
    activeProjectID,
    contentTypeFilters,
    detailsHeight,
    detailsOpen,
    detailsPlacement,
    filter,
    hostFilter,
    isDark,
    leftPanelOpen,
    leftPanelWidth,
    methodFilters,
    pinnedIDs,
    projects,
    requestProjectIDs,
    rightPanelWidth,
    sort,
    storageReady,
  ]);

  useEffect(
    () =>
      EventsOn("theme:dark-mode", (enabled: boolean) =>
        setIsDark(Boolean(enabled)),
      ),
    [],
  );

  useEffect(
    () => EventsOn("certificate:error", (message: string) => setError(message)),
    [],
  );

  useEffect(
    () => EventsOn("certificate:regenerated", onCertificateRegenerated),
    [],
  );

  useEffect(
    () =>
      EventsOn("request-info-panel:placement", (showOnRight: boolean) => {
        setDetailsPlacement(showOnRight ? "right" : "bottom");
      }),
    [],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const openPanelShortcut = (event: KeyboardEvent) => {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey)
        return;
      const key = event.key.toLowerCase();
      if (key === "l") setLeftPanelOpen((current) => !current);
      if (key === "r") {
        setDetailsPlacement("right");
        setDetailsOpen((current) =>
          detailsPlacement === "right" ? !current : true,
        );
      }
      if (key === "b") {
        setDetailsPlacement("bottom");
        setDetailsOpen((current) =>
          detailsPlacement === "bottom" ? !current : true,
        );
      }
      if (["l", "r", "b"].includes(key)) event.preventDefault();
    };
    window.addEventListener("keydown", openPanelShortcut);
    return () => window.removeEventListener("keydown", openPanelShortcut);
  }, [detailsPlacement]);

  function applySavedState(savedState: SavedAppState) {
    const ui = savedState.ui;
    if (savedState.sessions?.length) {
      setProjects(savedState.sessions.map(normalizeProject));
    }

    setPinnedIDs(savedState.pinnedIds ?? []);
    setRequestProjectIDs(numberKeyMap(savedState.requestSessionIds ?? {}));

    if (!ui) return;

    const activeID = ui.activeSessionId || defaultProjectID;
    setIsDark(Boolean(ui.isDark));
    setLeftPanelOpen(Boolean(ui.leftPanelOpen));
    setDetailsOpen(Boolean(ui.detailsOpen));
    setDetailsPlacement(ui.detailsPlacement === "right" ? "right" : "bottom");
    setLeftPanelWidth(ui.leftPanelWidth || 256);
    setRightPanelWidth(ui.rightPanelWidth || 256);
    setDetailsHeight(ui.detailsHeight || 320);
    setFilter(ui.filter ?? "");
    setHostFilter(ui.hostFilter ?? null);
    setMethodFilters(ui.methodFilters ?? []);
    setContentTypeFilters(
      (ui.contentTypeFilters ?? []).map(normalizeContentType),
    );
    setActiveProjectID(activeID);
    activeProjectIDRef.current = activeID;

    if (ui.sort?.key && ui.sort?.direction) {
      setSort({
        key: ui.sort.key as SortKey,
        direction: ui.sort.direction as SortDirection,
      });
    }
  }

  function saveState() {
    void SaveAppState({
      ui: {
        isDark,
        leftPanelOpen,
        detailsOpen,
        detailsPlacement,
        leftPanelWidth,
        rightPanelWidth,
        detailsHeight,
        filter,
        hostFilter: hostFilter ?? undefined,
        methodFilters,
        contentTypeFilters,
        activeSessionId: activeProjectID,
        sort,
      },
      sessions: projects,
      pinnedIds: pinnedIDs,
      requestSessionIds: stringKeyMap(requestProjectIDs),
    } as any);
  }

  function onCertificateRegenerated(nextStatus: ProxyStatus) {
    setError("");
    setStatus(normalizeStatus(nextStatus));
  }

  return (
    <main className="flex h-screen w-screen max-w-screen select-none flex-col overflow-hidden bg-card text-card-foreground">
      <RequestToolbar
        activeSessionName={activeSessionName}
        certURL={certURL}
        detailsOpen={bottomDetailsOpen}
        leftPanelOpen={leftPanelOpen}
        proxyDetails={proxyDetails}
        rightPanelOpen={rightDetailsOpen}
        onDetailsToggle={() => {
          setDetailsPlacement("bottom");
          setDetailsOpen((current) =>
            detailsPlacement === "bottom" ? !current : true,
          );
        }}
        onLeftToggle={() => setLeftPanelOpen((current) => !current)}
        onRightToggle={() => {
          setDetailsPlacement("right");
          setDetailsOpen((current) =>
            detailsPlacement === "right" ? !current : true,
          );
        }}
        onSessionsOpen={() => setSessionsDialogOpen(true)}
      />

      <section className="flex min-h-0 w-full flex-1 bg-card">
        {leftPanelOpen ? (
          <RequestsPanel
            entriesCount={projectEntries.length}
            hostFilter={hostFilter}
            hostStats={hostStats}
            pinnedEntries={pinnedEntries}
            selectedID={selectedID}
            side="left"
            width={leftPanelWidth}
            onClose={() => setLeftPanelOpen(false)}
            onHostFilter={setHostFilter}
            onOpen={openEntry}
            onResizeStart={(event) => startSidePanelResize(event, "left")}
            onUnpin={(id) =>
              setPinnedIDs((current) =>
                current.filter((entryID) => entryID !== id),
              )
            }
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <RequestFilterBar
            contentTypeFilters={contentTypeFilters}
            contentTypeOptions={contentTypeOptions}
            error={error}
            filter={filter}
            isCapturing={isCapturing}
            methodFilters={methodFilters}
            methodOptions={methodOptions}
            onClear={() => setClearConfirmOpen(true)}
            onContentTypesChange={setContentTypeFilters}
            onFilterChange={setFilter}
            onMethodsChange={setMethodFilters}
            onToggleCapture={() => void toggleCapture()}
          />

          <div className="flex min-h-0 flex-1 flex-col bg-card">
            <TrafficTable
              certURL={certURL}
              entries={visibleEntries}
              methodClassNames={methodClassNames}
              proxyDetails={proxyDetails}
              selectedID={selectedID}
              sort={sort}
              onOpen={openEntry}
              onPin={(entry) =>
                setPinnedIDs((current) =>
                  current.includes(entry.id) ? current : [entry.id, ...current],
                )
              }
              onSort={sortBy}
            />

            {bottomDetailsOpen ? (
              <RequestInfoPanel
                entry={selectedEntry}
                height={detailsHeight}
                onClose={() => setDetailsOpen(false)}
                onResizeStart={startDetailsResize}
              />
            ) : null}
          </div>
        </div>

        {rightDetailsOpen ? (
          <RequestInfoPanel
            entry={selectedEntry}
            placement="right"
            width={rightPanelWidth}
            onClose={() => setDetailsOpen(false)}
            onResizeStart={(event) => startSidePanelResize(event, "right")}
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(deleteProject)}
        title="Delete session?"
        description={`This removes ${deleteProject?.name ?? "this session"} and its captured requests from this session.`}
        onOpenChange={(open) => {
          if (!open) setDeleteProject(null);
        }}
        onConfirm={confirmDeleteProject}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear requests?"
        description="This removes captured requests, pins, filters, and current table selection from this session."
        onOpenChange={setClearConfirmOpen}
        onConfirm={() => {
          clearTable();
          setClearConfirmOpen(false);
        }}
      />

      <SessionsDialog
        activeProjectID={activeProjectID}
        newProjectName={newProjectName}
        open={sessionsDialogOpen}
        projectCounts={projectCounts}
        projects={projects}
        onDelete={setDeleteProject}
        onNameChange={setNewProjectName}
        onOpenChange={setSessionsDialogOpen}
        onSave={saveNoProjectSession}
        onSelect={selectProject}
      />
    </main>
  );
}

type SavedAppState = {
  ui?: {
    isDark?: boolean;
    leftPanelOpen?: boolean;
    detailsOpen?: boolean;
    detailsPlacement?: string;
    leftPanelWidth?: number;
    rightPanelWidth?: number;
    detailsHeight?: number;
    filter?: string;
    hostFilter?: string | null;
    methodFilters?: string[];
    contentTypeFilters?: string[];
    activeSessionId?: string;
    sort?: { key?: string; direction?: string };
  };
  sessions?: Project[];
  pinnedIds?: number[];
  requestSessionIds?: Record<string, string>;
};

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function countProjects(
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

function buildHostStats(entries: TrafficEntry[]): HostStat[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const host = entry.host || "(unknown)";
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return Array.from(counts, ([host, count]) => ({ host, count })).sort(
    (left, right) => left.host.localeCompare(right.host),
  );
}

function filterAndSortEntries(
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

function compareEntries(
  left: TrafficEntry,
  right: TrafficEntry,
  sort: SortState,
) {
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

function parseProxyDetails(proxyURL: string): ProxyDetails {
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

function assignDefaultRequests(
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

function removeProjectRequests(
  current: Record<number, string>,
  projectID: string,
) {
  const next = { ...current };
  for (const [entryID, assignedProjectID] of Object.entries(current)) {
    if (assignedProjectID === projectID) delete next[Number(entryID)];
  }
  return next;
}

function projectIDFor(
  entryID: number,
  requestProjectIDs: Record<number, string>,
) {
  return requestProjectIDs[entryID] ?? defaultProjectID;
}

function normalizeProject(session: Project) {
  return {
    id: session.id,
    name: session.id === defaultProjectID ? defaultProject.name : session.name,
  };
}

function numberKeyMap(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([id, sessionID]) => [Number(id), sessionID]),
  );
}

function stringKeyMap(values: Record<number, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([id, sessionID]) => [String(id), sessionID]),
  );
}
