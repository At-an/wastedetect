# WasteDetect

A low-cost, human-assisted PWA for real-time waste sorting and recycling 
built for resource-constrained environments in Buea, Cameroon.

## Tech Stack
- **Frontend:** React.js, WebRTC, Chart.js (hosted on Vercel)
- **Backend:** Flask, YOLOv8n (hosted on Railway)
- **Database:** SQLite (development), PostgreSQL (production)
- **Storage:** Cloudinary
- **Auth:** JWT (Flask-JWT-Extended)

## Project Structure
- `/backend` — Flask API and YOLOv8n model
- `/frontend` — React PWA
- `/docs` — Diagrams, ERD, and UI designs

## Model Training Pipeline.

The model was trained on a 43,869 waste image dataset consisting of five main waste categories locally found in Buea, Cameroon.

**For More Details**

In case you need more details about the model training and deployment process (data preparation, model training, model evaluation, and model deployment), 
check it out at https://www.kaggle.com/code/natanahelatankeu/low-cost-object-detection
