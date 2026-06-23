import type { Dispatch, SetStateAction } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import {
  defaultProjectID,
  projectIDFor,
  removeProjectRequests,
  type Project,
  type ProxyStatus,
} from "./proxy-data";

type DeleteProjectDialogProps = {
  activeProjectID: string;
  project: Project | null;
  requestProjectIDs: Record<number, string>;
  setActiveProjectID: Dispatch<SetStateAction<string>>;
  setHostFilter: Dispatch<SetStateAction<string | null>>;
  setPinnedIDs: Dispatch<SetStateAction<number[]>>;
  setProject: Dispatch<SetStateAction<Project | null>>;
  setProjects: Dispatch<SetStateAction<Project[]>>;
  setRequestProjectIDs: Dispatch<SetStateAction<Record<number, string>>>;
  setSelectedID: Dispatch<SetStateAction<number | null>>;
  setStatus: Dispatch<SetStateAction<ProxyStatus>>;
};

export function DeleteProjectDialog({
  activeProjectID,
  project,
  requestProjectIDs,
  setActiveProjectID,
  setHostFilter,
  setPinnedIDs,
  setProject,
  setProjects,
  setRequestProjectIDs,
  setSelectedID,
  setStatus,
}: DeleteProjectDialogProps) {
  function close() {
    setProject(null);
  }

  function confirmDelete() {
    if (!project) return;

    const projectID = project.id;
    setStatus((current) => ({
      ...current,
      recent: current.recent.filter(
        (entry) => projectIDFor(entry.id, requestProjectIDs) !== projectID,
      ),
    }));
    setRequestProjectIDs((current) =>
      removeProjectRequests(current, projectID),
    );
    setPinnedIDs((current) =>
      current.filter((id) => projectIDFor(id, requestProjectIDs) !== projectID),
    );
    if (projectID !== defaultProjectID) {
      setProjects((current) =>
        current.filter((item) => item.id !== projectID),
      );
    }
    if (activeProjectID === projectID) setActiveProjectID(defaultProjectID);
    setHostFilter(null);
    setSelectedID(null);
    close();
  }

  return (
    <ConfirmDialog
      open={Boolean(project)}
      title="Delete session?"
      description={`This removes ${project?.name ?? "this session"} and its captured requests from this session.`}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onConfirm={confirmDelete}
    />
  );
}
