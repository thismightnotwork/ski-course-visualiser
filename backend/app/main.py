from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from .models import VideoJob
from .processor import JobManager
from pathlib import Path
import os
app = FastAPI(title='SkiCourse Visualiser Local Video Processor', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(','), allow_methods=['*'], allow_headers=['*'])
manager = JobManager(Path(os.getenv('VIDEO_STORAGE', '/tmp/scv-video-jobs'))); MAX_BYTES = 500 * 1024 * 1024
@app.get('/health')
def health(): return {'status': 'ok'}
@app.post('/jobs', response_model=VideoJob)
async def create_job(file: UploadFile = File(...)):
    if file.content_type not in {'video/mp4', 'video/quicktime', 'video/webm'}: raise HTTPException(415, 'Use MP4, MOV or WebM.')
    data = await file.read()
    if not data or len(data) > MAX_BYTES: raise HTTPException(413, 'Video is empty or larger than 500 MB.')
    return manager.create(file.filename or 'video', data)
@app.get('/jobs/{job_id}', response_model=VideoJob)
def get_job(job_id: str):
    job = manager.get(job_id)
    if job is None: raise HTTPException(404, 'Job not found.')
    return job
@app.post('/jobs/{job_id}/cancel', response_model=VideoJob)
def cancel_job(job_id: str):
    if not manager.cancel(job_id): raise HTTPException(409, 'Job cannot be cancelled.')
    job = manager.get(job_id)
    if job is None: raise HTTPException(404, 'Job not found.')
    return job
