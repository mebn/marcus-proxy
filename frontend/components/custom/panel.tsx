import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PanelPlacement = "left" | "right" | "bottom";
type PanelShortcutKey = "l" | "r" | "b";

type PanelShortcutOptions = {
  active?: boolean;
  key: PanelShortcutKey;
  open: boolean;
  onActivate?: () => void;
  onOpenChange: (open: boolean) => void;
};

type PanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  closeLabel: string;
  height?: number;
  placement: PanelPlacement;
  subtitle?: ReactNode;
  title: string;
  width?: number;
  onClose: () => void;
  onSizeChange?: (size: number) => void;
};

export function Panel({
  actions,
  children,
  closeLabel,
  height,
  placement,
  subtitle,
  title,
  width,
  onClose,
  onSizeChange,
}: PanelProps) {
  const isBottom = placement === "bottom";
  const size = isBottom ? height : width;
  const canResize = Boolean(onSizeChange && size);

  function startResize(event: React.PointerEvent<HTMLElement>) {
    if (!onSizeChange || !size) return;

    event.preventDefault();
    event.stopPropagation();

    const startPosition = isBottom ? event.clientY : event.clientX;
    const maxSize = isBottom
      ? Math.max(220, window.innerHeight - 140)
      : Math.max(240, Math.floor(window.innerWidth * 0.45));
    const minSize = isBottom ? 180 : 160;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const currentPosition = isBottom ? moveEvent.clientY : moveEvent.clientX;
      const delta =
        placement === "left"
          ? currentPosition - startPosition
          : startPosition - currentPosition;
      onSizeChange(Math.min(maxSize, Math.max(minSize, size + delta)));
    };

    const onPointerUp = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <aside
      className={[
        "relative flex shrink-0 flex-col bg-card text-card-foreground",
        isBottom ? "w-full border-t shadow-lg" : "min-w-0",
        placement === "left" ? "border-r" : "",
        placement === "right" ? "border-l" : "",
      ].join(" ")}
      style={isBottom ? { height } : { width }}
    >
      <div
        className={[
          "flex items-center justify-between gap-2 p-3",
          isBottom && canResize ? "cursor-row-resize" : "",
        ].join(" ")}
        onPointerDown={isBottom && canResize ? startResize : undefined}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {subtitle ? (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={closeLabel}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {children}

      {!isBottom && canResize ? (
        <div
          className={[
            "absolute top-0 z-20 h-full w-1.5 cursor-col-resize",
            placement === "left" ? "right-[-3px]" : "left-[-3px]",
          ].join(" ")}
          onPointerDown={startResize}
        />
      ) : null}
    </aside>
  );
}

export function usePanelShortcut({
  active = true,
  key,
  open,
  onActivate,
  onOpenChange,
}: PanelShortcutOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey)
        return;
      if (event.key.toLowerCase() !== key) return;

      event.preventDefault();
      if (active) {
        onOpenChange(!open);
        return;
      }

      onActivate?.();
      onOpenChange(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, key, onActivate, onOpenChange, open]);
}
