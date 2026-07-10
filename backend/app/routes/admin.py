# backend/app/routes/admin.py
import csv
import io
import os
from functools import wraps
from datetime import datetime, timezone as datetime_timezone, timedelta
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from sqlalchemy import func
import pytz

# ReportLab core engine imports
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.models import db
from app.models.user_models import User
from app.models.waste_models import Classification, LowConfidenceAuditLog

admin_bp = Blueprint('admin', __name__)

def admin_required():
    """
    Custom decorator to enforce Role-Based Access Control (RBAC).
    Verifies that the user has a valid JWT and their role is set to 'admin'.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") == "admin":
                return fn(*args, **kwargs)
            else:
                return jsonify({"success": False, "error": "Administrator privilege required."}), 403
        return decorator
    return wrapper


def get_timezone_bounds(tz_name, filter_date_str=None):
    """
    Helper utility to convert naive UTC queries into localized operational bounds.
    """
    try:
        local_tz = pytz.timezone(tz_name)
    except Exception:
        local_tz = pytz.utc

    now_local = datetime.now(local_tz)
    
    if filter_date_str:
        try:
            parsed_date = datetime.strptime(filter_date_str, "%Y-%m-%d")
            # Anchor to the selected day's midnight
            local_target_start = local_tz.localize(datetime(parsed_date.year, parsed_date.month, parsed_date.day, 0, 0, 0))
            # Dynamic month anchor based on the selected date
            month_year = parsed_date.year
            month_val = parsed_date.month
        except ValueError:
            local_target_start = local_tz.localize(datetime(now_local.year, now_local.month, now_local.day, 0, 0, 0))
            month_year = now_local.year
            month_val = now_local.month
    else:
        local_target_start = local_tz.localize(datetime(now_local.year, now_local.month, now_local.day, 0, 0, 0))
        month_year = now_local.year
        month_val = now_local.month

    local_target_end = local_target_start + timedelta(days=1)
    
    # Dynamically calculated month bounds based on our anchor year and month values
    local_month_start = local_tz.localize(datetime(month_year, month_val, 1, 0, 0, 0))
    if month_val < 12:
        local_month_end = local_tz.localize(datetime(month_year, month_val + 1, 1, 0, 0, 0))
    else:
        local_month_end = local_tz.localize(datetime(month_year + 1, 1, 1, 0, 0, 0))

    return {
        "target_start_utc": local_target_start.astimezone(pytz.utc),
        "target_end_utc": local_target_end.astimezone(pytz.utc),
        "month_start_utc": local_month_start.astimezone(pytz.utc),
        "month_end_utc": local_month_end.astimezone(pytz.utc),
        "local_now": now_local,
        "anchor_date": local_target_start.date() # Added to easily trace back week offsets
    }

@admin_bp.route('/dashboard-summary', methods=['GET'])
@admin_required()
def get_dashboard_summary():
    """
    GET /api/admin/dashboard-summary
    Returns complete timezone-aware operational analytics metrics for the dashboard grid views.
    """
    try:
        # 1. Sync parameter key with frontend ('timezone' instead of 'tz')
        tz_name = request.args.get('timezone', 'UTC')
        filter_date_str = request.args.get('filter_date', '').strip()
        bounds = get_timezone_bounds(tz_name, filter_date_str)

        start_day = bounds["target_start_utc"]
        end_day = bounds["target_end_utc"]
        start_month = bounds["month_start_utc"]
        end_month = bounds["month_end_utc"]

        # 2. Base Volumetric Calculations
        total_today = Classification.query.filter(
            Classification.captured_at >= start_day, 
            Classification.captured_at < end_day
        ).count()
        
        total_month = Classification.query.filter(
            Classification.captured_at >= start_month, 
            Classification.captured_at < end_month
        ).count()

        # 3. Monthly Quality Performance Rates (Uncommented and safe)
        correct_month = Classification.query.filter(
            Classification.captured_at >= start_month, 
            Classification.captured_at < end_month, 
            Classification.is_low_confidence == False
        ).count()
        
        total_low_confidence_month = Classification.query.filter(
            Classification.captured_at >= start_month, 
            Classification.captured_at < end_month, 
            Classification.is_low_confidence == True
        ).count()

        # Safely compute percentages preventing division by zero errors
        correct_pct_month = round((correct_month / total_month * 100), 1) if total_month > 0 else 100.0
        incorrect_pct_month = round((total_low_confidence_month / total_month * 100), 1) if total_month > 0 else 0.0

        # Optional Placeholder rates for Today's metrics (keeps payload footprint safe)
        correct_today = Classification.query.filter(
            Classification.captured_at >= start_day, 
            Classification.captured_at < end_day, 
            Classification.is_low_confidence == False
        ).count()
        correct_pct_today = round((correct_today / total_today * 100), 1) if total_today > 0 else 100.0
        incorrect_pct_today = round(((total_today - correct_today) / total_today * 100), 1) if total_today > 0 else 0.0

        # 4. Dynamic Category Distribution (Aggregating real model outputs)
        cat_dist_today = db.session.query(
            Classification.predicted_category, func.count(Classification.id)
        ).filter(
            Classification.captured_at >= start_day, 
            Classification.captured_at < end_day
        ).group_by(Classification.predicted_category).all()

        cat_dist_month = db.session.query(
            Classification.predicted_category, func.count(Classification.id)
        ).filter(
            Classification.captured_at >= start_month, 
            Classification.captured_at < end_month
        ).group_by(Classification.predicted_category).all()

        today_map = {cat: count for cat, count in cat_dist_today if cat}
        month_map = {cat: count for cat, count in cat_dist_month if cat}

        # Color routing dictionary mapping standard root words to hex color tokens
        COLOR_THEME_MAP = {
            'plastic': '#00BFA5', 
            'organic': '#FF9100', 
            'paper': '#2979FF', 
            'glass': '#FFD600', 
            'metal': '#AA3BFF'
        }
        DEFAULT_COLOR = '#63FDD3'

        distribution_data = []
        # Union of all unique actual categories across both pools
        all_detected_categories = set(today_map.keys()).union(month_map.keys())

        for raw_cat in sorted(all_detected_categories):
            count_today = today_map.get(raw_cat, 0)
            count_month = month_map.get(raw_cat, 0)

            # Determine matching color token dynamically via structural substring lookup
            matched_color = DEFAULT_COLOR
            for root_word, color_hex in COLOR_THEME_MAP.items():
                if root_word in raw_cat.lower():
                    matched_color = color_hex
                    break

            distribution_data.append({
                "category": raw_cat,  # Dynamically passes "Recyclable Plastic" etc. to UI
                "count": count_today,
                "count_today": count_today,
                "count_month": count_month,
                "percentage": round((count_today / total_today * 100), 1) if total_today > 0 else 0.0,
                "percentage_month": round((count_month / total_month * 100), 1) if total_month > 0 else 0.0,
                "color": matched_color
            })

        # 5. Trailing 7 Days Operational Velocity Trends Matrix
        daily_trend_list = []
        weekday_names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

        # Dynamically find the Monday of the week belonging to the active anchor date.
        anchor_day_of_week = bounds["anchor_date"].weekday() # 0 = Monday, 6 = Sunday
        start_of_week = start_day - timedelta(days=anchor_day_of_week)

        for i in range(7):
            day_date = start_of_week + timedelta(days=i)
            next_day_date = day_date + timedelta(days=1)
            
            localized_day = day_date.replace(tzinfo=datetime_timezone.utc).astimezone(pytz.timezone(tz_name))
            dynamic_label = f"{weekday_names[i]} ({localized_day.strftime('%d/%m')})"  # e.g., "MON 01 Jan"

            day_success = Classification.query.filter(
                Classification.captured_at >= day_date, 
                Classification.captured_at < next_day_date, 
                Classification.is_low_confidence == False
            ).count()
            
            day_retry = Classification.query.filter(
                Classification.captured_at >= day_date, 
                Classification.captured_at < next_day_date, 
                Classification.is_low_confidence == True
            ).count()

            daily_trend_list.append({
                "label": dynamic_label,
                "successCount": day_success,
                "retryCount": day_retry
            })

        # 6. Structured Payload Return
        return jsonify({
            "success": True,
            "metrics": {
                "total_sorted_today": total_today,
                "total_sorted_month": total_month,
                "correct_percentage_today": correct_pct_today,
                "incorrect_percentage_today": incorrect_pct_today,
                "correct_percentage_month": correct_pct_month,
                "incorrect_percentage_month": incorrect_pct_month,
                "total_low_confidence_month": total_low_confidence_month,
                "category_distribution": distribution_data,
                "daily_trend": daily_trend_list
            }
        }), 200

    except Exception as e:
        return jsonify({
            "success": False, 
            "error": f"Internal metrics compilation engine error: {str(e)}"
        }), 500

@admin_bp.route('/audits', methods=['GET'])
@admin_required()
def get_low_confidence_audits():
    """
    GET /api/admin/audits
    Fetches filtered structural audit logs for the Workspace management module.
    """
    try:
        tz_name = request.args.get('tz', 'UTC')
        filter_date_str = request.args.get('filter_date') # Optional timeline query string parameter
        
        query = db.session.query(LowConfidenceAuditLog, Classification).join(
            Classification, LowConfidenceAuditLog.classification_id == Classification.id
        )

        if filter_date_str:
            bounds = get_timezone_bounds(tz_name, filter_date_str)
            query = query.filter(Classification.captured_at >= bounds["target_start_utc"], Classification.captured_at < bounds["target_end_utc"])

        audit_logs = query.order_by(Classification.captured_at.desc()).all()
        
        try:
            user_tz = pytz.timezone(tz_name)
        except Exception:
            user_tz = pytz.utc

        # Dynamic live calculation of the system's accuracy metrics
        month_bounds = get_timezone_bounds(tz_name, filter_date_str=filter_date_str)
        total_month_scans = Classification.query.filter(Classification.captured_at >= month_bounds["month_start_utc"], Classification.captured_at < month_bounds["month_end_utc"]).count()
        correct_month_scans = Classification.query.filter(Classification.captured_at >= month_bounds["month_start_utc"], Classification.captured_at < month_bounds["month_end_utc"], Classification.is_low_confidence == False).count()
        monthly_precision_score = round((correct_month_scans / total_month_scans * 100), 1) if total_month_scans > 0 else 100.0

        audits_list = []
        for audit, scan in audit_logs:
            localized_captured = scan.captured_at.replace(tzinfo=datetime_timezone.utc).astimezone(user_tz)
            time_str = localized_captured.strftime("%I:%M:%S %p")
            iso_date_str = localized_captured.strftime("%Y-%m-%d")

            audits_list.append({
                "id": audit.id,
                "classification_id": scan.id,
                "predicted_category": scan.predicted_category,
                "confidence_score": int(scan.confidence_score),
                "image_url": scan.image_url,
                "auto_generated_explanation": audit.auto_generated_explanation,
                "reviewed_by_admin": audit.reviewed_by_admin,
                "timestamp": time_str,
                "formatted_date": iso_date_str,
                "timeline": [
                    { "time": localized_captured.strftime("%H:%M"), "text": f"Detected edge classification payload drop ({int(scan.confidence_score)}% confidence score)." },
                    { "time": "In Review", "text": "Flagged for manual pipeline review verification." }
                ]
            })

        return jsonify({
            "success": True,
            "audits": audits_list,
            "monthly_accuracy_score": monthly_precision_score
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": f"Internal database logs retrieval sequence error: {str(e)}"}), 500


@admin_bp.route('/audits/<audit_id>', methods=['PUT'])
@admin_required()
def update_audit_resolution(audit_id):
    """
    PUT /api/admin/audits/<audit_id>
    Maintains manual explanation revisions, toggles review resolution states, and mirrors indicators.
    """
    try:
        data = request.get_json() or {}
        reviewed = data.get("reviewed_by_admin")
        explanation = data.get("auto_generated_explanation")

        audit = LowConfidenceAuditLog.query.get(audit_id)
        if not audit:
            return jsonify({"success": False, "error": "Target audit log record could not be found."}), 404

        if reviewed is not None:
            audit.reviewed_by_admin = bool(reviewed)
            # Sync update upstream classifier flag to cleanly transition items out of critical alerts
            if audit.classification:
                audit.classification.is_low_confidence = not bool(reviewed)

        if explanation is not None:
            audit.auto_generated_explanation = str(explanation)

        db.session.commit()
        return jsonify({"success": True, "message": "Audit log structural indicators synchronized successfully."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to update data payload execution structure: {str(e)}"}), 500


def build_monthly_pdf_buffer(tz_name="UTC", filter_date_str=None):
    """
    Shared structural engine logic compiling operational tracking records into professional ReportLab binary buffers.
    """
    bounds = get_timezone_bounds(tz_name, filter_date_str=filter_date_str)
    start_month = bounds["month_start_utc"]
    end_month = bounds["month_end_utc"]

    total_scans = Classification.query.filter(Classification.captured_at >= start_month, Classification.captured_at < end_month).count()
    low_confidence_count = Classification.query.filter(Classification.captured_at >= start_month, Classification.captured_at < end_month, Classification.is_low_confidence == True).count()
    correct_scans = total_scans - low_confidence_count
    precision_rate = round((correct_scans / total_scans * 100), 1) if total_scans > 0 else 100.0

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=24, leading=28, textColor=colors.HexColor("#080A1A"), spaceAfter=6)
    meta_style = ParagraphStyle('DocMeta', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor("#64748B"), spaceAfter=20)
    section_title = ParagraphStyle('SectionTitle', parent=styles['Heading2'], fontSize=14, leading=18, textColor=colors.HexColor("#1E293B"), spaceBefore=14, spaceAfter=8)
    cell_text = ParagraphStyle('CellText', parent=styles['Normal'], fontSize=9, leading=12, textColor=colors.HexColor("#334155"))
    header_text = ParagraphStyle('HeaderText', parent=styles['Normal'], fontSize=9, leading=12, bold=True, textColor=colors.white)

    # Document Header Elements
    story.append(Paragraph("HYSACAM Eco-Inference Analytics Report", title_style))
    report_month_display = bounds["anchor_date"].strftime('%B %Y')
    story.append(Paragraph(f"Monthly report generated for {report_month_display} | Evaluation Context Timezone: {tz_name}", meta_style))
    story.append(Spacer(1, 10))

    # KPI Performance Block Grid Table
    kpi_data = [
        [Paragraph("<b>Total Scans</b>", cell_text), Paragraph("<b>Resolved Items</b>", cell_text), Paragraph("<b>Precision Score (Accuracy)</b>", cell_text)],
        [Paragraph(str(total_scans), cell_text), Paragraph(str(correct_scans), cell_text), Paragraph(f"{precision_rate}%", cell_text)]
    ]
    kpi_table = Table(kpi_data, colWidths=[2.5*inch, 2.5*inch, 2.3*inch])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 20))

    # Categorized Breakdown Data Compilation Table
    story.append(Paragraph("Volumetric Breakdown Analysis", section_title))
    cat_distribution = db.session.query(Classification.predicted_category, func.count(Classification.id)).filter(Classification.captured_at >= start_month, Classification.captured_at < end_month).group_by(Classification.predicted_category).all()
    
    breakdown_rows = [[Paragraph("<b>Waste Category</b>", header_text), Paragraph("<b>Recorded Samples</b>", header_text), Paragraph("<b>Volume Allocation</b>", header_text)]]
    for cat, count in cat_distribution:
        allocation_pct = round((count / total_scans * 100), 1) if total_scans > 0 else 0.0
        breakdown_rows.append([Paragraph(str(cat), cell_text), Paragraph(str(count), cell_text), Paragraph(f"{allocation_pct}%", cell_text)])

    breakdown_table = Table(breakdown_rows, colWidths=[3.0*inch, 2.1*inch, 2.2*inch])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#080A1A")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(breakdown_table)

    doc.build(story)
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()


@admin_bp.route('/export-pdf', methods=['GET'])
@admin_required()
def export_monthly_pdf_stream():
    """
    GET /api/admin/export-pdf
    Compiles and streams a styled report overview containing metrics matching current execution loops.
    """
    try:
        tz_name = request.args.get('tz') or request.args.get('timezone') or 'UTC'
        filter_date_str = request.args.get('filter_date', '').strip()  # Optional timeline query string parameter
        pdf_data = build_monthly_pdf_buffer(tz_name, filter_date_str=filter_date_str)
        bounds = get_timezone_bounds(tz_name, filter_date_str=filter_date_str)
        
        anchor = bounds["anchor_date"]
        filename = f"wastedetect_analytics_report_{anchor.year}_{anchor.month:02d}.pdf"

        return Response(
            pdf_data,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to build system PDF template payload: {str(e)}"}), 500


def register_monthly_cron_jobs(scheduler_instance):
    """
    Configuration interface registering ReportLab document automation routines 
    executed on the last day of each calendar month.
    """
    def automatic_monthly_pdf_job():
        try:
            print("[APScheduler] Launching automated monthly compilation job context...")
            pdf_binary = build_monthly_pdf_buffer(tz_name="Africa/Douala")
            
            reports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'storage', 'reports'))
            os.makedirs(reports_dir, exist_ok=True)
            
            target_stamp = datetime.now().strftime("%Y_%m_%d")
            destination_filepath = os.path.join(reports_dir, f"hysacam_automated_report_{target_stamp}.pdf")
            
            with open(destination_filepath, "wb") as pdf_file:
                pdf_file.write(pdf_binary)
            print(f"[APScheduler] Auto-compiled layout report stored successfully at: {destination_filepath}")
        except Exception as cron_err:
            print(f"[APScheduler CRITICAL ERROR] Auto-compilation routine breakdown: {str(cron_err)}")

    # Triggers on the final calendar day of each month at 23:59:00
    scheduler_instance.add_job(
        id='automated_monthly_analytics_pdf',
        func=automatic_monthly_pdf_job,
        trigger='cron',
        day='last',
        hour=23,
        minute=59
    )

@admin_bp.route('/classifications/export', methods=['GET'])
@admin_required()
def export_classification_dataset():
    """
    GET /api/admin/classifications/export
    Streams validated local Cameroonian waste classification telemetry 
    as a structured CSV manifest for active learning and model retraining loops.
    """
    try:
        # 1. Fetch data payload using an outer join to capture human corrections,
        # fallback details, and the core low confidence flag from the model inference.
        query = db.session.query(
            Classification.id,
            Classification.predicted_category,
            Classification.confidence_score,
            Classification.is_low_confidence,  
            Classification.image_url,
            Classification.captured_at,
            LowConfidenceAuditLog.reviewed_by_admin,
            LowConfidenceAuditLog.auto_generated_explanation  
        ).outerjoin(
            LowConfidenceAuditLog, 
            Classification.id == LowConfidenceAuditLog.classification_id
        ).order_by(Classification.captured_at.desc())

        records = query.all()

        # 2. Define a generator function to stream rows line-by-line (Memory safe)
        def generate_csv_stream():
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write standardized machine learning metadata headers
            writer.writerow([
                "classification_id", 
                "image_url", 
                "predicted_label", 
                "confidence_score",
                "is_low_confidence",          
                "verified_by_human", 
                "auto_generated_explanation",  
                "captured_timestamp"
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            for rec in records:
                # Format boolean states clearly for data pipeline preprocessing scripts
                model_low_conf = "TRUE" if rec.is_low_confidence else "FALSE"
                is_verified = "TRUE" if rec.reviewed_by_admin else "FALSE"
                timestamp_str = rec.captured_at.strftime("%Y-%m-%d %H:%M:%S") if rec.captured_at else ""
                
                # Sanitize the explanation text string to protect CSV parsing structure
                explanation_clean = str(rec.auto_generated_explanation).replace("\n", " ").strip() if rec.auto_generated_explanation else "None"

                raw_url = rec.image_url or ""
                if raw_url and not raw_url.startswith(('http://', 'https://')):
                    bas_url = request.host_url.rstrip('/')
                    path_suffix = raw_url if raw_url.startswith('/') else f"/{raw_url}"
                    absolute_url = f"{bas_url}{path_suffix}"
                else:
                    absolute_url = raw_url

                # This wraps your absolute URL into an Excel / Google Sheets clickable link formula.
                clickable_link_formula = f'=HYPERLINK("{absolute_url}", "View Scan Image")' if absolute_url else "No Image Available"

                # 🛠️ Removed the redundant 'absolute_url' item to perfectly match the 8 defined headers
                writer.writerow([
                    rec.id,
                    clickable_link_formula,  # Maps directly to "image_url" header column
                    rec.predicted_category,
                    int(rec.confidence_score) if rec.confidence_score is not None else 0,
                    model_low_conf,
                    is_verified,
                    explanation_clean,
                    timestamp_str
                ])
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)

        # 3. Compile context headers ensuring clean download execution
        current_stamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
        filename = f"wastedetect_cameroon_dataset_{current_stamp}.csv"

        response = Response(generate_csv_stream(), mimetype='text/csv')
        response.headers.set("Content-Disposition", "attachment", filename=filename)
        return response

    except Exception as e:
        return jsonify({
            "success": False, 
            "error": f"Failed to compile and stream training data bundle: {str(e)}"
        }), 500