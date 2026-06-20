import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSetupDialog } from "@/components/custom/mobile-setup-dialog";
import {
  RequestInfoPanel,
  type RequestEditMode,
} from "@/components/custom/request-info-panel";
import { RequestsPanel } from "@/components/custom/requests-panel";
import { RequestFilterBar } from "@/components/custom/request-toolbar";
import { TrafficTable } from "@/components/custom/traffic-table";
import type {
  HostStat,
  InterceptSettings,
  ProxyDetails,
  SortKey,
  SortState,
  TrafficEntry,
} from "@/components/custom/proxy-data";

type NormalViewProps = {
  bottomDetailsOpen: boolean;
  certURL: string;
  contentTypeFilters: string[];
  contentTypeOptions: string[];
  detailsEntry: TrafficEntry | null;
  detailsHeight: number;
  editMode: RequestEditMode;
  editedEntry: TrafficEntry | null;
  error: string;
  filter: string;
  hostFilter: string | null;
  hostStats: HostStat[];
  interceptSettings: InterceptSettings;
  isCapturing: boolean;
  leftPanelOpen: boolean;
  leftPanelWidth: number;
  methodClassNames: Map<string, string>;
  methodFilters: string[];
  methodOptions: string[];
  pinnedEntries: TrafficEntry[];
  projectEntriesCount: number;
  proxyDetails: ProxyDetails;
  rightDetailsOpen: boolean;
  rightPanelWidth: number;
  selectedID: number | null;
  sort: SortState;
  visibleEntries: TrafficEntry[];
  onClear: () => void;
  onCloseDetails: () => void;
  onCloseLeftPanel: () => void;
  onContentTypesChange: (values: string[]) => void;
  onContinueEditedEntry: () => void;
  onDetailsResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onEditAndResend: (entry: TrafficEntry) => void;
  onEditedEntryChange: (entry: TrafficEntry) => void;
  onFilterChange: (value: string) => void;
  onHostFilter: (host: string | null) => void;
  onInterceptEditRequestChange: (value: boolean) => void;
  onInterceptEditResponseChange: (value: boolean) => void;
  onLeftResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onMethodsChange: (values: string[]) => void;
  onOpenEntry: (entry: TrafficEntry) => void;
  onPin: (entry: TrafficEntry) => void;
  onRightResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onSort: (key: SortKey) => void;
  onToggleCapture: () => void;
  onUnpin: (id: number) => void;
};

export function NormalView({
  bottomDetailsOpen,
  certURL,
  contentTypeFilters,
  contentTypeOptions,
  detailsEntry,
  detailsHeight,
  editMode,
  editedEntry,
  error,
  filter,
  hostFilter,
  hostStats,
  interceptSettings,
  isCapturing,
  leftPanelOpen,
  leftPanelWidth,
  methodClassNames,
  methodFilters,
  methodOptions,
  pinnedEntries,
  projectEntriesCount,
  proxyDetails,
  rightDetailsOpen,
  rightPanelWidth,
  selectedID,
  sort,
  visibleEntries,
  onClear,
  onCloseDetails,
  onCloseLeftPanel,
  onContentTypesChange,
  onContinueEditedEntry,
  onDetailsResizeStart,
  onEditAndResend,
  onEditedEntryChange,
  onFilterChange,
  onHostFilter,
  onInterceptEditRequestChange,
  onInterceptEditResponseChange,
  onLeftResizeStart,
  onMethodsChange,
  onOpenEntry,
  onPin,
  onRightResizeStart,
  onSort,
  onToggleCapture,
  onUnpin,
}: NormalViewProps) {
  return (
    <section className="flex min-h-0 w-full flex-1 bg-card">
      {leftPanelOpen ? (
        <RequestsPanel
          entriesCount={projectEntriesCount}
          hostFilter={hostFilter}
          hostStats={hostStats}
          pinnedEntries={pinnedEntries}
          selectedID={selectedID}
          side="left"
          width={leftPanelWidth}
          onClose={onCloseLeftPanel}
          onHostFilter={onHostFilter}
          onOpen={onOpenEntry}
          onResizeStart={onLeftResizeStart}
          onUnpin={onUnpin}
        />
      ) : null}

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
          onClear={onClear}
          onContentTypesChange={onContentTypesChange}
          onFilterChange={onFilterChange}
          onInterceptEditRequestChange={onInterceptEditRequestChange}
          onInterceptEditResponseChange={onInterceptEditResponseChange}
          onMethodsChange={onMethodsChange}
          onToggleCapture={onToggleCapture}
        />

        <div className="flex min-h-0 flex-1 flex-col bg-card">
          {visibleEntries.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <div className="grid justify-items-center gap-3 text-center">
                <div className="text-sm text-muted-foreground">
                  No traffic captured. Setup may be needed.
                </div>
                <MobileSetupDialog
                  certURL={certURL}
                  proxyDetails={proxyDetails}
                  trigger={
                    <Button variant="outline" className="active:translate-y-px">
                      <Smartphone className="size-4" />
                      Setup
                    </Button>
                  }
                />
              </div>
            </div>
          ) : (
            <TrafficTable
              entries={visibleEntries}
              methodClassNames={methodClassNames}
              selectedID={selectedID}
              sort={sort}
              onEditAndResend={onEditAndResend}
              onOpen={onOpenEntry}
              onPin={onPin}
              onSort={onSort}
            />
          )}

          {bottomDetailsOpen ? (
            <RequestInfoPanel
              editMode={editMode}
              entry={detailsEntry}
              height={detailsHeight}
              onChange={onEditedEntryChange}
              onClose={onCloseDetails}
              onContinue={
                editedEntry ? () => void onContinueEditedEntry() : undefined
              }
              onResizeStart={onDetailsResizeStart}
            />
          ) : null}
        </div>
      </div>

      {rightDetailsOpen ? (
        <RequestInfoPanel
          editMode={editMode}
          entry={detailsEntry}
          placement="right"
          width={rightPanelWidth}
          onChange={onEditedEntryChange}
          onClose={onCloseDetails}
          onContinue={editedEntry ? () => void onContinueEditedEntry() : undefined}
          onResizeStart={onRightResizeStart}
        />
      ) : null}
    </section>
  );
}
