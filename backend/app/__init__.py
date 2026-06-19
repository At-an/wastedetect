# backend/app/__init__.py
import os
from flask import Flask
from flask_migrate import Migrate
from app.models import db  # Imports our unified package from app/models/__init__.py

migrate = Migrate()

def create_app():
    app = Flask(__name__)

    # Base directory calculation to dynamically pinpoint the watedetect.db file
    base_dir = os.path.abspath(os.path.dirname(__path__[0]))

    # Development vs Production Environment Configuration Switch
    # If DATABASE_URL exists (set automatically by Railway), use PostgreSQL. Otherwise, use local SQLite.
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        # Quick fix for older production environments where production URLs start with 'postgres://' instead of 'postgresql://'
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(base_dir, "wastedetect.db")}'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions with the application context
    db.init_app(app)
    
    # We enforce your preference here: nesting the migrations folder cleanly inside backend/
    migrate.init_app(app, db, directory=os.path.join(base_dir, 'migrations'))

    # Temporary route to verify our environment works cleanly
    @app.route('/health', methods=['GET'])
    def health_check():
        return {"status": "healthy", "environment": "production" if database_url else "development"}, 200

    return app