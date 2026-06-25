# backend/app/routes/analytics.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from app.models import db
from app.models.waste_models import Classification

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_impact_summary():
    current_user_id = get_jwt_identity()

    try:
        # 1. Fetch total counts
        total_scans = Classification.query.filter_by(user_id=current_user_id).count()

        # 2. Compute category distributions
        category_distribution = db.session.query(
            Classification.predicted_category,
            func.count(Classification.id).label('count')
        ).filter(Classification.user_id == current_user_id)\
         .group_by(Classification.predicted_category).all()

        distribution_data = []
        for cat, count in category_distribution:
            distribution_data.append({
                "category": cat,
                "count": count,
                "percentage": round((count / total_scans * 100), 1) if total_scans > 0 else 0
            })

        # 4. UTC-STANDARDIZED TIME ROLLING STREAK ENGINE
        # Pull distinct capture dates directly since columns are written uniformly in UTC
        scan_date_records = db.session.query(
            func.date(Classification.captured_at).label('utc_date')
        ).filter(Classification.user_id == current_user_id)\
         .group_by('utc_date')\
         .order_by(db.desc('utc_date')).all()

        # Convert date objects into a clean comparison set
        active_scan_days = {str(row.utc_date) for row in scan_date_records}
        
        # Calculate trailing tracking anchor lines using the identical standard clock reference
        utc_now = datetime.now(timezone.utc).date()
        utc_yesterday = utc_now - timedelta(days=1)
        
        streak_count = 0
        
        # Streak remains live if an entry exists for UTC today or UTC yesterday
        if str(utc_now) in active_scan_days or str(utc_yesterday) in active_scan_days:
            # Anchor evaluation pointer at the highest active historical baseline
            current_eval_date = utc_now if str(utc_now) in active_scan_days else utc_yesterday
            
            while str(current_eval_date) in active_scan_days:
                streak_count += 1
                current_eval_date -= timedelta(days=1) # Chronologically step back 1 day

        return jsonify({
            "success": True,
            "metrics": {
                "total_items_sorted": total_scans,
                "active_streak_days": streak_count,
                "distribution": distribution_data
            }
        }), 200

    except Exception as err:
        print(f"Timezone streak evaluation exception: {err}")
        return jsonify({"success": False, "error": "Could not execute rolling metrics evaluation."}), 500