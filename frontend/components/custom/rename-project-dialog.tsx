import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultProjectID, type Project } from "./proxy-data";

type RenameProjectDialogProps = {
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
  setProjects: Dispatch<SetStateAction<Project[]>>;
};

export function RenameProjectDialog({
  project,
  setProject,
  setProjects,
}: RenameProjectDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(project?.name ?? "");
  }, [project]);

  function close() {
    setProject(null);
    setName("");
  }

  function confirmRename() {
    if (!project) return;
    if (project.id === defaultProjectID) {
      close();
      return;
    }
    const nextName = name.trim();
    if (!nextName) return;

    setProjects((current) =>
      current.map((item) =>
        item.id === project.id ? { ...item, name: nextName } : item,
      ),
    );
    close();
  }

  return (
    <Dialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            confirmRename();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
            <DialogDescription>
              Enter a new name for {project?.name ?? "this session"}.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            aria-label="Session name"
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
