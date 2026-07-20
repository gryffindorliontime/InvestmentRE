"use client";

import { useState } from "react";
import type { Project } from "@/lib/projectsStore";

interface ProjectsBarProps {
  projects: Project[];
  activeProjectId: number | null;
  onSelectProject: (id: number | null) => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (id: number, name: string) => void;
  onDeleteProject: (id: number) => void;
  loading: boolean;
  error: string | null;
}

export function ProjectsBar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  loading,
  error,
}: ProjectsBarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreateProject(name);
    setNewName("");
    setCreating(false);
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || renamingId === null) return;
    onRenameProject(renamingId, name);
    setRenamingId(null);
  }

  return (
    <details className="relative">
      <summary className="flex cursor-pointer select-none items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        {loading ? "Loading projects…" : activeProject ? activeProject.name : "No project (scratch)"}
        <span className="text-xs text-slate-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded border border-slate-200 bg-white p-2 shadow-lg">
        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

        <button
          onClick={() => onSelectProject(null)}
          className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${
            activeProjectId === null ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"
          }`}
        >
          No project (scratch — nothing saved)
        </button>

        <div className="my-1 h-px bg-slate-100" />

        <div className="max-h-56 overflow-y-auto">
          {projects.map((p) =>
            renamingId === p.id ? (
              <form key={p.id} onSubmit={submitRename} className="flex items-center gap-1 px-1 py-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => setRenamingId(null)}
                  className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                />
              </form>
            ) : (
              <div
                key={p.id}
                className={`group flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${
                  activeProjectId === p.id ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"
                }`}
              >
                <button onClick={() => onSelectProject(p.id)} className="flex-1 truncate text-left">
                  {p.name}
                </button>
                <span className="flex shrink-0 gap-2 text-xs text-slate-400">
                  <button
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                    className="hover:text-slate-700"
                    title="Rename"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"? This also removes its saved listings.`)) {
                        onDeleteProject(p.id);
                      }
                    }}
                    className="hover:text-rose-600"
                    title="Delete"
                  >
                    Delete
                  </button>
                </span>
              </div>
            )
          )}
          {projects.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-400">No projects yet.</p>
          )}
        </div>

        <div className="my-1 h-px bg-slate-100" />

        {creating ? (
          <form onSubmit={submitCreate} className="flex items-center gap-1 px-1 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName.trim() && setCreating(false)}
              placeholder="Project name"
              className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-sm"
            />
            <button type="submit" className="text-xs font-medium text-blue-600 hover:underline">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-blue-600 hover:bg-slate-50"
          >
            + New project
          </button>
        )}
      </div>
    </details>
  );
}
