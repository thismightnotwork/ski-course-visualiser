import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../domain/course';
import type { Project } from '../domain/project';
import { draftRunTiming, markerAt, normalisePoint, trackingToCourse, autoTrackPlaceholder } from '../domain/videoAnalysis';
import { createVideoAnalysis, validateVideoFile, VIDEO_TYPES, type VideoAnalysis } from '../domain/video';
import { useVideos } from '../store/video';
import { useRuns } from '../store/runs';
import { draftToRun, emptyDraft } from '../domain/runDraft';

const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';
const input = 'mt-1 rounded border border-slate-400 bg-white p-1 dark:bg-slate-800';

export default function VideoAnalysisView({ project, course }: { project: Project; course: Course }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlRef = useRef<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGate, setSelectedGate] = useState('');
  const [skier, setSkier] = useState('Video skier (review needed)');
  const [message, setMessage] = useState('');
  const saved = useVideos((s) => s.analyses[project.id] ?? []);
  const addAnalysis = useVideos((s) => s.add);
  const updateAnalysis = useVideos((s) => s.update);
  const removeAnalysis = useVideos((s) => s.remove);

  const loadFile = useCallback((file: File) => {
    const problem = validateVideoFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      try {
        const a = createVideoAnalysis(project.id, course.id, file);
        const enriched: VideoAnalysis = {
          ...a,
          durationSec: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
          status: 'idle',
          progress: 0,
          updatedAt: new Date().toISOString(),
        };
        setAnalysis(enriched);
        addAnalysis(enriched);
        setFileUrl(url);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not read the video.');
      }
    };
    v.onerror = () => setError('The video metadata could not be read.');
    v.src = url;
  }, [addAnalysis, course.id, project.id]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const current = analysis ?? (saved.length > 0 ? saved[saved.length - 1] : null);
  const path = useMemo(() => (current ? trackingToCourse(current, course) : []), [current, course]);

  const save = (next: VideoAnalysis) => {
    setAnalysis(next);
    updateAnalysis(next);
  };

  const mark = (kind: 'start' | 'finish') => {
    if (!current || !videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const p = normalisePoint(rect.width / 2, rect.height / 2, rect.width, rect.height);
    save({ ...current, [`${kind}Marker`]: markerAt(current, kind, videoRef.current.currentTime, p), updatedAt: new Date().toISOString() });
  };

  const markGate = () => {
    if (!current || !videoRef.current || !selectedGate) return;
    const rect = videoRef.current.getBoundingClientRect();
    const p = normalisePoint(rect.width / 2, rect.height / 2, rect.width, rect.height);
    const marker = markerAt(current, 'gate', videoRef.current.currentTime, p, Number(selectedGate));
    save({ ...current, gateMarkers: [...current.gateMarkers, marker], updatedAt: new Date().toISOString() });
  };

  const process = () => {
    if (!current) return;
    const tracked = autoTrackPlaceholder({ ...current, status: 'tracking', progress: 0.5 });
    save(tracked);
    setMessage('Draft tracking path created with confidence 0. This is a placeholder until a real detector is connected.');
  };

  const generateRun = () => {
    if (!current) return;
    const total = draftRunTiming(current);
    if (total === null) {
      setMessage('Mark both the video start and finish before generating a run.');
      return;
    }
    const draft = emptyDraft(new Date().toISOString().slice(0, 10));
    draft.skier = skier;
    draft.total = String(total);
    draft.notes = 'Generated from video markers. Tracking is approximate and requires manual review.';
    draft.splits = current.gateMarkers.map((m) => ({ id: crypto.randomUUID(), gate: String(m.gateNumber), time: String(m.timeSec - (current.startMarker?.timeSec ?? 0)) }));
    const result = draftToRun(draft, { projectId: project.id, courseId: course.id, units: project.units });
    if (!result.ok) setMessage(result.errors.join('; '));
    else {
      useRuns.getState().addRun(result.run);
      setMessage('Draft run generated. Review it in the Runs tab before relying on it.');
    }
  };

  return (
    <section className='space-y-3'>
      {!fileUrl && <div className='cursor-pointer rounded border-2 border-dashed border-slate-400 p-8 text-center' onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}><h2 className='font-semibold'>Upload a skiing video</h2><p className='text-sm'>MP4, MOV or WebM up to 500 MB. The file is kept in this browser and not shared automatically.</p></div>}
      <input ref={fileRef} type='file' accept={VIDEO_TYPES.join(',')} className='hidden' onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) loadFile(f); }} />
      {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
      {fileUrl && current && <>
        <div className='flex flex-wrap gap-2'><button type='button' className={btn} onClick={process}>Create approximate tracking draft</button><button type='button' className={btn} onClick={() => mark('start')}>Mark start at current frame</button><button type='button' className={btn} onClick={() => mark('finish')}>Mark finish at current frame</button><select aria-label='Gate to mark' className={input} value={selectedGate} onChange={(e) => setSelectedGate(e.target.value)}><option value=''>Gate</option>{course.elements.filter((e) => e.number !== null).map((e) => <option key={e.id} value={e.number as number}>Gate {e.number}</option>)}</select><button type='button' className={btn} disabled={!selectedGate} onClick={markGate}>Mark gate</button></div>
        <video ref={videoRef} src={fileUrl} controls className='max-h-[60vh] w-full rounded border border-slate-400' />
        <p className='text-xs'>Status: {current.status}; confidence: {Math.round(current.confidence * 100)}%. Markers are manual unless explicitly labelled otherwise.</p>
        <div className='rounded border border-amber-500 p-3 text-sm'><p>Tracking path points: {current.tracking.length}. Confidence is deliberately 0 until a real detector is added.</p>{path.length > 0 && <p>Approximate course path points: {path.length}.</p>}<p>Do not treat this as technique diagnosis, biomechanical measurement or a competition-legal result.</p></div>
        <div className='flex flex-wrap items-center gap-2'><label className='text-sm'>Skier ID <input className={input} value={skier} onChange={(e) => setSkier(e.target.value)} /></label><button type='button' className={btn} onClick={generateRun}>Generate draft run</button><button type='button' className={btn} onClick={() => { if (window.confirm('Delete this video analysis?')) { removeAnalysis(project.id, current.id); setAnalysis(null); setFileUrl(null); } }}>Delete analysis</button></div>
      </>}
      {message && <p role='status' className='text-sm'>{message}</p>}
    </section>
  );
}
