import { useEffect, useRef } from "react";
import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Search,
  SquareStack,
  Smartphone,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WindowToggleMaximise } from "@/wailsjs/runtime/runtime";
import { MobileSetupDialog } from "./mobile-setup-dialog";
import type { ProxyDetails } from "./proxy-data";

type RequestToolbarProps = {
  activeSessionName: string;
  certURL: string;
  detailsOpen: boolean;
  leftPanelOpen: boolean;
  proxyDetails: ProxyDetails;
  rightPanelOpen: boolean;
  onDetailsToggle: () => void;
  onLeftToggle: () => void;
  onRightToggle: () => void;
  onSessionsOpen: () => void;
};

type RequestFilterBarProps = {
  contentTypeFilters: string[];
  contentTypeOptions: string[];
  error: string;
  filter: string;
  interceptEditRequest: boolean;
  interceptEditResponse: boolean;
  isCapturing: boolean;
  methodFilters: string[];
  methodOptions: string[];
  onClear: () => void;
  onContentTypesChange: (values: string[]) => void;
  onFilterChange: (value: string) => void;
  onInterceptEditRequestChange: (value: boolean) => void;
  onInterceptEditResponseChange: (value: boolean) => void;
  onMethodsChange: (values: string[]) => void;
  onToggleCapture: () => void;
};

type FilterGroupProps = {
  label: string;
  onChange: (values: string[]) => void;
  options: string[];
  value: string[];
};

export function RequestToolbar({
  activeSessionName,
  certURL,
  detailsOpen,
  leftPanelOpen,
  proxyDetails,
  rightPanelOpen,
  onDetailsToggle,
  onLeftToggle,
  onRightToggle,
  onSessionsOpen,
}: RequestToolbarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 bg-muted/60 px-3">
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-3 [--wails-draggable:drag]"
        onDoubleClick={WindowToggleMaximise}
      >
        <div className="w-20 shrink-0" />

        <div className="min-w-0 truncate text-sm font-semibold">
          marcus-proxy · Session: {activeSessionName}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2"
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <MobileSetupDialog
          certURL={certURL}
          proxyDetails={proxyDetails}
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="active:translate-y-px"
              aria-label="Open mobile setup instructions"
            >
              <Smartphone className="size-4" />
              Setup
            </Button>
          }
        />

        <Button
          variant="outline"
          size="sm"
          onClick={onSessionsOpen}
          aria-label="Open sessions"
        >
          <SquareStack className="size-4" />
          Sessions
        </Button>

        <div className="flex items-center gap-1">
          <PanelButton
            active={leftPanelOpen}
            activeLabel="Close left panel"
            inactiveLabel="Open left panel"
            onClick={onLeftToggle}
            activeIcon={<PanelLeftClose className="size-4" />}
            inactiveIcon={<PanelLeftOpen className="size-4" />}
          />

          <PanelButton
            active={detailsOpen}
            activeLabel="Close bottom panel"
            inactiveLabel="Open bottom panel"
            onClick={onDetailsToggle}
            activeIcon={<PanelBottomClose className="size-4" />}
            inactiveIcon={<PanelBottomOpen className="size-4" />}
          />

          <PanelButton
            active={rightPanelOpen}
            activeLabel="Close right panel"
            inactiveLabel="Open right panel"
            onClick={onRightToggle}
            activeIcon={<PanelRightClose className="size-4" />}
            inactiveIcon={<PanelRightOpen className="size-4" />}
          />
        </div>
      </div>
    </div>
  );
}

