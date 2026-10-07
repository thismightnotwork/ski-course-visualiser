import { Link, useParams } from 'react-router-dom';
import CourseEditor from '../components/CourseEditor';
import { COURSE_TYPE_LABELS, SURFACE_LABELS } from '../domain/project';
import { useProjects } from '../store/projects';

export default function ProjectPage() {
  const { id } = useParams();
  const project = useProjects((s) => s.projects.find((p) => p.id === id));
  if (!project) {
    return (
      <p>
        Project not found.{' '}
        <Link to="/" className="underline">
          Back to dashboard
        </Link>
      </p>
    );
  }
  return (
    <article className="space-y-3">
      <header>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-sm">
          {COURSE_TYPE_LABELS[project.courseType]} / {SURFACE_LABELS[project.surfaceType]} /{' '}
          {project.location || 'No location'} / {project.date} / units: {project.units}
        </p>
        {project.description && <p className="text-sm">{project.description}</p>}
        {project.notes && <p className="text-sm italic">{project.notes}</p>}
      </header>
      <CourseEditor project={project} />
    </article>
  );
}
