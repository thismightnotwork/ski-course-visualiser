import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CourseEditor from '../components/CourseEditor';
import DistancePanel from '../components/DistancePanel';
import PhotoCalibration from '../components/PhotoCalibration';
import RunsTab from '../components/RunsTab';
import { COURSE_TYPE_LABELS, SURFACE_LABELS } from '../domain/project';
import { useCourses } from '../store/courses';
import { useProjects } from '../store/projects';

const Scene3D = lazy(() => import('../components/Scene3D'));

type Tab = 'plan' | 'photo' | '3d' | 'runs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan (2D)' },
  { id: 'photo', label: 'Photo calibration' },
  { id: '3d', label: '3D view' },
  { id: 'runs', label: 'Runs' },
];

export default function ProjectPage() {
  const { id } = useParams();
  const project = useProjects((s) => s.projects.find((p) => p.id === id));
  const course = useCourses((s) => (project ? s.courses[project.id] : undefined));
  const [tab, setTab] = useState<Tab>('plan');

  if (!project) {
    return (
      <p>
        Project not found.{' '}
        <Link to='/' className='underline'>
          Back to dashboard
        </Link>
      </p>
    );
  }

  const needsCourse = (
    <p className='rounded border border-amber-500 p-3'>
      Create the course first on the Plan tab (enter its width and length).
    </p>
  );

  return (
    <article className='space-y-3'>
      <header>
        <h1 className='text-2xl font-bold'>{project.name}</h1>
        <p className='text-sm'>
          {COURSE_TYPE_LABELS[project.courseType]} / {SURFACE_LABELS[project.surfaceType]} /{' '}
          {project.location || 'No location'} / {project.date} / units: {project.units}
        </p>
        {project.description && <p className='text-sm'>{project.description}</p>}
        {project.notes && <p className='text-sm italic'>{project.notes}</p>}
      </header>

      <div
        role='tablist'
        aria-label='Project views'
        className='flex flex-wrap gap-2 print:hidden'
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type='button'
            role='tab'
            aria-selected={tab === t.id}
            className={`rounded border border-slate-400 px-4 py-1 ${tab === t.id ? 'bg-sky-700 text-white' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <div className='space-y-4'>
          <CourseEditor project={project} />
          {course && <DistancePanel project={project} course={course} />}
        </div>
      )}
      {tab === 'photo' &&
        (course ? <PhotoCalibration project={project} course={course} /> : needsCourse)}
      {tab === '3d' &&
        (course ? (
          <Suspense fallback={<p>Loading 3D view...</p>}>
            <Scene3D course={course} />
          </Suspense>
        ) : (
          needsCourse
        ))}
      {tab === 'runs' && (course ? <RunsTab project={project} course={course} /> : needsCourse)}
    </article>
  );
}
