import cv2
import numpy as np
import io
import os
from datetime import datetime, timezone
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Environment Variables & Config ---
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "fog_detection_db") # Default DB name
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME", "detections") # Default Collection name
mongo_client = None

# --- Configuration ---
ENABLE_LOGGING = os.getenv("ENABLE_LOGGING", "False").lower() == "true"

# --- Constants ---
# INCREASED Default thresholds (can be overridden by environment variables or frontend controls)
DEFAULT_LAPLACIAN_THRESHOLD = float(os.getenv("LAPLACIAN_THRESHOLD", "250.0")) # Increased from 100
DEFAULT_HIST_STD_DEV_THRESHOLD = float(os.getenv("HIST_STD_DEV_THRESHOLD", "40.0")) # Increased from 20

# --- MongoDB Connection ---
if MONGO_URI:
    try:
        mongo_client = MongoClient(MONGO_URI)
        # The ismaster command is cheap and does not require auth.
        mongo_client.admin.command('ismaster')
        logger.info("Successfully connected to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        mongo_client = None # Ensure client is None if connection fails
else:
    logger.warning("MONGO_URI not set. MongoDB logging disabled.")

# --- FastAPI App ---
app = FastAPI(title="Fog Detection API")

# --- CORS Middleware ---
# Allow requests from your frontend development server and deployed frontend
# Adjust origins as needed for production
origins = [
    "http://localhost:3000",  # Default Next.js dev port
    "http://127.0.0.1:3000",
    # Add your deployed frontend URL here, e.g., "https://your-frontend.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# --- Optional: Define a Pydantic model for the response ---
# This helps with documentation and can catch errors if the returned dict doesn't match
# If you use this, make sure the keys and types match EXACTLY what you return
class FogDetectionResponseModel(BaseModel):
    laplacian_variance: float
    histogram_std_dev: float
    fog_detected: bool
    intensity: str # "Clear", "Light", "Heavy"
    advice: str    # Driver advice message
    message: str | None = None
    timestamp: str | None = None
    laplacian_threshold_used: float | None = None
    std_dev_threshold_used: float | None = None
    histogram: list[float] | None = None

# --- Helper Function ---
def detect_fog_from_image_bytes(image_bytes: bytes, laplacian_threshold: float, hist_std_dev_threshold: float) -> dict:
    """
    Analyzes an image represented as bytes to detect fog using Laplacian variance
    and histogram standard deviation. Also returns histogram data.

    Args:
        image_bytes: The image data in bytes.
        laplacian_threshold: The threshold for Laplacian variance.
        hist_std_dev_threshold: The threshold for histogram standard deviation.

    Returns:
        A dictionary containing the analysis results:
        {
            "laplacian_variance": float,
            "histogram_std_dev": float,
            "fog_detected": bool,
            "histogram": list[float] | None # Added histogram data
        }
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE) # Convert to grayscale

        if img is None:
            logger.error("Failed to decode image")
            # Return None for histogram on error
            return {"error": "Failed to decode image", "histogram": None}

        # 1. Laplacian Variance
        laplacian_var = cv2.Laplacian(img, cv2.CV_64F).var()

        # 2. Histogram Calculation & Standard Deviation
        hist_bins = 256
        hist_range = [0, 256]
        hist = cv2.calcHist([img], [0], None, [hist_bins], hist_range)
        mean, std_dev = cv2.meanStdDev(hist)
        hist_std_dev = std_dev[0][0] # std_dev is a 1x1 matrix

        # Prepare histogram data for JSON response (flatten and convert to list of floats)
        # Ensure histogram values are standard floats
        hist_data = [float(h) for h in hist.flatten()]

        # --- Log values BEFORE comparison ---
        logger.info(f"Values - Laplacian Var: {laplacian_var:.2f}, Hist Std Dev: {hist_std_dev:.2f}")
        logger.info(f"Thresholds - Laplacian: {laplacian_threshold:.2f}, Hist Std Dev: {hist_std_dev_threshold:.2f}")

        # --- Combined Fog Detection Logic ---
        is_foggy_laplacian = laplacian_var < laplacian_threshold
        is_foggy_hist = hist_std_dev < hist_std_dev_threshold
        # Explicitly cast to Python bool
        fog_detected = bool(is_foggy_laplacian or is_foggy_hist)

        # Log comparison results
        logger.info(f"Comparison - Laplacian Foggy: {is_foggy_laplacian}, Hist Foggy: {is_foggy_hist}, Combined: {fog_detected}")

        # Explicitly cast numerical results to standard Python floats
        return {
            "laplacian_variance": float(laplacian_var),
            "histogram_std_dev": float(hist_std_dev),
            "fog_detected": fog_detected, # Already cast to bool
            "histogram": hist_data # Already cast to list[float]
        }
    except Exception as e:
        logger.exception(f"Error processing image: {e}")
        # Return None for histogram on exception
        return {"error": f"Error processing image: {str(e)}", "histogram": None}

# --- API Endpoints ---
@app.get("/health", summary="Health Check")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

@app.post("/detect-fog") # Or leave it without response_model for now
async def detect_fog_endpoint(
    file: UploadFile = File(...),
    laplacian_threshold: float = Query(250.0),
    std_dev_threshold: float = Query(40.0),
    log_to_db: bool = Query(False)
):
    """
    Accepts an image file, calculates Laplacian variance, and detects fog.
    Optionally logs results to MongoDB if enabled.
    """
    logger = logging.getLogger("main")
    logger.info(f"Received file: {file.filename}, size: {file.size} bytes")
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img_color = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_color is None:
             img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
             if img is None:
                  logger.error("Failed to decode image")
                  raise HTTPException(status_code=400, detail="Could not decode image file.")
        else:
             img = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)


        # --- Fog Detection Logic ---
        laplacian_var = cv2.Laplacian(img, cv2.CV_64F).var()
        hist = cv2.calcHist([img], [0], None, [256], [0, 256])
        hist_std_dev = np.std(hist)

        # --- Determine Intensity and Advice ---
        is_foggy = False
        intensity = "Clear"
        advice = "Conditions clear. Drive safely."
        message = "Clear"

        # Define thresholds for heavy fog (adjust these values based on testing)
        heavy_lap_threshold = laplacian_threshold / 2.5 # e.g., 100
        heavy_std_dev_threshold = std_dev_threshold / 2.0 # e.g., 20

        if laplacian_var < heavy_lap_threshold or hist_std_dev < heavy_std_dev_threshold:
            is_foggy = True
            intensity = "Heavy"
            advice = "HEAVY FOG! Reduce speed significantly. Use fog lights. Increase following distance. Consider stopping if visibility is minimal."
            message = "Heavy Fog Detected"
        elif laplacian_var < laplacian_threshold or hist_std_dev < std_dev_threshold:
            is_foggy = True
            intensity = "Light"
            advice = "Light Fog Detected. Reduce speed. Turn on headlights (low beam). Be cautious."
            message = "Light Fog Detected"

        timestamp = datetime.now(timezone.utc).isoformat()

        # --- Prepare Response ---
        response_data = {
            "laplacian_variance": float(laplacian_var),
            "histogram_std_dev": float(hist_std_dev),
            "fog_detected": bool(is_foggy),
            "intensity": intensity, # ADDED
            "advice": advice,       # ADDED
            "message": message,
            "timestamp": timestamp,
            "laplacian_threshold_used": float(laplacian_threshold),
            "std_dev_threshold_used": float(std_dev_threshold),
            "histogram": [float(x) for x in hist.flatten()]
        }

        # --- Optional Database Logging ---
        # if log_to_db and db_client:
        #     try:
        #         log_detection_result(db_client, response_data)
        #         logger.info("Detection result logged to database.")
        #     except Exception as db_err:
        #         logger.error(f"Failed to log detection result to database: {db_err}")
        # elif log_to_db:
        #      logger.warning("Database logging requested but DB client is not available.")


        logger.info(f"Detection complete. Intensity: {intensity}.")
        return response_data

    except HTTPException as http_exc:
        logger.error(f"HTTP Exception: {http_exc.detail}")
        raise http_exc # Re-raise HTTPException
    except Exception as e:
        logger.exception(f"An unexpected error occurred during fog detection: {e}") # Log full traceback
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

# --- Optional: Run with Uvicorn for local testing ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