export function RequestFilterBar({
  contentTypeFilters,
  contentTypeOptions,
  error,
  filter,
  interceptEditRequest,
  interceptEditResponse,
  isCapturing,
  methodFilters,
  methodOptions,
  onClear,
  onContentTypesChange,
  onFilterChange,
  onInterceptEditRequestChange,
  onInterceptEditResponseChange,
  onMethodsChange,
  onToggleCapture,
}: RequestFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const interceptValues = [
    interceptEditRequest ? "request" : "",
    interceptEditResponse ? "response" : "",
  ].filter(Boolean);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "f") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {error ? (
        <header className="shrink-0 bg-muted/60 px-3 py-2 text-sm text-destructive">
          {error}
        </header>
      ) : null}

      <div className="flex shrink-0 bg-muted/30 p-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max items-end gap-3 pr-2">
            <ToggleSection title="Controls">
              <div className="flex items-end gap-2">
                <Button
                  variant="default"
                  size="icon-sm"
                  className="size-7"
                  onClick={onToggleCapture}
                  aria-label={
                    isCapturing ? "Pause table updates" : "Resume table updates"
                  }
                >
                  {isCapturing ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="icon-sm"
                  className="size-7"
                  onClick={onClear}
                  aria-label="Clear table"
                >
                  <Trash2 className="size-4" />
                </Button>

                <div className="relative flex w-64 shrink-0 items-center">
                  <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={filter}
                    onChange={(event) => onFilterChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") event.currentTarget.blur();
                    }}
                    placeholder="Search requests"
                    aria-label="Search requests"
                    className="h-7 border-transparent pl-8 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
                  />
                </div>
              </div>
            </ToggleSection>

            <ToggleSection title="Edit intercept">
              <ToggleGroup
                type="multiple"
                variant="outline"
                size="sm"
                spacing={1}
                value={interceptValues}
                onValueChange={(values) => {
                  const editRequest = values.includes("request");
                  const editResponse = values.includes("response");
                  if (editRequest !== interceptEditRequest) {
                    onInterceptEditRequestChange(editRequest);
                  }
                  if (editResponse !== interceptEditResponse) {
                    onInterceptEditResponseChange(editResponse);
                  }
                }}
                aria-label="Edit intercepted traffic"
                className="shrink-0"
              >
                <ToggleGroupItem
                  value="request"
                  className="h-7 px-2 text-xs data-[state=on]:bg-muted data-[state=on]:text-foreground"
                >
                  Request
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="response"
                  className="h-7 px-2 text-xs data-[state=on]:bg-muted data-[state=on]:text-foreground"
                >
                  Response
                </ToggleGroupItem>
              </ToggleGroup>
            </ToggleSection>

            <FilterGroup
              label="Method"
              value={methodFilters}
              options={methodOptions}
              onChange={onMethodsChange}
            />

            <FilterGroup
              label="Type"
              value={contentTypeFilters}
              options={contentTypeOptions}
              onChange={onContentTypesChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}

type PanelButtonProps = {
  active: boolean;
  activeIcon: ReactNode;
  activeLabel: string;
  inactiveIcon: ReactNode;
  inactiveLabel: string;
  onClick: () => void;
};

function PanelButton({
  active,
  activeIcon,
  activeLabel,
  inactiveIcon,
  inactiveLabel,
  onClick,
}: PanelButtonProps) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="icon-xs"
      onClick={onClick}
      aria-label={active ? activeLabel : inactiveLabel}
      aria-pressed={active}
    >
      {active ? activeIcon : inactiveIcon}
    </Button>
  );
}

function FilterGroup({ label, onChange, options, value }: FilterGroupProps) {
  return (
    <ToggleSection title={label}>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={1}
        value={value}
        onValueChange={onChange}
        aria-label={label}
        className="shrink-0"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            aria-label={`Filter ${option}`}
            className="h-7 max-w-32 px-2 text-xs"
            title={option}
          >
            <span className="truncate">{option}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ToggleSection>
  );
}

function ToggleSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="grid grid-rows-[0.75rem_1.75rem] gap-1">
      <div className="px-1 text-[10px] font-medium text-muted-foreground">
        {title}
      </div>
      <div className="flex items-end">{children}</div>
    </div>
  );
}
