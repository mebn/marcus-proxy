import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  SquareStack,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WindowToggleMaximise } from "@/wailsjs/runtime/runtime";
import { MobileSetupDialog } from "./mobile-setup-dialog";
import type { ProxyDetails } from "./proxy-data";

type TopBarProps = {
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

type PanelButtonProps = {
  active: boolean;
  activeIcon: ReactNode;
  activeLabel: string;
  inactiveIcon: ReactNode;
  inactiveLabel: string;
  onClick: () => void;
};

export function TopBar({
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
}: TopBarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 bg-muted/60 px-3">
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-3 [--wails-draggable:drag]"
        onDoubleClick={WindowToggleMaximise}
      >
        <div className="w-20 shrink-0" />

        <div className="min-w-0 truncate text-sm font-semibold">
          Marcus Proxy · Session: {activeSessionName}
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
