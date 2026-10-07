import { fireEvent, render, screen } from '@testing-library/react';
import RunsTab from './RunsTab';
import { createCourse } from '../domain/course';
import { createProject } from '../domain/project';
import { useRuns } from '../store/runs';

const project = createProject({
  name: 'Runs test',
  location: '',
  courseType: 'indoor',
  surfaceType: 'snow',
  description: '',
  date: '2026-10-07',
  units: 'metres',
  notes: '',
});
const course = createCourse(project.id, 20, 100);

describe('RunsTab', () => {
  beforeEach(() => useRuns.setState({ runs: {} }));

  it('shows an empty state', () => {
    render(<RunsTab project={project} course={course} />);
    expect(screen.getByText('No runs yet')).toBeInTheDocument();
  });

  it('records a run through the form and shows it in the list', () => {
    render(<RunsTab project={project} course={course} />);
    fireEvent.click(screen.getByRole('button', { name: 'New run' }));
    fireEvent.change(screen.getByLabelText(/Skier name or ID/), { target: { value: 'Racer 1' } });
    fireEvent.change(screen.getByLabelText(/Total time/), { target: { value: '45.30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save run' }));
    const saved = useRuns.getState().runs[project.id];
    expect(saved).toHaveLength(1);
    expect(saved[0].totalTimeSec).toBeCloseTo(45.3);
    expect(screen.getByText('Racer 1')).toBeInTheDocument();
  });

  it('refuses to save an invalid run', () => {
    render(<RunsTab project={project} course={course} />);
    fireEvent.click(screen.getByRole('button', { name: 'New run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save run' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useRuns.getState().runs[project.id]).toBeUndefined();
  });
});
