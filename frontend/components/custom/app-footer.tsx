import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type AppFooterProps = {
  detailsOpen: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  onDetailsToggle: () => void;
  onLeftToggle: () => void;
  onRightToggle: () => void;
};

type PanelButtonProps = {
  active: boolean;
  activeIcon: ReactNode;
  activeLabel: string;
  inactiveIcon: ReactNode;
  inactiveLabel: string;
  onClick: () => void;
};

export function AppFooter({
  detailsOpen,
  leftPanelOpen,
  rightPanelOpen,
  onDetailsToggle,
  onLeftToggle,
  onRightToggle,
}: AppFooterProps) {
  return (
    <footer className="flex h-8 w-full shrink-0 items-center border-t bg-muted/60 px-2">
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
    </footer>
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
