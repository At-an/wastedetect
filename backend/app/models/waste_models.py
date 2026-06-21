# backend/app/models/waste_models.py
import uuid
from datetime import datetime
from .user_models import db

class Classification(db.Model):
    __tablename__ = 'classifications'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # SET NULL on delete protects data logs if profile is deleted
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    image_url = db.Column(db.String(255), nullable=False) 
    predicted_category = db.Column(db.String(50), nullable=False) 
    confidence_score = db.Column(db.Float, nullable=False) 
    is_low_confidence = db.Column(db.Boolean, default=False, nullable=False) 
    # High-cardinality index for rapid Chart.js time-series dashboard filtering
    captured_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    audit_log = db.relationship('LowConfidenceAuditLog', backref='classification', uselist=False, cascade="all, delete-orphan")


class LowConfidenceAuditLog(db.Model):
    __tablename__ = 'low_confidence_audit_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    classification_id = db.Column(db.String(36), db.ForeignKey('classifications.id', ondelete='CASCADE'), nullable=False)
    auto_generated_explanation = db.Column(db.Text, nullable=True)
    reviewed_by_admin = db.Column(db.Boolean, default=False, nullable=False, index=True)


class MonthlyStat(db.Model):
    __tablename__ = 'monthly_stats'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    total_sorted = db.Column(db.Integer, default=0, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Composite Unique Constraint for high-load atomic concurrent updates
    __table_args__ = (
        db.UniqueConstraint('user_id', 'year', 'month', name='uq_user_monthly_stats'),
    )
    
    @classmethod
    def increment_stat(cls, user_id, timestamp=None):
        """
        Atomic counter modifier that tracks monthly activity for user dashboards.
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
            
        year = timestamp.year
        month = timestamp.month

        # Check for existing record or initialize a new row atomically
        stat = cls.query.filter_by(user_id=user_id, year=year, month=month).first()
        if not stat:
            stat = cls(user_id=user_id, year=year, month=month, total_sorted=0)
            db.session.add(stat)
        
        stat.total_sorted += 1
        stat.updated_at = datetime.utcnow()