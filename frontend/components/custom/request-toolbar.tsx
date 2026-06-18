import { Pause, Play, Search, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MobileSetupDialog } from "./mobile-setup-dialog";
import type { ProxyDetails } from "./proxy-data";
type RequestToolbarProps = {
  certURL: string;
  contentTypeFilters: string[];
  contentTypeOptions: string[];
  error: string;
  filter: string;
  isCapturing: boolean;
  methodFilters: string[];
  methodOptions: string[];
  proxyDetails: ProxyDetails;
  onClear: () => void;
  onContentTypesChange: (values: string[]) => void;
  onFilterChange: (value: string) => void;
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
  certURL,
  contentTypeFilters,
  contentTypeOptions,
  error,
  filter,
  isCapturing,
  methodFilters,
  methodOptions,
  proxyDetails,
  onClear,
  onContentTypesChange,
  onFilterChange,
  onMethodsChange,
  onToggleCapture,
}: RequestToolbarProps) {
  return (
    <>
      <header className="flex w-full shrink-0 flex-col gap-3 border-b bg-muted/60 p-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
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
            variant="outline"
            size="icon"
            onClick={onClear}
            aria-label="Clear table"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Search requests"
            aria-label="Search requests"
            className="pl-8"
          />
        </div>
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
        {error ? (
          <div className="w-full text-sm text-destructive lg:basis-full">
            {error}
          </div>
        ) : null}
      </header>
      <div className="shrink-0 overflow-x-auto border-b bg-muted/30 p-2">
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
    </>
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
