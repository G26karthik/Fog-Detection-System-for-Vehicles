import cv2
import numpy as np
import streamlit as st
from PIL import Image

st.set_page_config(page_title="Real-Time Fog Detection", layout="wide")
st.title("Real-Time Fog Detection System")

# --- Configuration ---
# Try changing this index if you have multiple cameras (e.g., built-in + phone via DroidCam/Iriun)
CAMERA_INDEX = 1
# Resize frame for faster processing. Smaller dimensions = faster but less detail.
RESIZE_WIDTH = 640
# Initial Laplacian threshold - Adjust this based on your camera/lighting!
DEFAULT_THRESHOLD = 100.0
# ---------------------

st.sidebar.markdown("## Fog Detection Settings")
threshold = st.sidebar.slider(
    "Laplacian Variance Threshold (Lower = More Sensitive to Blur/Fog)",
    min_value=10.0,
    max_value=1000.0, # Increased max range for more flexibility
    value=DEFAULT_THRESHOLD,
    step=1.0
)
st.sidebar.info("Adjust the threshold slider. Higher values mean the image needs to be *very* blurry to be considered foggy. Lower values make it more sensitive.")

# Initialize session state for loop control
if 'stop' not in st.session_state:
    st.session_state.stop = False

def stop_camera():
    st.session_state.stop = True

# Place the button outside the loop
st.button("Stop Camera", key="stop_button", on_click=stop_camera)

# Initialize webcam
cap = cv2.VideoCapture(CAMERA_INDEX)

if not cap.isOpened():
    st.error(f"Failed to open camera at index {CAMERA_INDEX}. Try changing CAMERA_INDEX in the script.")
    st.stop()

# Define placeholders *before* the loop
frame_placeholder = st.empty()
st.markdown("--- ") # Separator
col1, col2 = st.columns(2)
with col1:
    status_placeholder = st.empty() # Placeholder for status text
with col2:
    hist_placeholder = st.empty()   # Placeholder for histogram

while cap.isOpened() and not st.session_state.stop:
    ret, frame = cap.read()
    if not ret:
        st.warning("Failed to capture frame or stream ended.")
        continue # Skip processing this frame

    # --- Optimization: Resize Frame ---
    height, width, _ = frame.shape
    aspect_ratio = height / width
    new_height = int(RESIZE_WIDTH * aspect_ratio)
    resized_frame = cv2.resize(frame, (RESIZE_WIDTH, new_height))
    # -----------------------------------

    # Process the resized frame
    gray = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2GRAY)

    # --- Fog Detection (Laplacian Variance) ---
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    fog_detected = laplacian_var < threshold
    # ------------------------------------------

    # --- Histogram (Contrast Check) ---
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    hist = hist.flatten()
    # ----------------------------------

    # --- Display Results ---
    # Display webcam feed using its placeholder
    frame_rgb = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)
    frame_placeholder.image(frame_rgb, channels="RGB", caption=f"Live Webcam Feed ({RESIZE_WIDTH}x{new_height})")

    # Update status placeholder in column 1
    status_text = "🟠 Fog Detected" if fog_detected else "🟢 No Fog"
    status_placeholder.markdown(f"**Fog Status:** {status_text}\n\n" # Add newlines for spacing
                              f"(Laplacian Variance: {laplacian_var:.2f} / Threshold: {threshold:.2f})\n\n"
                              f"*Note: Low variance can also be caused by blur, poor focus, or low light.*")

    # Update histogram placeholder in column 2
    hist_placeholder.line_chart(hist)
    # hist_placeholder.caption("Image Histogram") # Caption can be added once outside if preferred

    # -----------------------

# Release camera only after the loop stops
cap.release()
if st.session_state.stop:
    st.success("Webcam stopped and released.")
    # Clear placeholders
    frame_placeholder.empty()
    status_placeholder.empty()
    hist_placeholder.empty()
