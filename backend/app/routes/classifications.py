# backend/app/routes/classifications.py
import io
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import cloudinary.uploader
from app.models import db
from app.models.waste_models import Classification, LowConfidenceAuditLog, MonthlyStat
from app.services.yolo_service import yolo_service

classifications_bp = Blueprint('classifications', __name__)

def process_and_persist_scan(image_bytes, user_id, captured_time=None):
    """
    Core atomic operations engine. Runs OpenVINO inference, uploads image binary
    to Cloudinary, flags low-confidence files, and commits records to SQL.
    """
    if not captured_time:
        captured_time = datetime.utcnow()

    # 1. Compute Inference using OpenVINO Engine
    inference = yolo_service.run_inference(image_bytes)
    category = inference.get("predicted_category", "Unclassified Material")
    confidence = inference.get("confidence", 0.0)
    
    # Evaluate confidence metrics (flag anything under 50% for human validation)
    is_low = confidence < 50.0 or category == "Unclassified Material"

    # 2. Upload raw image binary data directly to Cloudinary
    file_stream = io.BytesIO(image_bytes)
    upload_result = cloudinary.uploader.upload(
        file_stream,
        folder=f"wastedetect/scans/{user_id}",
        public_id=f"scan_{int(captured_time.timestamp())}",
        overwrite=False,
        resource_type="image"
    )
    secure_url = upload_result.get('secure_url', 'https://images.cloudinary.com/placeholder.png')

    # 3. Commit the new classification log entry to the database
    new_scan = Classification(
        user_id=user_id,
        image_url=secure_url,
        predicted_category=category,
        confidence_score=confidence,
        is_low_confidence=is_low,
        captured_at=captured_time
    )
    db.session.add(new_scan)

    # Explicitly flush the transaction session to allocate 
    # and lock down new)scan.id permanently in SQLite prior to running any model subsequeries.
    db.session.flush()
    
    # 4. If the machine learning assessment is low-confidence, append an audit trace row
    if is_low:
        audit_trail = LowConfidenceAuditLog(
            classification_id=new_scan.id,
            auto_generated_explanation=f"Low operational mapping metrics calculated ({confidence}%). Requires visual confirmation from human admin review systems."
        )
        db.session.add(audit_trail)

    # 5. Increment your rolling statistics ledger
    MonthlyStat.increment_stat(user_id, timestamp=captured_time)
    db.session.commit()

    return {
        "id": new_scan.id,
        "predicted_category": category,
        "confidence": confidence,
        "image_url": secure_url,
        "tip": inference.get("tip"),
        "monthly_impact_message": inference.get("monthly_impact_message")
    }


@classifications_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_waste_scan():
    """
    Live Online Ingress Point: Processes an incoming image file immediately and saves it.
    """
    current_user_id = get_jwt_identity()
    
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "No file stream payload found under 'image' key."}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({"success": False, "error": "Target filename parameter missing or null."}), 400

    try:
        image_data = file.read()
        
        # Execute the database persistence pipeline
        result_data = process_and_persist_scan(image_data, current_user_id)
        
        return jsonify({
            "success": True,
            "data": result_data
        }), 200

    except Exception as err:
        db.session.rollback()
        print(f"Classification upload route breakdown: {err}")
        return jsonify({"success": False, "error": "Internal classification processing failure."}), 500

@classifications_bp.route('/history', methods=['GET'])
@jwt_required()
def get_user_classification_history():
    """
    Retrieves history logs for the specific active user, sorted chronologically.
    """
    current_user_id = get_jwt_identity()
    try:
        scans = Classification.query.filter_by(user_id=current_user_id)\
                                    .order_by(Classification.captured_at.desc()).limit(20).all()
        
        scan_history_list = []
        for item in scans:
            scan_history_list.append({
                "id": item.id,
                "image_url": item.image_url,
                "predicted_category": item.predicted_category,
                "confidence_score": item.confidence_score,
                "captured_at": item.captured_at.isoformat()
            })
            
        return jsonify({"success": True, "scans": scan_history_list}), 200
    except Exception as err:
        print(f"History retrieval error: {err}")
        return jsonify({"success": False, "error": "Internal ledger query execution error."}), 500