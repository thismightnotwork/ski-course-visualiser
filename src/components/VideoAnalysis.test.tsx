import { render, screen } from '@testing-library/react';
import VideoAnalysisView from './VideoAnalysis';
import { createCourse } from '../domain/course';
import { createProject } from '../domain/project';
import { useVideos } from '../store/video';

const project = createProject({ name: 'Video test', location: '', courseType: 'indoor', surfaceType: 'snow', description: '', date: '2026-10-07', units: 'metres', notes: '' });

describe('VideoAnalysisView', () => {
  beforeEach(() => useVideos.setState({ analyses: {} }));
  it('shows an honest upload state', () => {
    render(<VideoAnalysisView project={project} course={createCourse(project.id, 20, 100)} />);
    expect(screen.getByText('Upload a skiing video')).toBeInTheDocument();
    expect(screen.queryByText(/technique diagnosis/)).not.toBeInTheDocument();
  });
});
