from .trackers import router as trackers_router
from .analytics import router as analytics_router
from fastapi import APIRouter

router = APIRouter()
router.include_router(trackers_router)
router.include_router(analytics_router)
