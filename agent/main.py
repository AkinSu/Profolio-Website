from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from eye_agent import call_agent

app = FastAPI(title="Eye Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://akintunjisule.com"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    trigger: str
    question: Optional[str] = None
    history: Optional[list] = None


class ChatResponse(BaseModel):
    text: str
    eye: str
    brow: str
    blink_speed: str
    intensity: float


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        result = call_agent(req.trigger, req.question, req.history)
        return ChatResponse(
            text=result.get("text", "..."),
            eye=result.get("eye", "open"),
            brow=result.get("brow", "neutral"),
            blink_speed=result.get("blink_speed", "normal"),
            intensity=float(result.get("intensity", 0.5)),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
