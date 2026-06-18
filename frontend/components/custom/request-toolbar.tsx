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
  certURL: string;
  detailsOpen: boolean;
  isCapturing: boolean;
  leftPanelOpen: boolean;
  proxyDetails: ProxyDetails;
  rightPanelOpen: boolean;
  onClear: () => void;
  onDetailsToggle: () => void;
  onLeftToggle: () => void;
  onRightToggle: () => void;
  onToggleCapture: () => void;
};

type RequestFilterBarProps = {
  contentTypeFilters: string[];
  contentTypeOptions: string[];
  error: string;
  filter: string;
  methodFilters: string[];
  methodOptions: string[];
  onContentTypesChange: (values: string[]) => void;
  onFilterChange: (value: string) => void;
  onMethodsChange: (values: string[]) => void;
};

type FilterGroupProps = {
  label: string;
  onChange: (values: string[]) => void;
  options: string[];
  value: string[];
};

export function RequestToolbar({
  certURL,
  detailsOpen,
  isCapturing,
  leftPanelOpen,
  proxyDetails,
  rightPanelOpen,
  onClear,
  onDetailsToggle,
  onLeftToggle,
  onRightToggle,
  onToggleCapture,
}: RequestToolbarProps) {
  return (
    <div
      className="flex h-12 shrink-0 items-center gap-3 bg-muted/60 px-3 [--wails-draggable:drag]"
      onDoubleClick={WindowToggleMaximise}
    >
      <div className="w-20 shrink-0" />

      <div className="min-w-0 truncate text-sm font-semibold">marcus-proxy</div>

      <div
        className="ml-auto flex shrink-0 items-center gap-2 [--wails-draggable:no-drag]"
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="default"
          size="icon"
          onClick={onToggleCapture}
          aria-label={isCapturing ? "Pause table updates" : "Resume table updates"}
        >
          {isCapturing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          onClick={onClear}
          aria-label="Clear table"
        >
          <Trash2 className="size-4" />
        </Button>

        <MobileSetupDialog
          certURL={certURL}
          proxyDetails={proxyDetails}
          trigger={
            <Button
              variant="outline"
              size="sm"
              aria-label="Open mobile setup instructions"
            >
              <Smartphone className="size-4" />
              Setup
            </Button>
          }
        />

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
  methodFilters,
  methodOptions,
  onContentTypesChange,
  onFilterChange,
  onMethodsChange,
}: RequestFilterBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

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

      <div className="flex shrink-0 items-center gap-2 bg-muted/30 p-2">
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
            className="h-8 pl-8 text-sm"
          />
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max items-center gap-2">
            <FilterGroup
              label="Filter by method"
              value={methodFilters}
              options={methodOptions}
              onChange={onMethodsChange}
            />

            <div className="h-6 w-px shrink-0 bg-border" />

            <FilterGroup
              label="Filter by content type"
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
  );
}
