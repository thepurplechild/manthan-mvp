from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import ingestion, recommendations

app = FastAPI(title="Manthan API", version="0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router, prefix="/api/ingestions", tags=["ingestions"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["recommendations"])

