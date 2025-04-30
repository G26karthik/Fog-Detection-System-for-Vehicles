'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Removed Legend
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---
interface DetectionResponse {
  fog_detected: boolean; // Changed back to match backend log
  laplacian_variance: number;
  histogram_std_dev: number;
  message?: string; // Make optional
  timestamp?: string; // Make optional
  histogram?: number[];
  laplacian_threshold_used?: number;
  std_dev_threshold_used?: number;
}

interface HistogramData {
  bin: number;
  frequency: number;
}

// --- Constants ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const DETECTION_INTERVAL_MS = 1000;
const DEFAULT_LAPLACIAN_THRESHOLD = 250.0;
const DEFAULT_HIST_STD_DEV_THRESHOLD = 40.0;

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Stagger children animations
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

const statusVariants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { scale: 0.5, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const isCameraOnRef = useRef(isCameraOn); // Ref to track camera state

  const [detectionResult, setDetectionResult] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For initial camera start
  const [isDetecting, setIsDetecting] = useState(false); // For API call detection cycle
  const [histogramData, setHistogramData] = useState<HistogramData[]>([]);
  const [laplacianThreshold, setLaplacianThreshold] = useState(DEFAULT_LAPLACIAN_THRESHOLD);
  const [histStdDevThreshold, setHistStdDevThreshold] = useState(DEFAULT_HIST_STD_DEV_THRESHOLD);

  // Keep the ref synchronized with the state
  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  // --- Frame Capture and Detection Logic ---
  // Define captureAndDetect first
  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOnRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Ensure canvas dimensions match video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      console.error("Failed to get canvas context");
      return;
    }

    // Draw the current video frame to the canvas
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch (drawError) {
      console.error("Error during canvas.drawImage:", drawError);
      return;
    }

    // Get the image data as a Blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error("Failed to create blob from canvas");
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'capture.jpg');

      const url = new URL(`${BACKEND_URL}/detect-fog`);
      url.searchParams.append('laplacian_threshold', laplacianThreshold.toString());
      // Ensure backend expects 'hist_std_dev_threshold'
      url.searchParams.append('std_dev_threshold', histStdDevThreshold.toString());

      setIsDetecting(true); // Use isDetecting for API call
      try {
        const response = await axios.post<DetectionResponse>(url.toString(), formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 5000,
        });
        setDetectionResult(response.data);
        setError(null);

        if (response.data.histogram && response.data.histogram.length > 0) {
          const processedHist = response.data.histogram.map((value, index) => ({
            bin: index,
            frequency: value,
          }));
          setHistogramData(processedHist);
        } else {
          setHistogramData([]);
        }

      } catch (err) {
        console.error("Error detecting fog:", err); // Keep error log
        setDetectionResult(null);
        setHistogramData([]);
      } finally {
          setIsDetecting(false); // Use isDetecting for API call
      }
    }, 'image/jpeg', 0.8);
  }, [laplacianThreshold, histStdDevThreshold]);

  // --- Detection Loop Control ---
  // Define startDetectionLoop after captureAndDetect
  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    captureAndDetect();
    intervalRef.current = setInterval(() => {
      captureAndDetect();
    }, DETECTION_INTERVAL_MS);
  }, [captureAndDetect]);

  const stopDetectionLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // --- Camera Control Functions ---
  const startCamera = async () => {
    setError(null);
    setIsLoading(true); // Use isLoading for initial start
    setDetectionResult(null);
    setHistogramData([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOn(true);

        const handleMetadataLoaded = () => {
          setIsLoading(false); // Use isLoading for initial start
          videoRef.current?.play().catch(err => console.error("Error playing video:", err));
          startDetectionLoop();
        };

        videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded, { once: true });

        await videoRef.current.play().catch(err => {
          console.error("Initial video play attempt failed:", err);
        });
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      // ... error message handling ...
      setIsLoading(false); // Use isLoading for initial start
      setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    stopDetectionLoop();
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setDetectionResult(null);
    setHistogramData([]);
    setIsLoading(false); // Stop initial loading indicator
    setIsDetecting(false); // Stop detection indicator
    setError(null);
  };

  // --- Main Mount/Unmount Effect ---
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use fog_detected for background
  const backgroundClass = detectionResult?.fog_detected ? 'bg-foggy-sky' : 'bg-clear-sky';

  // --- Render Component ---
  return (
    <motion.div
      // Add overflow-hidden to prevent scrollbars from minor animation overflows
      className={`flex flex-col items-center min-h-screen p-4 transition-colors duration-1000 ${backgroundClass} overflow-hidden`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header with Logo and Title */}
      <motion.header
        className="w-full max-w-6xl flex items-center justify-center mb-6 px-4 relative"
        variants={itemVariants}
      >
        {/* Simple Placeholder Logo (e.g., SVG or Emoji) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl md:text-4xl opacity-80" title="Fog4Det Logo">
          🌫️ {/* Using an emoji as a simple logo */}
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-light-text text-center tracking-tight [text-shadow:_0_2px_4px_rgb(0_0_0_/_40%)]">
          Fog<span className="text-accent-teal">4</span>Det
        </h1>
      </motion.header>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="bg-red-500/90 border border-red-700 text-white px-4 py-3 rounded-lg relative mb-4 w-full max-w-md text-center shadow-lg backdrop-blur-sm"
            role="alert"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Card - Increased max-width */}
      <motion.div
        className="w-full max-w-6xl bg-card-bg backdrop-blur-md rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700/50"
        variants={itemVariants}
      >
        {/* Adjusted Grid Layout: Video larger on medium screens and up */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left Column (2/3 width on md+): Camera and Controls */}
          <motion.div className="flex flex-col items-center md:col-span-2" variants={itemVariants}>
            {/* Camera Viewport - Adjusted aspect ratio and max height */}
            <div className="relative w-full aspect-video md:aspect-[16/9] max-h-[70vh] bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-600/50 shadow-lg mb-4">
              <video
                ref={videoRef}
                // Ensure video fills the container
                className="w-full h-full object-cover display-block"
                muted
                playsInline
                autoPlay
              />
              {/* Overlays for status */}
              {!isCameraOnRef.current && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <p className="text-gray-300 text-lg font-semibold">Camera Off</p>
                </div>
              )}
              {/* THIS OVERLAY NOW ONLY DEPENDS ON isLoading */}\
              {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <svg className="animate-spin h-8 w-8 text-accent-teal mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-accent-teal text-lg animate-pulse">Starting Camera...</p>
                 </div>
              )}
              {/* Optional: Add a different indicator for isDetecting if needed */}
              {/* {isDetecting && !isLoading && ( ... show detecting spinner ... )} */}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Control Buttons */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-4 w-full justify-center">
              <motion.button
                onClick={startCamera}
                disabled={isCameraOn || isLoading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-accent-teal text-white font-bold rounded-lg shadow-lg hover:shadow-glow-teal disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLoading ? 'Starting...' : 'Start Camera'}
              </motion.button>
              <motion.button
                onClick={stopCamera}
                disabled={!isCameraOn}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-accent-pink text-white font-bold rounded-lg shadow-lg hover:shadow-glow-pink disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-1 disabled:transform-none"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Stop Camera
              </motion.button>
            </div>

            {/* Threshold Sliders */}
            <div className="w-full space-y-4 text-light-text bg-gray-800/40 p-4 rounded-lg border border-gray-700/30">
              <div className="text-sm">
                <label htmlFor="laplacian" className="block mb-1.5 font-medium text-gray-300">Laplacian Threshold: <span className='font-bold text-accent-teal'>{laplacianThreshold.toFixed(0)}</span></label>
                <input
                  id="laplacian"
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={laplacianThreshold}
                  onChange={(e) => setLaplacianThreshold(parseFloat(e.target.value))}
                  disabled={!isCameraOn}
                  className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-teal disabled:opacity-50 disabled:cursor-not-allowed range-thumb:bg-accent-teal range-track:bg-gray-600"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="histogram" className="block mb-1.5 font-medium text-gray-300">Histogram Std Dev Threshold: <span className='font-bold text-accent-pink'>{histStdDevThreshold.toFixed(1)}</span></label>
                <input
                  id="histogram"
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={histStdDevThreshold}
                  onChange={(e) => setHistStdDevThreshold(parseFloat(e.target.value))}
                  disabled={!isCameraOn}
                  className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-pink disabled:opacity-50 disabled:cursor-not-allowed range-thumb:bg-accent-pink range-track:bg-gray-600"
                />
              </div>
            </div>
          </motion.div>

          {/* Right Column (1/3 width on md+): Status and Histogram */}
          <motion.div className="flex flex-col items-center space-y-4 md:col-span-1" variants={itemVariants}>
            {/* Status Display Card */}
            <div className="w-full bg-gray-800/60 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-600/40 text-light-text">
              <h3 className="text-lg font-semibold mb-3 text-center text-accent-teal border-b border-gray-600 pb-2">Detection Status</h3>
              <AnimatePresence mode="wait">
                <motion.div
                  key={detectionResult?.timestamp || (isDetecting ? 'detecting' : 'idle')} // Update key for detecting state
                  variants={statusVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="text-center mb-4 h-8 flex items-center justify-center"
                >
                  {/* Show "Detecting..." when isDetecting is true */}
                  {isDetecting ? (
                    <span className="text-gray-400 italic">Detecting...</span>
                  ) : detectionResult ? (
                    <span className={`text-xl font-bold ${detectionResult.fog_detected ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                      {detectionResult.message ?? (detectionResult.fog_detected ? 'Fog Detected' : 'Clear')}
                    </span>
                  ) : !isCameraOnRef.current ? (
                    <span className="text-gray-500">Camera Off</span>
                  ) : (
                    // Show Initializing only if not detecting and no result yet
                    <span className="text-gray-400 italic">Initializing...</span>
                  )}
                </motion.div>
              </AnimatePresence>
              {/* Display other details */}
              <div className="text-xs space-y-1 text-gray-400">
                <p>Laplacian Var: <span className="font-medium text-gray-200">{detectionResult?.laplacian_variance?.toFixed(2) ?? 'N/A'}</span></p>
                <p>Histogram Std Dev: <span className="font-medium text-gray-200">{detectionResult?.histogram_std_dev?.toFixed(2) ?? 'N/A'}</span></p>
                <p>Timestamp: <span className="font-medium text-gray-200">{detectionResult?.timestamp ? new Date(detectionResult.timestamp).toLocaleTimeString() : 'N/A'}</span></p>
                {/* Display thresholds used */}
                {detectionResult?.laplacian_threshold_used !== undefined && (
                   <p>Lap Thresh: <span className="font-medium text-gray-200">{detectionResult.laplacian_threshold_used.toFixed(0)}</span></p>
                )}
                {detectionResult?.std_dev_threshold_used !== undefined && (
                   <p>Std Dev Thresh: <span className="font-medium text-gray-200">{detectionResult.std_dev_threshold_used.toFixed(1)}</span></p>
                )}
              </div>
            </div>

            {/* Histogram Card */}
            <div className="w-full bg-gray-800/60 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-600/40 text-light-text">
              <h3 className="text-lg font-semibold mb-2 text-center text-accent-pink border-b border-gray-600 pb-2">Image Brightness Histogram</h3>
              <div className="h-48 w-full"> {/* Ensure fixed height */}
                {isCameraOn && histogramData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#67E8F9" stopOpacity={0.8}/> {/* Teal */}
                          <stop offset="95%" stopColor="#F472B6" stopOpacity={0.7}/> {/* Pink */}
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                      <XAxis dataKey="bin" stroke="#9CA3AF" fontSize={10} tick={{ fill: '#9CA3AF' }} interval="preserveStartEnd" tickCount={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} tick={{ fill: '#9CA3AF' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4B5563', borderRadius: '4px' }}
                        labelStyle={{ color: '#E5E7EB' }}
                        itemStyle={{ color: '#67E8F9' }}
                      />
                      <Bar dataKey="frequency" fill="url(#colorFreq)" barSize={5} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 italic">
                    {!isCameraOn ? 'Camera Off' : (isLoading ? 'Loading...' : 'No histogram data')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer/Attribution (Optional) */}
      <motion.footer
        className="mt-8 text-center text-xs text-gray-400/70"
        variants={itemVariants}
      >
        Fog<span className="text-accent-teal">4</span>Det v1.0
      </motion.footer>
    </motion.div>
  );
}
