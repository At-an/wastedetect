# backend/run.py
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Runs the Flask application on port 5000 with debug enabled
    app.run(host="0.0.0.0", port=5000, debug=True)
