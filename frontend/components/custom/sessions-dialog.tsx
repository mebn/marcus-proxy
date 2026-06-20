import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { defaultProjectID, type Project } from "./proxy-data";

type SessionPanelProps = {
  activeProjectID: string;
  newProjectName: string;
  projectCounts: Map<string, number>;
  projects: Project[];
  onDelete: (project: Project) => void;
  onNameChange: (value: string) => void;
  onRename: (project: Project) => void;
  onSave: () => void;
  onSelect: (projectID: string) => void;
};

type SessionsDialogProps = SessionPanelProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SessionsDialog({
  activeProjectID,
  newProjectName,
  open,
  projectCounts,
  projects,
  onDelete,
  onNameChange,
  onOpenChange,
  onRename,
  onSave,
  onSelect,
}: SessionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(36rem,calc(100vh-4rem))] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sessions</DialogTitle>
        </DialogHeader>

        <div className="min-h-0">
          <SessionPanel
            activeProjectID={activeProjectID}
            newProjectName={newProjectName}
            projectCounts={projectCounts}
            projects={projects}
            onDelete={onDelete}
            onNameChange={onNameChange}
            onRename={onRename}
            onSave={onSave}
            onSelect={onSelect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionPanel({
  activeProjectID,
  newProjectName,
  projectCounts,
  projects,
  onDelete,
  onNameChange,
  onRename,
  onSave,
  onSelect,
}: SessionPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
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
            <ContextMenu key={project.id}>
              <ContextMenuTrigger asChild>
                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  <Button
                    variant={
                      activeProjectID === project.id ? "secondary" : "ghost"
                    }
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
              </ContextMenuTrigger>

              <ContextMenuContent>
                <ContextMenuItem
                  disabled={project.id === defaultProjectID}
                  onSelect={() => onRename(project)}
                >
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={project.id === defaultProjectID}
                  variant="destructive"
                  onSelect={() => onDelete(project)}
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </section>
    </div>
  );
}
