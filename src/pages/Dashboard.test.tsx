import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useProjects } from '../store/projects';

const renderDash = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

describe('Dashboard', () => {
  beforeEach(() => useProjects.setState({ projects: [] }));

  it('shows the empty state', () => {
    renderDash();
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('lists a project with its course type label', () => {
    useProjects.getState().addProject({
      name: 'Dry slope test',
      location: 'Sussex',
      courseType: 'dry_slope',
      surfaceType: 'dry_slope_matting',
      description: '',
      date: '2026-10-07',
      units: 'metres',
      notes: '',
    });
    renderDash();
    expect(screen.getByText('Dry slope test')).toBeInTheDocument();
    expect(screen.getByText('Dry slope')).toBeInTheDocument();
  });
});
