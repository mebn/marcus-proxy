import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultProjectID, type Project } from "./proxy-data";

type SessionSidebarProps = {
  activeProjectID: string;
  newProjectName: string;
  projectCounts: Map<string, number>;
  projects: Project[];
  width: number;
  onClose: () => void;
  onDelete: (project: Project) => void;
  onNameChange: (value: string) => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onSave: () => void;
  onSelect: (projectID: string) => void;
};

type PanelHeaderProps = { label: string; onClose: () => void; title: string };

export function SessionSidebar({
  activeProjectID,
  newProjectName,
  projectCounts,
  projects,
  width,
  onClose,
  onDelete,
  onNameChange,
  onResizeStart,
  onSave,
  onSelect,
}: SessionSidebarProps) {
  return (
    <aside
      className="relative flex min-w-0 shrink-0 flex-col border-r bg-card"
      style={{ width }}
    >
      <PanelHeader
        title="Sessions"
        onClose={onClose}
        label="Close left panel"
      />
      <section className="shrink-0 p-2">
        <form
          className="flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <Input
            value={newProjectName}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur();
            }}
            placeholder="Session name"
            aria-label="Session name"
            className="h-8 min-w-0"
          />

          <Button
            type="submit"
            variant="outline"
            size="sm"
            aria-label="Save quick session"
          >
            Save
          </Button>
        </form>
      </section>

      <section className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid gap-1 pr-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex min-w-0 items-center gap-1 overflow-hidden"
            >
              <Button
                variant={activeProjectID === project.id ? "secondary" : "ghost"}
                size="sm"
                className="h-8 min-w-0 flex-1 justify-between gap-2 overflow-hidden px-2"
                onClick={() => onSelect(project.id)}
              >
                <span className="min-w-0 truncate">{project.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {projectCounts.get(project.id) ?? 0}
                </span>
              </Button>

              {project.id === defaultProjectID ? (
                <div className="size-6 shrink-0" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(project)}
                  aria-label={`Delete ${project.name}`}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div
        className="absolute top-0 right-[-3px] z-20 h-full w-1.5 cursor-col-resize"
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}

function PanelHeader({ label, onClose, title }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 p-3">
      <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        aria-label={label}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
