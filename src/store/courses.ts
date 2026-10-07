import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  courseSchema,
  createCourse as buildCourse,
  createElement,
  elementSchema,
  type Course,
  type CourseElement,
  type ElementType,
} from '../domain/course';
import { numberGates } from '../domain/geometry';

const MAX_HISTORY = 100;

export type CoursePatch = Partial<
  Pick<Course, 'width' | 'length' | 'slopeAngleDeg' | 'startElevation' | 'notes' | 'dimensionSource'>
>;

interface CourseState {
  courses: Record<string, Course>;
  past: Record<string, Course[]>;
  future: Record<string, Course[]>;
  createCourse: (projectId: string, width: number, length: number) => boolean;
  checkpoint: (projectId: string) => void;
  setCourseFields: (projectId: string, patch: CoursePatch) => boolean;
  addElement: (projectId: string, type: ElementType, x: number, y: number) => string | null;
  updateElement: (
    projectId: string,
    id: string,
    patch: Partial<CourseElement>,
    record?: boolean,
  ) => boolean;
  removeElement: (projectId: string, id: string) => void;
  undo: (projectId: string) => void;
  redo: (projectId: string) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function finalise(c: Course): Course {
  return { ...c, elements: numberGates(c.elements), updatedAt: new Date().toISOString() };
}

export const useCourses = create<CourseState>()(
  persist(
    (set, get) => {
      const pushPast = (s: CourseState, projectId: string) => {
        const c = s.courses[projectId];
        if (!c) return {};
        return {
          past: {
            ...s.past,
            [projectId]: [...(s.past[projectId] ?? []), c].slice(-MAX_HISTORY),
          },
          future: { ...s.future, [projectId]: [] },
        };
      };
      return {
        courses: {},
        past: {},
        future: {},
        createCourse: (projectId, width, length) => {
          if (get().courses[projectId]) return false;
          try {
            const course = buildCourse(projectId, width, length);
            set((s) => ({ courses: { ...s.courses, [projectId]: course } }));
            return true;
          } catch {
            return false;
          }
        },
        checkpoint: (projectId) => set((s) => pushPast(s, projectId)),
        setCourseFields: (projectId, patch) => {
          const c = get().courses[projectId];
          if (!c) return false;
          const parsed = courseSchema.safeParse({ ...c, ...patch });
          if (!parsed.success) return false;
          set((s) => ({
            ...pushPast(s, projectId),
            courses: { ...s.courses, [projectId]: finalise(parsed.data) },
          }));
          return true;
        },
        addElement: (projectId, type, x, y) => {
          const c = get().courses[projectId];
          if (!c || !Number.isFinite(x) || !Number.isFinite(y)) return null;
          const el = createElement(type, round2(x), round2(y));
          set((s) => ({
            ...pushPast(s, projectId),
            courses: {
              ...s.courses,
              [projectId]: finalise({ ...c, elements: [...c.elements, el] }),
            },
          }));
          return el.id;
        },
        updateElement: (projectId, id, patch, record = true) => {
          const c = get().courses[projectId];
          const el = c?.elements.find((e) => e.id === id);
          if (!c || !el) return false;
          const parsed = elementSchema.safeParse({ ...el, ...patch });
          if (!parsed.success) return false;
          set((s) => ({
            ...(record ? pushPast(s, projectId) : {}),
            courses: {
              ...s.courses,
              [projectId]: finalise({
                ...c,
                elements: c.elements.map((e) => (e.id === id ? parsed.data : e)),
              }),
            },
          }));
          return true;
        },
        removeElement: (projectId, id) => {
          const c = get().courses[projectId];
          if (!c) return;
          set((s) => ({
            ...pushPast(s, projectId),
            courses: {
              ...s.courses,
              [projectId]: finalise({ ...c, elements: c.elements.filter((e) => e.id !== id) }),
            },
          }));
        },
        undo: (projectId) =>
          set((s) => {
            const past = s.past[projectId] ?? [];
            const cur = s.courses[projectId];
            if (!cur || past.length === 0) return s;
            return {
              courses: { ...s.courses, [projectId]: past[past.length - 1] },
              past: { ...s.past, [projectId]: past.slice(0, -1) },
              future: { ...s.future, [projectId]: [cur, ...(s.future[projectId] ?? [])] },
            };
          }),
        redo: (projectId) =>
          set((s) => {
            const future = s.future[projectId] ?? [];
            const cur = s.courses[projectId];
            if (!cur || future.length === 0) return s;
            return {
              courses: { ...s.courses, [projectId]: future[0] },
              past: { ...s.past, [projectId]: [...(s.past[projectId] ?? []), cur] },
              future: { ...s.future, [projectId]: future.slice(1) },
            };
          }),
      };
    },
    { name: 'scv.courses.v1', partialize: (s) => ({ courses: s.courses }) },
  ),
);
