import { createProject, projectSchema, type ProjectForm } from './project';

const base: ProjectForm = {
  name: 'Slalom set A',
  location: 'Hemel Hempstead',
  courseType: 'indoor',
  surfaceType: 'snow',
  description: '',
  date: '2026-10-07',
  units: 'metres',
  notes: '',
};

describe('createProject', () => {
  it('creates a valid versioned project', () => {
    const p = createProject(base, new Date('2026-10-07T09:00:00Z'));
    expect(projectSchema.safeParse(p).success).toBe(true);
    expect(p.schemaVersion).toBe(1);
    expect(p.ownerId).toBeNull();
    expect(p.createdAt).toBe(p.updatedAt);
  });
  it('rejects an empty name', () => {
    expect(() => createProject({ ...base, name: '  ' })).toThrow();
  });
  it('rejects a bad date', () => {
    expect(() => createProject({ ...base, date: '07/10/2026' })).toThrow();
  });
});
