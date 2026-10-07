import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../domain/course';
import type { Project } from '../domain/project';
import { applyProcessorJob, draftRunTiming, markerAt, normalisePoint, trackingToCourse } from '../domain/videoAnalysis';
import { createVideoAnalysis, validateVideoFile, VIDEO_TYPES, type VideoAnalysis } from '../domain/video';
import { useVideos } from '../store/video';
import { useRuns } from '../store/runs';
import { draftToRun, emptyDraft } from '../domain/runDraft';

const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';
const input = 'mt-1 rounded border border-slate-400 bg-white p-1 dark:bg-slate-800';
const PROCESSOR_URL = import.meta.env.VITE_VIDEO_PROCESSOR_URL ?? 'http://localhost:8000';

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
  const [processorEnabled, setProcessorEnabled] = useState(true);
  const saved = useVideos((s) => s.analyses[project.id] ?? []);
  const addAnalysis = useVideos((s) => s.add);
  const updateAnalysis = useVideos((s) => s.update);
  const removeAnalysis = useVideos((s) => s.remove);

  const loadFile = useCallback((file: File) => {
    const problem = validateVideoFile(file);
    if (problem) return setError(problem);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      try {
        const a = createVideoAnalysis(project.id, course.id, file);
        const enriched: VideoAnalysis = { ...a, durationSec: v.duration, width: v.videoWidth, height: v.videoHeight, status: 'idle', progress: 0, updatedAt: new Date().toISOString() };
        setAnalysis(enriched); addAnalysis(enriched); setFileUrl(url); setError(null);
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the video.'); }
    };
    v.onerror = () => setError('The video metadata could not be read.');
    v.src = url;
  }, [addAnalysis, course.id, project.id]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const current = analysis ?? (saved.length > 0 ? saved[saved.length - 1] : null);
  const path = useMemo(() => (current ? trackingToCourse(current, course) : []), [current, course]);
  const save = (next: VideoAnalysis) => { setAnalysis(next); updateAnalysis(next); };
  const mark = (kind: 'start' | 'finish') => { if (!current || !videoRef.current) return; const r = videoRef.current.getBoundingClientRect(); const p = normalisePoint(r.width / 2, r.height / 2, r.width, r.height); save({ ...current, [`${kind}Marker`]: markerAt(current, kind, videoRef.current.currentTime, p), updatedAt: new Date().toISOString() }); };
  const markGate = () => { if (!current || !videoRef.current || !selectedGate) return; const r = videoRef.current.getBoundingClientRect(); const p = normalisePoint(r.width / 2, r.height / 2, r.width, r.height); save({ ...current, gateMarkers: [...current.gateMarkers, markerAt(current, 'gate', videoRef.current.currentTime, p, Number(selectedGate))], updatedAt: new Date().toISOString() }); };
  const runProcessor = async () => {
    if (!current || !fileRef.current?.files?.[0]) { setMessage('Choose the video again before processing.'); return; }
    const file = fileRef.current.files[0];
    setMessage('Uploading video to the local processor…');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`${PROCESSOR_URL}/jobs`, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`Processor upload failed (${response.status}).`);
      const initial = await response.json();
      let job = initial;
      save({ ...current, processorJobId: job.id, status: 'queued', progress: 0 });
      while (job.status === 'queued' || job.status === 'processing') {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const poll = await fetch(`${PROCESSOR_URL}/jobs/${job.id}`);
        if (!poll.ok) throw new Error(`Processor polling failed (${poll.status}).`);
        job = await poll.json();
        save(applyProcessorJob(current, job));
        setMessage(`Processing: ${Math.round(job.progress * 100)}%`);
      }
      if (job.status === 'completed') setMessage('Tracking complete. Review the confidence and markers before generating a run.');
      else setMessage(job.error ?? `Processor status: ${job.status}`);
    } catch (e) {
      setProcessorEnabled(false);
      setMessage(e instanceof Error ? `${e.message} You can still use manual markers.` : 'Local processor unavailable.');
    }
  };
  const cancelProcessor = async () => { if (!current?.processorJobId) return; await fetch(`${PROCESSOR_URL}/jobs/${current.processorJobId}/cancel`, { method: 'POST' }).catch(() => undefined); setMessage('Cancellation requested.'); };
  const generateRun = () => {
    if (!current) return;
    const total = draftRunTiming(current);
    if (total === null) return setMessage('Mark both the video start and finish before generating a run.');
    const draft = emptyDraft(new Date().toISOString().slice(0, 10)); draft.skier = skier; draft.total = String(total); draft.notes = 'Generated from local video analysis and manual markers. Tracking is approximate and requires review.'; draft.splits = current.gateMarkers.map((m) => ({ id: crypto.randomUUID(), gate: String(m.gateNumber), time: String(m.timeSec - (current.startMarker?.timeSec ?? 0)) }));
    const result = draftToRun(draft, { projectId: project.id, courseId: course.id, units: project.units });
    if (!result.ok) setMessage(result.errors.join('; ')); else { useRuns.getState().addRun(result.run); setMessage('Draft run generated. Review it in the Runs tab.'); }
  };

  return <section className='space-y-3'>
    {!fileUrl && <div className='cursor-pointer rounded border-2 border-dashed border-slate-400 p-8 text-center' onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}><h2 className='font-semibold'>Upload a skiing video</h2><p className='text-sm'>The local OpenCV processor analyses the video on your computer. MP4, MOV or WebM up to 500 MB.</p></div>}
    <input ref={fileRef} type='file' accept={VIDEO_TYPES.join(',')} className='hidden' onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) loadFile(f); }} />
    {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
    {fileUrl && current && <>
      <div className='flex flex-wrap gap-2'><button type='button' className={btn} disabled={!processorEnabled || current.status === 'processing'} onClick={runProcessor}>Analyse video locally</button><button type='button' className={btn} disabled={current.status !== 'processing'} onClick={cancelProcessor}>Cancel processing</button><button type='button' className={btn} onClick={() => mark('start')}>Mark start</button><button type='button' className={btn} onClick={() => mark('finish')}>Mark finish</button><select aria-label='Gate to mark' className={input} value={selectedGate} onChange={(e) => setSelectedGate(e.target.value)}><option value=''>Gate</option>{course.elements.filter((e) => e.number !== null).map((e) => <option key={e.id} value={e.number as number}>Gate {e.number}</option>)}</select><button type='button' className={btn} disabled={!selectedGate} onClick={markGate}>Mark gate</button></div>
      <video ref={videoRef} src={fileUrl} controls className='max-h-[60vh] w-full rounded border border-slate-400' />
      <p className='text-xs'>Status: {current.status}; progress: {Math.round(current.progress * 100)}%; tracking confidence: {Math.round(current.confidence * 100)}%. Local analysis is an estimate.</p>
      <div className='rounded border border-amber-500 p-3 text-sm'><p>Tracking samples: {current.tracking.length}. Course path points: {path.length}.</p><p>Confidence and path accuracy depend on camera view, lighting, occlusion and calibration. This is not technique diagnosis or a competition-legal result.</p></div>
      <div className='flex flex-wrap items-center gap-2'><label className='text-sm'>Skier ID <input className={input} value={skier} onChange={(e) => setSkier(e.target.value)} /></label><button type='button' className={btn} onClick={generateRun}>Generate draft run</button><button type='button' className={btn} onClick={() => { if (window.confirm('Delete this video analysis?')) { removeAnalysis(project.id, current.id); setAnalysis(null); setFileUrl(null); } }}>Delete analysis</button></div>
    </>}
    {message && <p role='status' className='text-sm'>{message}</p>}
  </section>;
}
