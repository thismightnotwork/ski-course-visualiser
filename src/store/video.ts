import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoAnalysis } from '../domain/video';

interface VideoState {
  analyses: Record<string, VideoAnalysis[]>;
  add: (analysis: VideoAnalysis) => void;
  update: (analysis: VideoAnalysis) => void;
  remove: (projectId: string, id: string) => void;
  removeProject: (projectId: string) => void;
}

export const useVideos = create<VideoState>()(
  persist(
    (set) => ({
      analyses: {},
      add: (analysis) => set((s) => ({ analyses: { ...s.analyses, [analysis.projectId]: [...(s.analyses[analysis.projectId] ?? []), analysis] } })),
      update: (analysis) => set((s) => ({ analyses: { ...s.analyses, [analysis.projectId]: (s.analyses[analysis.projectId] ?? []).map((a) => (a.id === analysis.id ? analysis : a)) } })),
      remove: (projectId, id) => set((s) => ({ analyses: { ...s.analyses, [projectId]: (s.analyses[projectId] ?? []).filter((a) => a.id !== id) } })),
      removeProject: (projectId) => set((s) => ({ analyses: Object.fromEntries(Object.entries(s.analyses).filter(([k]) => k !== projectId)) })),
    }),
    { name: 'scv.videos.v1' },
  ),
);
