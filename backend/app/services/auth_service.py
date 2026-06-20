# backend/app/services/auth_service.py
from datetime import timedelta
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token
from app.models import db, User

# Custom exceptions for authentication and registration flows
class DuplicateUserError(Exception):
    """Exception raised when a user tries to register with an already existing email or fullname."""
    pass

class InvalidCredentialsError(Exception):
    """Exception raised when login credentials verification fails."""
    pass

# Thread-safe in-memory set to store revoked JWT token IDs (jti)
# Note: For production deployments, this should be backed by Redis or a database table.
token_blocklist = set()

def register_user(Fullname, email, password):
    """
    Registers a new user by hashing their password and saving their details in the database.
    Explicitly hardcodes the assigned model role to 'citizen' by default.
    Checks for duplicates in email and Fullname.
    """
    if not Fullname or not email or not password:
        raise ValueError("Fullname, email, and password are required fields.")

    # Check if a user with the same email already exists
    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        raise DuplicateUserError("A user with this email address already exists.")

    # Check if a user with the same Fullname already exists
    existing_fullname = User.query.filter_by(Fullname=Fullname).first()
    if existing_fullname:
        raise DuplicateUserError("A user with this fullname/username already exists.")

    # Hash the password using werkzeug security
    password_hash = generate_password_hash(password)

    # Hardcode role to 'citizen' by default as required
    new_user = User(
        Fullname=Fullname,
        email=email,
        password_hash=password_hash,
        role='citizen'
    )

    db.session.add(new_user)
    db.session.commit()
    return new_user

def authenticate_user(email, password, remember_me):
    """
    Verifies user credentials. If remember_me is True, generates an Access token
    (15-min lifespan) and an extended long-lived Refresh token (30-day lifespan).
    Otherwise, generates an Access token (15-min lifespan) and a standard Refresh token (1-day lifespan).
    Embeds user ID and role in token identity claims.
    """
    if not email or not password:
        raise ValueError("Email and password are required fields.")

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        raise InvalidCredentialsError("Invalid email or password.")

    # Embed user ID and role in token claims
    # To satisfy PyJWT's constraint that the 'sub' claim must be a string,
    # we use the user ID string as identity and put the role/id in additional claims.
    identity = str(user.id)
    additional_claims = {
        "id": str(user.id),
        "role": user.role
    }

    # Dynamic token lifespan configurations
    access_expires = timedelta(minutes=15)
    refresh_expires = timedelta(days=30) if remember_me else timedelta(days=1)

    # Generate the access and refresh tokens
    access_token = create_access_token(
        identity=identity,
        additional_claims=additional_claims,
        expires_delta=access_expires
    )
    refresh_token = create_refresh_token(
        identity=identity,
        additional_claims=additional_claims,
        expires_delta=refresh_expires
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "Fullname": user.Fullname,
            "email": user.email,
            "role": user.role
        }
    }

def revoke_token(jti):
    """
    Adds a JWT token ID (jti) to the blocklist, effectively revoking it.
    """
    token_blocklist.add(jti)

def is_token_revoked(jti):
    """
    Checks if a JWT token ID (jti) has been blacklisted.
    """
    return jti in token_blocklist
