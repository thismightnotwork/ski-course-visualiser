import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  COURSE_TYPES,
  COURSE_TYPE_LABELS,
  SURFACE_LABELS,
  SURFACE_TYPES,
  projectFormSchema,
  type ProjectForm,
} from '../domain/project';
import { useProjects } from '../store/projects';

const field = 'mt-1 w-full rounded border border-slate-400 bg-white p-2 dark:bg-slate-800';

export default function NewProject() {
  const navigate = useNavigate();
  const addProject = useProjects((s) => s.addProject);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      location: '',
      courseType: 'indoor',
      surfaceType: 'snow',
      description: '',
      date: new Date().toISOString().slice(0, 10),
      units: 'metres',
      notes: '',
    },
  });

  const onSubmit = (data: ProjectForm) => {
    const project = addProject(data);
    navigate(`/projects/${project.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      <h1 className="text-2xl font-bold">Create project</h1>
      <label className="block">
        Project name
        <input className={field} {...register('name')} />
        {errors.name && <span role="alert" className="text-red-600">{errors.name.message}</span>}
      </label>
      <label className="block">
        Location
        <input className={field} {...register('location')} />
      </label>
      <label className="block">
        Course type
        <select className={field} {...register('courseType')}>
          {COURSE_TYPES.map((t) => (
            <option key={t} value={t}>
              {COURSE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Surface type
        <select className={field} {...register('surfaceType')}>
          {SURFACE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SURFACE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Date
        <input type="date" className={field} {...register('date')} />
        {errors.date && <span role="alert" className="text-red-600">{errors.date.message}</span>}
      </label>
      <label className="block">
        Units
        <select className={field} {...register('units')}>
          <option value="metres">Metres</option>
          <option value="feet">Feet</option>
        </select>
      </label>
      <label className="block">
        Description
        <textarea className={field} rows={3} {...register('description')} />
      </label>
      <label className="block">
        Notes (optional)
        <textarea className={field} rows={3} {...register('notes')} />
      </label>
      <button type="submit" className="rounded bg-sky-700 px-4 py-2 text-white">
        Create project
      </button>
    </form>
  );
}
