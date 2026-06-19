# backend/app/models/__init__.py
from .user_models import db, User
from .waste_models import Classification, LowConfidenceAuditLog, MonthlyStat