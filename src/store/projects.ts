import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createProject, type Project, type ProjectForm } from '../domain/project';

interface ProjectState {
  projects: Project[];
  addProject: (input: ProjectForm) => Project;
  removeProject: (id: string) => void;
}

export const useProjects = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      addProject: (input) => {
        const project = createProject(input);
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    }),
    { name: 'scv.projects.v1' },
  ),
);
