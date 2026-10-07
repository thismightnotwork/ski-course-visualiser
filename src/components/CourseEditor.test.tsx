import { fireEvent, render, screen } from '@testing-library/react';
import CourseEditor from './CourseEditor';
import { createProject } from '../domain/project';
import { useCourses } from '../store/courses';

const project = createProject({
  name: 'Editor test',
  location: '',
  courseType: 'indoor',
  surfaceType: 'snow',
  description: '',
  date: '2026-10-07',
  units: 'metres',
  notes: '',
});

describe('CourseEditor', () => {
  beforeEach(() => useCourses.setState({ courses: {}, past: {}, future: {} }));

  it('asks for dimensions before a course exists', () => {
    render(<CourseEditor project={project} />);
    expect(screen.getByRole('heading', { name: 'Create course' })).toBeInTheDocument();
  });

  it('shows the plan after creating a course', () => {
    render(<CourseEditor project={project} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create course' }));
    expect(screen.getByLabelText('Course plan')).toBeInTheDocument();
    expect(useCourses.getState().courses[project.id].length).toBe(120);
  });
});
