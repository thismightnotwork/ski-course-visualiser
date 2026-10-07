import { Link } from 'react-router-dom';
import { COURSE_TYPE_LABELS, SURFACE_LABELS } from '../domain/project';
import { useCourses } from '../store/courses';
import { useProjects } from '../store/projects';
import { useRuns } from '../store/runs';

export default function Dashboard() {
  const projects = useProjects((s) => s.projects);
  const removeProject = useProjects((s) => s.removeProject);
  const removeCourse = useCourses((s) => s.removeCourse);
  const removeRuns = useRuns((s) => s.removeProjectRuns);
  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section>
      <div className='mb-4 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>Projects</h1>
        <Link to='/projects/new' className='rounded bg-sky-700 px-4 py-2 text-white'>
          Create project
        </Link>
      </div>
      {sorted.length === 0 ? (
        <div className='rounded border border-dashed border-slate-400 p-8 text-center'>
          <h2 className='text-lg font-semibold'>No projects yet</h2>
          <p className='mt-2'>
            Create your first course project. Everything is stored in this browser only.
          </p>
        </div>
      ) : (
        <ul className='grid gap-3 sm:grid-cols-2'>
          {sorted.map((p) => (
            <li key={p.id} className='rounded border border-slate-300 p-4 dark:border-slate-700'>
              <h2 className='font-semibold'>{p.name}</h2>
              <p className='text-sm'>
                <span className='rounded bg-slate-200 px-2 py-0.5 dark:bg-slate-700'>
                  {COURSE_TYPE_LABELS[p.courseType]}
                </span>{' '}
                {SURFACE_LABELS[p.surfaceType]} - {p.location || 'No location'}
              </p>
              <p className='text-xs'>
                Last modified {new Date(p.updatedAt).toLocaleString('en-GB')}
              </p>
              <div className='mt-3 flex gap-2'>
                <Link to={`/projects/${p.id}`} className='rounded bg-sky-700 px-3 py-1 text-white'>
                  Open
                </Link>
                <button
                  type='button'
                  className='rounded border border-red-600 px-3 py-1 text-red-700 dark:text-red-400'
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${p.name}", its course and its runs? This cannot be undone.`,
                      )
                    ) {
                      removeProject(p.id);
                      removeCourse(p.id);
                      removeRuns(p.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
