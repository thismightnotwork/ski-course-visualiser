import { useRef, useState } from 'react';
import type { Course } from '../domain/course';
import {
  exportCourseJson,
  exportElementsCsv,
  parseCourseJson,
  parseElementsCsv,
} from '../domain/exchange';
import type { Project } from '../domain/project';
import { useCourses } from '../store/courses';

const MAX_BYTES = 2 * 1024 * 1024;
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'course';

export default function ImportExportPanel({
  project,
  course,
}: {
  project: Project;
  course: Course;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setMessage({ ok: false, text: 'File is larger than 2 MB.' });
      return;
    }
    const text = await file.text();
    const name = file.name.toLowerCase();
    const actions = useCourses.getState();
    if (name.endsWith('.json')) {
      const r = parseCourseJson(text, project.id);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      if (!window.confirm('Replace the whole course with this file? You can undo this.')) return;
      const ok = actions.replaceCourse(project.id, r.value);
      setMessage({ ok, text: ok ? 'Course imported.' : 'Import was rejected.' });
    } else if (name.endsWith('.csv')) {
      const r = parseElementsCsv(text);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      if (!window.confirm(`Replace all elements with ${r.value.length} from this CSV? You can undo.`))
        return;
      const ok = actions.replaceElements(project.id, r.value);
      setMessage({ ok, text: ok ? `${r.value.length} elements imported.` : 'Import was rejected.' });
    } else {
      setMessage({ ok: false, text: 'Choose a .json or .csv file.' });
    }
  };

  return (
    <section className="space-y-2 rounded border border-slate-400 p-3">
      <h2 className="font-semibold">Import / export</h2>
      <p className="text-xs">Files always use metres. Importing replaces the course and can be undone.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={() =>
            download(
              `${slug(project.name)}.course.json`,
              exportCourseJson(course, { name: project.name, units: project.units }),
              'application/json',
            )
          }
        >
          Export JSON
        </button>
        <button
          type="button"
          className={btn}
          onClick={() =>
            download(`${slug(project.name)}.elements.csv`, exportElementsCsv(course), 'text/csv')
          }
        >
          Export CSV
        </button>
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
          Import file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          aria-label="Import course file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onFile(f);
          }}
        />
      </div>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm' : 'text-sm text-red-600'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
