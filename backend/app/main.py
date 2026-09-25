from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import audit, auth, reservation_date_blocks, reservations, users
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.frontend_url).rstrip("/")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(reservation_date_blocks.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/health", tags=["infraestrutura"])
def health() -> dict[str, str]:
    return {"status": "ok"}
