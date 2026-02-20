from fastapi import FastAPI
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

from agent import run_agent_stream
from tools import get_recovery_log, get_health_history, get_trace_log, reset_state

app = FastAPI(title="AgentSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str


@app.post("/ask")
async def ask_agent(request: AskRequest):
    async def event_stream():
        try:
            async for line in run_agent_stream(request.question):
                yield line
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/recovery-log")
async def recovery_log():
    return JSONResponse(content=get_recovery_log())


@app.get("/health-history")
async def health_history():
    return JSONResponse(content=get_health_history())


@app.get("/traces")
async def traces():
    return JSONResponse(content=get_trace_log())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agentsentinel", "version": "1.0.0"}


@app.post("/reset")
async def reset():
    reset_state()
    return {"reset": True, "message": "Agent state cleared."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
