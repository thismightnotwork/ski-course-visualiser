import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  courseSchema,
  createCourse as buildCourse,
  createElement,
  elementSchema,
  toRedBlue,
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
  removeCourse: (projectId: string) => void;
  checkpoint: (projectId: string) => void;
  setCourseFields: (projectId: string, patch: CoursePatch) => boolean;
  replaceCourse: (projectId: string, incoming: Course) => boolean;
  replaceElements: (projectId: string, elements: CourseElement[]) => boolean;
  addElement: (
    projectId: string,
    type: ElementType,
    x: number,
    y: number,
    overrides?: Partial<CourseElement>,
  ) => string | null;
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

/** Upgrades courses saved before colours were limited to red/blue and poles were added. */
export function migrateCourses(courses: Record<string, Course>): Record<string, Course> {
  return Object.fromEntries(
    Object.entries(courses).map(([id, c]) => [
      id,
      {
        ...c,
        elements: c.elements.map((e) => {
          const legacy = e as unknown as { poles?: unknown; colour?: unknown };
          const poles =
            legacy.poles === 1 ? 1 : legacy.poles === 2 ? 2 : e.type === 'training_pole' ? 1 : 2;
          return { ...e, colour: toRedBlue(legacy.colour), poles } as CourseElement;
        }),
      },
    ]),
  );
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
        removeCourse: (projectId) =>
          set((s) => {
            const without = <T>(rec: Record<string, T>) =>
              Object.fromEntries(Object.entries(rec).filter(([k]) => k !== projectId));
            return {
              courses: without(s.courses),
              past: without(s.past),
              future: without(s.future),
            };
          }),
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
        replaceCourse: (projectId, incoming) => {
          const c = get().courses[projectId];
          const parsed = courseSchema.safeParse({
            ...incoming,
            projectId,
            id: c?.id ?? incoming.id,
          });
          if (!parsed.success) return false;
          set((s) => ({
            ...pushPast(s, projectId),
            courses: { ...s.courses, [projectId]: finalise(parsed.data) },
          }));
          return true;
        },
        replaceElements: (projectId, elements) => {
          const c = get().courses[projectId];
          if (!c) return false;
          const parsed = courseSchema.safeParse({ ...c, elements });
          if (!parsed.success) return false;
          set((s) => ({
            ...pushPast(s, projectId),
            courses: { ...s.courses, [projectId]: finalise(parsed.data) },
          }));
          return true;
        },
        addElement: (projectId, type, x, y, overrides = {}) => {
          const c = get().courses[projectId];
          if (!c || !Number.isFinite(x) || !Number.isFinite(y)) return null;
          const parsed = elementSchema.safeParse({
            ...createElement(type, round2(x), round2(y)),
            ...overrides,
          });
          if (!parsed.success) return null;
          const el = parsed.data;
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
    {
      name: 'scv.courses.v1',
      version: 2,
      partialize: (s) => ({ courses: s.courses }),
      migrate: (persisted, version) => {
        const saved = (persisted as { courses?: Record<string, Course> } | null)?.courses ?? {};
        return { courses: version < 2 ? migrateCourses(saved) : saved };
      },
    },
  ),
);
