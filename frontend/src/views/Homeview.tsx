import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import { DeleteProjectDialog } from "@/components/custom/delete-project-dialog";
import { EmptyTrafficState } from "@/components/custom/empty-traffic-state";
import {
  defaultProject,
  defaultProjectID,
  emptyStatus,
  assignDefaultRequests,
  buildHostStats,
  countProjects,
  filterAndSortEntries,
  getContentTypes,
  getMethodType,
  methodPillClassNames,
  normalizeProject,
  normalizeContentType,
  normalizeStatus,
  numberKeyMap,
  parseProxyDetails,
  projectIDFor,
  sortedUnique,
  stringKeyMap,
  type InterceptSettings,
  type Project,
  type ProxyStatus,
  type SortDirection,
  type SortKey,
  type SortState,
  type TrafficEntry,
} from "@/components/custom/proxy-data";
import { RenameProjectDialog } from "@/components/custom/rename-project-dialog";
import {
  RequestInfoPanel,
  type RequestEditMode,
} from "@/components/custom/request-info-panel";
import { RequestsPanel } from "@/components/custom/requests-panel";
import { RequestFilterBar } from "@/components/custom/request-toolbar";
import { SessionsDialog } from "@/components/custom/sessions-dialog";
import { TopBar } from "@/components/custom/top-bar";
import { TrafficTable } from "@/components/custom/traffic-table";
import {
  ContinueIntercept,
  GetProxyStatus,
  LoadAppState,
  ResendRequest,
  SaveAppState,
  SetInterceptSettings,
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
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [requestProjectIDs, setRequestProjectIDs] = useState<
    Record<number, string>
  >({});
  const [storageReady, setStorageReady] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isCapturing, setIsCapturing] = useState(true);
  const [interceptSettings, setInterceptSettings] = useState<InterceptSettings>(
    {
      editRequest: false,
      editResponse: false,
    },
  );
  const [editedEntry, setEditedEntry] = useState<TrafficEntry | null>(null);
  const [editMode, setEditMode] = useState<RequestEditMode>("view");

  const isCapturingRef = useRef(isCapturing);
  const activeProjectIDRef = useRef(activeProjectID);
  const interceptSettingsRef = useRef(interceptSettings);

  const proxyURL = status.lanUrls[0] ?? status.address;
  const certURL = status.certUrls[0] ?? "";
  const selectedEntry = useMemo(
    () => status.recent.find((entry) => entry.id === selectedID) ?? null,
    [selectedID, status.recent],
  );
  const detailsEntry = editedEntry ?? selectedEntry;
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
  const activeSessionName =
    projects.find((project) => project.id === activeProjectID)?.name ??
    "Unknown";
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

  async function updateInterceptSettings(patch: Partial<InterceptSettings>) {
    const next = { ...interceptSettingsRef.current, ...patch };
    interceptSettingsRef.current = next;
    setInterceptSettings(next);
    try {
      await SetInterceptSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function clearTable() {
    setStatus((current) => ({ ...current, recent: [] }));
    setSelectedID(null);
    setPinnedIDs([]);
    setHostFilter(null);
    setMethodFilters([]);
    setContentTypeFilters([]);
    setRequestProjectIDs({});
    setEditedEntry(null);
    setEditMode("view");
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

  function toggleDetailsPanel(placement: RequestInfoPanelPlacement) {
    setDetailsPlacement(placement);
    setDetailsOpen((current) =>
      detailsPlacement === placement ? !current : true,
    );
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
    setEditedEntry(null);
    setEditMode("view");
    setDetailsOpen(true);
  }

  function editAndResend(entry: TrafficEntry) {
    setSelectedID(entry.id);
    setEditedEntry({ ...entry, interceptPhase: "request" });
    setEditMode("resend-request");
    setDetailsOpen(true);
  }

  async function continueEditedEntry() {
    if (!editedEntry) return;
    setError("");
    try {
      if (editMode === "resend-request") {
        await ResendRequest(editedEntry);
      } else {
        await ContinueIntercept(editedEntry);
      }
      setEditedEntry(null);
      setEditMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function selectProject(projectID: string) {
    setActiveProjectID(projectID);
    setHostFilter(null);
    setSelectedID(null);
    setEditedEntry(null);
    setEditMode("view");
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

  useEffect(
    () =>
      EventsOn("traffic:paused", (entry: TrafficEntry) => {
        setRequestProjectIDs((current) => ({
          ...current,
          [entry.id]: activeProjectIDRef.current,
        }));
        setSelectedID(entry.id);
        setEditedEntry(entry);
        setEditMode(
          entry.interceptPhase === "response"
            ? "edit-response"
            : "edit-request",
        );
        setDetailsOpen(true);
      }),
    [],
  );

  useEffect(() => {
    isCapturingRef.current = isCapturing;
    activeProjectIDRef.current = activeProjectID;
    interceptSettingsRef.current = interceptSettings;
  }, [activeProjectID, interceptSettings, isCapturing]);

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
      <TopBar
        activeSessionName={activeSessionName}
        certURL={certURL}
        detailsOpen={bottomDetailsOpen}
        leftPanelOpen={leftPanelOpen}
        proxyDetails={proxyDetails}
        rightPanelOpen={rightDetailsOpen}
        onDetailsToggle={() => toggleDetailsPanel("bottom")}
        onLeftToggle={() => setLeftPanelOpen((current) => !current)}
        onRightToggle={() => toggleDetailsPanel("right")}
        onSessionsOpen={() => setSessionsDialogOpen(true)}
      />

      <section className="flex min-h-0 w-full flex-1 bg-card">
        <RequestsPanel
          entriesCount={projectEntries.length}
          hostFilter={hostFilter}
          hostStats={hostStats}
          open={leftPanelOpen}
          pinnedEntries={pinnedEntries}
          selectedID={selectedID}
          side="left"
          width={leftPanelWidth}
          onHostFilter={setHostFilter}
          onOpen={openEntry}
          onOpenChange={setLeftPanelOpen}
          onWidthChange={setLeftPanelWidth}
          onUnpin={(id) =>
            setPinnedIDs((current) =>
              current.filter((entryID) => entryID !== id),
            )
          }
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <RequestFilterBar
            contentTypeFilters={contentTypeFilters}
            contentTypeOptions={contentTypeOptions}
            error={error}
            filter={filter}
            interceptEditRequest={interceptSettings.editRequest}
            interceptEditResponse={interceptSettings.editResponse}
            isCapturing={isCapturing}
            methodFilters={methodFilters}
            methodOptions={methodOptions}
            onClear={() => setClearConfirmOpen(true)}
            onContentTypesChange={setContentTypeFilters}
            onFilterChange={setFilter}
            onInterceptEditRequestChange={(value) =>
              void updateInterceptSettings({ editRequest: value })
            }
            onInterceptEditResponseChange={(value) =>
              void updateInterceptSettings({ editResponse: value })
            }
            onMethodsChange={setMethodFilters}
            onToggleCapture={() => void toggleCapture()}
          />

          <div className="flex min-h-0 flex-1 flex-col bg-card">
            {visibleEntries.length === 0 ? (
              <EmptyTrafficState
                certURL={certURL}
                proxyDetails={proxyDetails}
              />
            ) : (
              <TrafficTable
                entries={visibleEntries}
                methodClassNames={methodClassNames}
                selectedID={selectedID}
                sort={sort}
                onEditAndResend={editAndResend}
                onOpen={openEntry}
                onPin={(entry) =>
                  setPinnedIDs((current) =>
                    current.includes(entry.id)
                      ? current
                      : [entry.id, ...current],
                  )
                }
                onSort={sortBy}
              />
            )}

            <RequestInfoPanel
              active={detailsPlacement === "bottom"}
              editMode={editMode}
              entry={detailsEntry}
              height={detailsHeight}
              open={detailsOpen}
              onActivate={() => setDetailsPlacement("bottom")}
              onChange={setEditedEntry}
              onContinue={
                editedEntry ? () => void continueEditedEntry() : undefined
              }
              onOpenChange={setDetailsOpen}
              onSizeChange={setDetailsHeight}
            />
          </div>
        </div>

        <RequestInfoPanel
          active={detailsPlacement === "right"}
          editMode={editMode}
          entry={detailsEntry}
          open={detailsOpen}
          placement="right"
          width={rightPanelWidth}
          onActivate={() => setDetailsPlacement("right")}
          onChange={setEditedEntry}
          onContinue={
            editedEntry ? () => void continueEditedEntry() : undefined
          }
          onOpenChange={setDetailsOpen}
          onSizeChange={setRightPanelWidth}
        />
      </section>

      <DeleteProjectDialog
        activeProjectID={activeProjectID}
        project={deleteProject}
        requestProjectIDs={requestProjectIDs}
        setActiveProjectID={setActiveProjectID}
        setHostFilter={setHostFilter}
        setPinnedIDs={setPinnedIDs}
        setProject={setDeleteProject}
        setProjects={setProjects}
        setRequestProjectIDs={setRequestProjectIDs}
        setSelectedID={setSelectedID}
        setStatus={setStatus}
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
        onRename={setRenameProject}
        onSave={saveNoProjectSession}
        onSelect={selectProject}
      />

      <RenameProjectDialog
        project={renameProject}
        setProject={setRenameProject}
        setProjects={setProjects}
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
