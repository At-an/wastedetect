# backend/app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity, create_access_token, create_refresh_token
from datetime import timedelta
from app.services.auth_service import (
    register_user,
    authenticate_user,
    revoke_token,
    DuplicateUserError,
    InvalidCredentialsError
)

# Initialize the Blueprint for authentication routes
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    POST /register: Registers a new user.
    Expects a JSON payload with 'Fullname', 'email', and 'password'.
    Returns 201 Created on success, 409 Conflict if user already exists,
    or 400 Bad Request for missing/invalid fields.
    """
    data = request.get_json() or {}
    
    fullname = data.get('Fullname')
    email = data.get('email')
    password = data.get('password')

    if not fullname or not email or not password:
        return jsonify({"error": "Fullname, email, and password are required fields."}), 400

    try:
        user = register_user(fullname, email, password)
        return jsonify({
            "message": "User registered successfully.",
            "user": {
                "id": user.id,
                "Fullname": user.Fullname,
                "email": user.email,
                "role": user.role
            }
        }), 201
    except DuplicateUserError as e:
        return jsonify({"error": str(e)}), 409
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    POST /login: Authenticates a user and issues access & refresh tokens.
    Expects a JSON payload with 'email', 'password', and optional 'remember_me'.
    Returns 200 OK with tokens on success, 401 Unauthorized for invalid credentials,
    or 400 Bad Request for missing parameters.
    """
    data = request.get_json() or {}
    
    email = data.get('email')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    if not email or not password:
        return jsonify({"error": "Email and password are required fields."}), 400

    try:
        auth_data = authenticate_user(email, password, remember_me)
        return jsonify({
            "message": "Logged in successfully.",
            "access_token": auth_data["access_token"],
            "refresh_token": auth_data["refresh_token"],
            "user": auth_data["user"]
        }), 200
    except InvalidCredentialsError as e:
        return jsonify({"error": str(e)}), 401
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred during login."}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    POST /refresh: Rotates tokens.
    Accepts a valid refresh token via the Authorization header,
    revokes the old refresh token, and returns a fresh access & refresh token pair.
    """
    try:
        # Retrieve identity (user ID) from the current refresh token
        identity = get_jwt_identity()
        
        # Extract the role from the current token's claims to forward it
        claims = get_jwt()
        role = claims.get("role", "citizen")
        
        # Revoke the old refresh token (token rotation security)
        jti = claims["jti"]
        revoke_token(jti)

        # Create new tokens
        access_expires = timedelta(minutes=15)
        refresh_expires = timedelta(days=30)  # Refresh token rotation issues standard 30-day lifetime

        additional_claims = {
            "id": identity,
            "role": role
        }

        new_access_token = create_access_token(
            identity=identity,
            additional_claims=additional_claims,
            expires_delta=access_expires
        )
        new_refresh_token = create_refresh_token(
            identity=identity,
            additional_claims=additional_claims,
            expires_delta=refresh_expires
        )

        return jsonify({
            "access_token": new_access_token,
            "refresh_token": new_refresh_token
        }), 200
    except Exception as e:
        return jsonify({"error": "Failed to rotate tokens."}), 400


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    POST /logout: Revokes the user's active access token.
    Destroys the session on the server by adding the access token JTI to the blocklist.
    """
    try:
        jti = get_jwt()["jti"]
        revoke_token(jti)
        return jsonify({"message": "Successfully logged out."}), 200
    except Exception as e:
        return jsonify({"error": "Failed to log out."}), 400

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    GET /profile: Fetches credentials for the currently authenticated session.
    Accepts a valid access token via the Authorization Bearer header.
    Returns 200 OK with the dynamic user metrics on success,
    or 404 Not Found if the underlying database record is missing.
    """
    try:
        # Extract the user identity (ID) injected during token authorization
        user_id = get_jwt_identity()

        # Query the database model context using your model configurations
        # If your app structure abstracts this, you can replace this line with:
        # from app.services.auth_service import get_user_by_id; user = get_user_by_id(user_id)
        from app.models import User 
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User profile record could not be found."}), 404

        # Return a structured payload matching the frontend attributes
        return jsonify({
            "success": True,
            "user": {
                "full_name": getattr(user, 'Fullname') or getattr(user, 'full_name'),
                "email": user.email,
                "created_at": user.created_at.isoformat() if hasattr(user.created_at, 'isoformat') else str(user.created_at)
            }
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred while retrieving profile data."}), 500
