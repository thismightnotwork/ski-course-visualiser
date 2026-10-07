from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'

def test_jobs_reject_get_and_bad_type():
    assert client.get('/jobs').status_code == 405
    response = client.post('/jobs', files={'file': ('test.txt', b'not-video', 'text/plain')})
    assert response.status_code == 415
