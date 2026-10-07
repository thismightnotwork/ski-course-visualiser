import { render, screen } from '@testing-library/react';
import PhotoCalibration from './PhotoCalibration';
import { createCourse } from '../domain/course';
import { createProject } from '../domain/project';

const project = createProject({
  name: 'Photo test',
  location: '',
  courseType: 'outdoor',
  surfaceType: 'snow',
  description: '',
  date: '2026-10-07',
  units: 'metres',
  notes: '',
});

describe('PhotoCalibration', () => {
  it('shows the upload prompt and an honest no-scale status before any photo', () => {
    render(<PhotoCalibration project={project} course={createCourse(project.id, 20, 100)} />);
    expect(screen.getByText('Upload a photo of the whole course')).toBeInTheDocument();
    expect(screen.getByText(/No reliable scale yet/)).toBeInTheDocument();
  });
});
