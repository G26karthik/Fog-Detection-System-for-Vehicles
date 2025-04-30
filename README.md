\
# Fog4Det - Real-time Vehicle Fog Detection System

**Version:** 1.0.0

**Authors:** [Your Name/Team Name]

---

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [User Perspective (Design Thinking)](#user-perspective-design-thinking)
    *   [The Problem](#the-problem)
    *   [Our Solution](#our-solution)
    *   [Target User](#target-user)
    *   [Key Features](#key-features)
3.  [Technical Aspects](#technical-aspects)
    *   [Architecture](#architecture)
    *   [Frontend Details](#frontend-details)
    *   [Backend Details](#backend-details)
    *   [Detection Logic](#detection-logic)
4.  [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation](#installation)
    *   [Running Locally](#running-locally)
5.  [Deployment (Render)](#deployment-render)
6.  [Usage](#usage)
    *   [Developer View](#developer-view)
    *   [Driver View](#driver-view)
7.  [Future Improvements](#future-improvements)

---

## Project Overview

Fog4Det (Fog for Detection) is a real-time fog detection system designed primarily for vehicular use. Using a forward-facing camera feed, it analyzes image properties to determine the presence and intensity of fog, providing timely warnings and advice to the driver to enhance safety in low-visibility conditions.

The system features two distinct interfaces: a detailed **Developer View** for monitoring, tuning, and analysis, and a simplified **Driver View** focused solely on delivering clear, actionable alerts.

---

## User Perspective (Design Thinking)

### The Problem

Driving in foggy conditions significantly reduces visibility, dramatically increasing the risk of accidents. Drivers may not accurately perceive the density of the fog or react quickly enough to changing conditions, leading to dangerous situations. Existing solutions often rely on manual activation (fog lights) or lack real-time, context-aware advice.

### Our Solution

Fog4Det aims to mitigate these risks by providing an automated, real-time assessment of fog conditions directly from a vehicle's camera feed. By analyzing image characteristics associated with fog (like reduced contrast and variance), the system classifies the fog intensity (Clear, Light, Heavy) and delivers immediate, easy-to-understand visual alerts and driving recommendations to the driver.

### Target User

The primary users are **drivers** operating vehicles in areas prone to foggy conditions. The system is designed to be minimally distracting while providing critical safety information. A secondary audience includes **developers and researchers** interested in computer vision applications for automotive safety.

### Key Features

*   **Real-time Fog Detection:** Continuously analyzes camera feed for fog presence.
*   **Intensity Classification:** Categorizes fog as "Clear," "Light," or "Heavy."
*   **Driver View:** Simplified interface with large icons, color-coding (Green/Yellow/Red), and clear text advice based on fog intensity.
*   **Developer View:** Detailed dashboard showing live camera feed, detection parameters (Laplacian Variance, Histogram Std Dev), thresholds, image brightness histogram, and raw detection status. Allows for tuning detection thresholds.
*   **Web-Based:** Accessible via a web browser, leveraging modern web technologies.

---

## Technical Aspects

### Architecture

The application is structured as a **monorepo** containing two main components:

1.  **Backend:** A Python service built with **FastAPI** responsible for image processing, fog detection logic, and serving the detection results via a REST API.
2.  **Frontend:** A **Next.js** (React framework) application providing the user interfaces (Developer and Driver views) and interacting with the backend API.

```
/
├── backend/          # FastAPI application
│   ├── main.py       # API endpoints and detection logic
│   └── requirements.txt
├── frontend/         # Next.js application
│   ├── src/
│   │   ├── app/      # App Router structure
│   │   │   ├── page.tsx      # Developer View
│   │   │   └── driver/
│   │   │       └── page.tsx  # Driver View
│   ├── public/       # Static assets
│   └── ...           # Config files (Next.js, TS, Tailwind)
├── .gitignore
├── render.yaml       # Deployment configuration for Render
└── README.md         # This file
```

### Frontend Details

*   **Framework:** Next.js 14+ (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** React
*   **Charting:** Recharts (for histogram in Developer View)
*   **Animations:** Framer Motion
*   **API Communication:** Axios

### Backend Details

*   **Framework:** FastAPI
*   **Language:** Python 3.11+
*   **Image Processing:** OpenCV (`opencv-python-headless`)
*   **Numerical Operations:** NumPy
*   **Web Server:** Uvicorn

### Detection Logic

Fog detection is primarily based on two image characteristics calculated from the grayscale camera frame:

1.  **Laplacian Variance:** Measures the "blurriness" or lack of sharp edges in an image. Lower variance often indicates reduced contrast, typical in foggy conditions.
2.  **Histogram Standard Deviation:** Measures the spread of pixel intensity values. Fog tends to compress the dynamic range, leading to a lower standard deviation in the image histogram.

The backend compares these calculated values against configurable thresholds (`laplacian_threshold`, `std_dev_threshold`) to determine if fog is present. It further classifies the intensity ("Light" or "Heavy") based on how far the values fall below the thresholds.

---

## Getting Started

### Prerequisites

*   **Node.js:** v18 or later (for Frontend)
*   **npm** or **yarn:** Node package manager
*   **Python:** v3.11 or later (for Backend)
*   **pip:** Python package installer

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/<your-github-username>/Fog-Detection-System.git # Replace with your repo URL
    cd Fog-Detection-System
    ```

2.  **Backend Setup:**
    ```powershell
    # Navigate to the backend directory
    cd backend

    # Create a virtual environment (recommended)
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1 # On Windows PowerShell

    # Install Python dependencies
    pip install --upgrade pip
    pip install -r requirements.txt

    # (Optional) Create a .env file if you add database logging or other secrets
    # echo "MONGO_URI=your_mongodb_connection_string" > .env

    # Go back to the root directory
    cd ..
    ```

3.  **Frontend Setup:**
    ```powershell
    # Navigate to the frontend directory
    cd frontend

    # Install Node.js dependencies
    npm install --force # or yarn install --force

    # (Optional) Create a .env.local file if needed, but backend URL is handled by Render env var on deployment
    # echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > .env.local

    # Go back to the root directory
    cd ..
    ```

### Running Locally

You need to run both the backend and frontend servers simultaneously.

1.  **Start the Backend Server:**
    ```powershell
    cd backend
    # Make sure your virtual environment is active
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    The backend API will be available at `http://localhost:8000`.

2.  **Start the Frontend Server:**
    Open a *new* terminal.
    ```powershell
    cd frontend
    npm run dev
    ```
    The frontend application will be available at `http://localhost:3000`.

---

## Deployment (Render)

This project is configured for easy deployment to [Render](https://render.com/) using the included `render.yaml` blueprint.

1.  **Push to GitHub:** Ensure your code, including the `.gitignore` and `render.yaml` files, is pushed to a GitHub repository.
2.  **Create Render Account:** Sign up or log in to Render.
3.  **Create Blueprint Instance:**
    *   Go to "Blueprints" in your Render dashboard and click "New Blueprint Instance".
    *   Connect your GitHub account and select the repository containing this project.
    *   Render will automatically detect and use the `render.yaml` file.
    *   Review the service details (names, build/start commands).
    *   (Optional) Add any necessary environment variables (like `MONGO_URI` for the backend) directly in the Render service settings if you didn't hardcode them or use `.env` (not recommended for secrets). The `NEXT_PUBLIC_BACKEND_URL` for the frontend will be automatically injected based on the `render.yaml` configuration.
    *   Click "Create Blueprint Instance".
4.  **Deployment:** Render will clone your repository, build both services according to the `render.yaml` instructions, and deploy them. The frontend will be available at its Render URL, automatically configured to communicate with the backend service.

---

## Usage

Once deployed or running locally:

### Developer View

*   Access: `http://<your-render-frontend-url>/` or `http://localhost:3000/`
*   Features: Live camera feed, real-time detection metrics, histogram, status messages, and threshold sliders for tuning.

### Driver View

*   Access: `http://<your-render-frontend-url>/driver` or `http://localhost:3000/driver`
*   Features: Simplified display showing fog intensity (Clear/Light/Heavy) with icons, color-coding, and clear driving advice. Includes the live camera feed.

---

## Future Improvements

*   **Database Logging:** Implement robust logging of detection events to a database (e.g., MongoDB) for historical analysis.
*   **Improved Detection Model:** Explore more advanced computer vision techniques or machine learning models for potentially higher accuracy and robustness.
*   **Weather API Integration:** Correlate detection results with external weather data.
*   **PWA Features:** Add Progressive Web App capabilities for offline access or better mobile integration.
*   **Calibration:** Add a calibration step for different camera types or lighting conditions.
*   **Audio Alerts:** Implement optional audio warnings for the driver view.

---
