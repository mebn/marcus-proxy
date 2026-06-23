import { useEffect, useRef } from "react";
import {
  Pause,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
