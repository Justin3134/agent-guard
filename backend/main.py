from fastapi import FastAPI
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import os
import time
import asyncio
import logging

from prism_agents import run_prism, dd_enabled
from neo4j_client import prism_graph

logger = logging.getLogger("prism.api")

app = FastAPI(title="Prism API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic models ─────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


# ─── Core endpoints ──────────────────────────────────────────────────────────

@app.post("/ask")
async def ask(body: ResearchRequest):
    session_id = body.session_id or f"prism_{int(time.time())}"

    async def event_stream():
        try:
            async for event in run_prism(body.question, session_id):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0)
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'agent': 'system', 'data': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/graph/{session_id}")
async def get_graph(session_id: str):
    prism_graph.set_session(session_id)
    return JSONResponse(content=prism_graph.get_graph_data())


@app.get("/api/findings/{session_id}")
async def get_findings(session_id: str):
    prism_graph.set_session(session_id)
    return JSONResponse(content=prism_graph.get_all_findings())


@app.post("/api/reset-session/{session_id}")
async def reset_session(session_id: str):
    prism_graph.set_session(session_id)
    prism_graph.clear_session()
    return {"cleared": True, "session_id": session_id}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "prism", "version": "1.0.0"}


@app.get("/datadog-status")
async def datadog_status():
    return {
        "enabled": dd_enabled,
        "app_name": "prism",
        "site": os.getenv("DD_SITE", "datadoghq.com"),
        "dashboard_url": f"https://app.{os.getenv('DD_SITE', 'datadoghq.com')}/llm/traces",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
