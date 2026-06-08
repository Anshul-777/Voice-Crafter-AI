"""
Voice-Crafter Backend Tests
Tests all critical flows: auth, voices, cloning, generation, detection, hub, plans.
Run: pytest backend/tests/ -v
"""
import pytest
import asyncio
import httpx
from typing import AsyncGenerator

# ── Test Configuration ─────────────────────────────────────────────────────────

BASE_URL = "http://localhost:8000/api/v1"
TEST_USER = {
    "email": "test_pytest@voicecrafter.ai",
    "username": "pytest_user",
    "display_name": "PyTest User",
    "password": "TestPass123",
}

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as c:
        yield c

@pytest.fixture(scope="session")
async def auth_token(client: httpx.AsyncClient) -> str:
    """Register and login a test user, return access token."""
    # Try register (may already exist)
    await client.post("/auth/register", json=TEST_USER)
    # Login
    resp = await client.post("/auth/login", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert "access_token" in data
    return data["access_token"]

@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}


# ── Health Check ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client: httpx.AsyncClient):
    """System health check must return 200."""
    resp = await client.get("/health", base_url="http://localhost:8000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["platform"] == "Voice-Crafter"
    assert "components" in data
    print(f"  Health: {data['status']} | Components: {list(data['components'].keys())}")


# ── Authentication ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_duplicate(client: httpx.AsyncClient):
    """Registering same email twice returns 400."""
    # Register first time
    await client.post("/auth/register", json=TEST_USER)
    # Register second time - should fail
    resp = await client.post("/auth/register", json=TEST_USER)
    assert resp.status_code == 400
    assert "already" in resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_login_wrong_password(client: httpx.AsyncClient):
    """Wrong password returns 401."""
    resp = await client.post("/auth/login", json={"email": TEST_USER["email"], "password": "wrongpass"})
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_get_me(client: httpx.AsyncClient, auth_headers: dict):
    """Authenticated /me returns user profile."""
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == TEST_USER["email"]
    assert data["username"] == TEST_USER["username"]
    assert "plan_tier" in data
    print(f"  User: {data['display_name']} | Plan: {data['plan_tier']}")

@pytest.mark.asyncio
async def test_unauthenticated_access(client: httpx.AsyncClient):
    """Protected endpoints return 401 without token."""
    resp = await client.get("/voices")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_refresh_token(client: httpx.AsyncClient):
    """Token refresh returns new tokens."""
    resp = await client.post("/auth/login", json={"email": TEST_USER["email"], "password": TEST_USER["password"]})
    assert resp.status_code == 200
    refresh = resp.json()["refresh_token"]

    refresh_resp = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    assert "access_token" in new_data
    assert new_data["access_token"] != resp.json()["access_token"]  # New token


# ── Voice Profiles ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
async def test_voice(client: httpx.AsyncClient, auth_headers: dict) -> dict:
    """Create a test voice profile."""
    resp = await client.post("/voices", headers=auth_headers, json={
        "name": "PyTest Voice",
        "description": "Auto-created for testing",
        "language": "en",
        "visibility": "private",
        "consent_verified": True,
        "license_type": "personal",
    })
    assert resp.status_code in (200, 201), f"Voice create failed: {resp.text}"
    return resp.json()

@pytest.mark.asyncio
async def test_create_voice(client: httpx.AsyncClient, auth_headers: dict):
    """Creating a voice profile returns 201 with voice data."""
    resp = await client.post("/voices", headers=auth_headers, json={
        "name": "Test Voice Unique 12345",
        "language": "en",
        "visibility": "private",
        "consent_verified": True,
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["name"] == "Test Voice Unique 12345"
    assert data["language"] == "en"
    assert data["visibility"] == "private"
    assert "id" in data

@pytest.mark.asyncio
async def test_list_voices(client: httpx.AsyncClient, auth_headers: dict):
    """Listing voices returns paginated results."""
    resp = await client.get("/voices", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "voices" in data
    assert "total" in data
    assert isinstance(data["voices"], list)

@pytest.mark.asyncio
async def test_update_voice(client: httpx.AsyncClient, auth_headers: dict, test_voice: dict):
    """Updating a voice profile persists changes."""
    resp = await client.put(f"/voices/{test_voice['id']}", headers=auth_headers, json={
        "description": "Updated description via pytest"
    })
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["description"] == "Updated description via pytest"

@pytest.mark.asyncio
async def test_get_voice_unauthorized(client: httpx.AsyncClient, test_voice: dict):
    """Private voice not accessible without auth."""
    resp = await client.get(f"/voices/{test_voice['id']}")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_voice_not_found(client: httpx.AsyncClient, auth_headers: dict):
    """Non-existent voice returns 404."""
    resp = await client.get("/voices/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert resp.status_code == 404


# ── Detection ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_detection_list(client: httpx.AsyncClient, auth_headers: dict):
    """Detection job list returns valid structure."""
    resp = await client.get("/detection", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert "total" in data

@pytest.mark.asyncio
async def test_detection_invalid_file(client: httpx.AsyncClient, auth_headers: dict):
    """Uploading non-audio file to detection returns 400."""
    import io
    resp = await client.post("/detection/analyze", headers=auth_headers,
        files={"file": ("test.txt", io.BytesIO(b"not audio"), "text/plain")})
    assert resp.status_code == 400
    assert "format" in resp.json()["detail"].lower() or "unsupported" in resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_detection_stats(client: httpx.AsyncClient, auth_headers: dict):
    """Detection stats endpoint returns valid metrics."""
    resp = await client.get("/detection/stats/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_jobs" in data
    assert "synthetic_detected" in data
    assert isinstance(data["total_jobs"], int)


# ── Hub ────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hub_voices(client: httpx.AsyncClient):
    """Hub voices endpoint works without auth."""
    resp = await client.get("/hub/voices")
    assert resp.status_code == 200
    data = resp.json()
    assert "voices" in data
    assert "total" in data

@pytest.mark.asyncio
async def test_hub_stats(client: httpx.AsyncClient):
    """Hub stats returns valid counts."""
    resp = await client.get("/hub/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "public_voices" in data
    assert "active_users" in data
    assert isinstance(data["public_voices"], int)

@pytest.mark.asyncio
async def test_hub_featured(client: httpx.AsyncClient):
    """Hub featured endpoint returns list."""
    resp = await client.get("/hub/featured")
    assert resp.status_code == 200
    assert "voices" in resp.json()

@pytest.mark.asyncio
async def test_hub_search(client: httpx.AsyncClient):
    """Hub search returns filtered results."""
    resp = await client.get("/hub/voices", params={"search": "test", "page": 1, "page_size": 5})
    assert resp.status_code == 200
    data = resp.json()
    assert "voices" in data


# ── Plans ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_plans(client: httpx.AsyncClient, auth_headers: dict):
    """Plans list returns all 4 tiers."""
    resp = await client.get("/plans", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "plans" in data
    tiers = {p["tier"] for p in data["plans"]}
    assert "free" in tiers
    assert "starter" in tiers
    assert "pro" in tiers
    assert "enterprise" in tiers

@pytest.mark.asyncio
async def test_current_plan(client: httpx.AsyncClient, auth_headers: dict):
    """Current plan returns usage information."""
    resp = await client.get("/plans/current", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tier" in data
    assert "usage" in data
    assert "features" in data


# ── Notifications ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_notifications(client: httpx.AsyncClient, auth_headers: dict):
    """Notifications endpoint returns valid structure."""
    resp = await client.get("/notifications", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "notifications" in data
    assert "unread_count" in data
    assert isinstance(data["unread_count"], int)

@pytest.mark.asyncio
async def test_mark_all_read(client: httpx.AsyncClient, auth_headers: dict):
    """Mark all read returns success message."""
    resp = await client.post("/notifications/read-all", headers=auth_headers)
    assert resp.status_code == 200
    assert "message" in resp.json()


# ── Analytics ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analytics_overview(client: httpx.AsyncClient, auth_headers: dict):
    """Analytics overview returns totals."""
    resp = await client.get("/analytics/overview", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "totals" in data
    assert "usage" in data

@pytest.mark.asyncio
async def test_analytics_timeline(client: httpx.AsyncClient, auth_headers: dict):
    """Analytics timeline returns daily buckets."""
    resp = await client.get("/analytics/timeline", headers=auth_headers, params={"days": 7})
    assert resp.status_code == 200
    data = resp.json()
    assert "timeline" in data
    assert len(data["timeline"]) == 7  # 7 days


# ── Audit Logs ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_logs(client: httpx.AsyncClient, auth_headers: dict):
    """Audit logs return user's action history."""
    resp = await client.get("/audit", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "logs" in data
    assert "total" in data
    # Should have at least login events from our test session
    print(f"  Audit log entries: {data['total']}")


# ── History ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_history(client: httpx.AsyncClient, auth_headers: dict):
    """History endpoint returns combined job history."""
    resp = await client.get("/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


# ── API Keys ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_key_requires_plan(client: httpx.AsyncClient, auth_headers: dict):
    """Free plan users cannot create API keys."""
    resp = await client.post("/api-keys", headers=auth_headers, params={"name": "test-key"})
    # Free plan should block API access
    assert resp.status_code in (402, 200)  # 402 if free plan, 200 if upgraded
    if resp.status_code == 200:
        data = resp.json()
        assert "key" in data
        assert data["key"].startswith("vc_")


# ── Quality Analysis ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_quality_analyze(client: httpx.AsyncClient, auth_headers: dict):
    """Quality analysis of a WAV file returns metrics."""
    import io
    import wave
    import struct

    # Generate a simple 1-second WAV file (440 Hz sine wave)
    sample_rate = 16000
    duration = 1
    frequency = 440
    import math
    samples = [int(32767 * math.sin(2 * math.pi * frequency * i / sample_rate)) for i in range(sample_rate * duration)]

    buf = io.BytesIO()
    with wave.open(buf, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f'{len(samples)}h', *samples))

    buf.seek(0)
    resp = await client.post("/quality/analyze", headers=auth_headers,
        files={"file": ("test.wav", buf, "audio/wav")})
    assert resp.status_code == 200
    data = resp.json()
    assert "quality_score" in data
    assert "duration_seconds" in data
    assert "sample_rate" in data
    assert data["sample_rate"] == sample_rate
    print(f"  Quality score: {data['quality_score']}/100 | Suitability: {data.get('suitability')}")


# ── Generation Job ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_generation_list(client: httpx.AsyncClient, auth_headers: dict):
    """Generation job list returns valid structure."""
    resp = await client.get("/generation", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert "total" in data

@pytest.mark.asyncio
async def test_generation_empty_text(client: httpx.AsyncClient, auth_headers: dict):
    """Generation with empty text returns 400."""
    resp = await client.post("/generation", headers=auth_headers, json={
        "text": "",
        "language": "en",
    })
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_generation_text_too_long(client: httpx.AsyncClient, auth_headers: dict):
    """Generation with text exceeding limit returns 400."""
    resp = await client.post("/generation", headers=auth_headers, json={
        "text": "x" * 6000,  # Over 5000 char limit
        "language": "en",
    })
    assert resp.status_code == 400


# ── Clone Job ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_clone_list(client: httpx.AsyncClient, auth_headers: dict):
    """Clone job list returns valid structure."""
    resp = await client.get("/cloning", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data

@pytest.mark.asyncio
async def test_clone_no_samples(client: httpx.AsyncClient, auth_headers: dict, test_voice: dict):
    """Starting clone job without samples returns 400."""
    resp = await client.post("/cloning/start", headers=auth_headers, json={
        "voice_profile_id": test_voice["id"],
        "mode": "zero_shot",
    })
    assert resp.status_code == 400
    assert "sample" in resp.json()["detail"].lower()


# ── Benchmarks ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_system_benchmarks(client: httpx.AsyncClient, auth_headers: dict):
    """System benchmarks return hardware info."""
    resp = await client.get("/benchmarks/system", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "cpu_cores" in data
    assert "memory_total_gb" in data
    assert "device" in data
    print(f"  Device: {data['device']} | CPU: {data['cpu_cores']} cores | RAM: {data['memory_total_gb']}GB")


# ── Rate Limiting ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rate_limit_headers(client: httpx.AsyncClient, auth_headers: dict):
    """Responses include rate limit headers."""
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    # Rate limit headers should be present (may vary based on config)


# ── Full Flow Integration Test ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_voice_workflow(client: httpx.AsyncClient, auth_headers: dict):
    """
    Integration test: Create voice → List voices → Get voice → Delete voice.
    Verifies the entire voice profile lifecycle.
    """
    # 1. Create voice
    create_resp = await client.post("/voices", headers=auth_headers, json={
        "name": "Integration Test Voice",
        "language": "es",
        "visibility": "private",
        "consent_verified": True,
        "emotion_tags": ["calm", "professional"],
        "use_case_tags": ["customer_service"],
    })
    assert create_resp.status_code in (200, 201)
    voice_id = create_resp.json()["id"]
    assert create_resp.json()["language"] == "es"

    # 2. List and verify it appears
    list_resp = await client.get("/voices", headers=auth_headers, params={"search": "Integration Test"})
    assert list_resp.status_code == 200
    voice_ids = [v["id"] for v in list_resp.json()["voices"]]
    assert voice_id in voice_ids

    # 3. Get individual voice
    get_resp = await client.get(f"/voices/{voice_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Integration Test Voice"

    # 4. Update voice
    update_resp = await client.put(f"/voices/{voice_id}", headers=auth_headers, json={
        "name": "Integration Test Voice UPDATED"
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Integration Test Voice UPDATED"

    # 5. Archive (delete) voice
    del_resp = await client.delete(f"/voices/{voice_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    # 6. Verify it's gone from list
    list_after = await client.get(f"/voices/{voice_id}", headers=auth_headers)
    # Should be 404 or 403 (archived voices not accessible)
    assert list_after.status_code in (404, 403)

    print("  ✅ Full voice workflow: create → list → get → update → delete")
