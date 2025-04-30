'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---
interface DetectionResponse {
  fog_detected: boolean;
  laplacian_variance: number;
  histogram_std_dev: number;
  intensity: 'Clear' | 'Light' | 'Heavy'; // Added
  advice: string; // Added
  message?: string;
  timestamp?: string;
  histogram?: number[];
  laplacian_threshold_used?: number;
  std_dev_threshold_used?: number;
}

// --- Constants ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const DETECTION_INTERVAL_MS = 1500; // Interval for detection updates

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };
const statusVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { scale: 0.8, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

// --- Driver Specific Styles ---
const getIntensityStyles = (intensity: 'Clear' | 'Light' | 'Heavy' | null) => {
  switch (intensity) {
    case 'Heavy':
      return { background: 'bg-red-700', text: 'text-white', icon: '🚨' };
    case 'Light':
      return { background: 'bg-yellow-500', text: 'text-black', icon: '⚠️' };
    case 'Clear':
    default:
      return { background: 'bg-green-600', text: 'text-white', icon: '✅' };
  }
};

export default function DriverView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const isCameraOnRef = useRef(isCameraOn);
  const [detectionResult, setDetectionResult] = useState<DetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Tracks camera starting
  const [isDetecting, setIsDetecting] = useState(false); // Tracks detection cycle

  useEffect(() => { isCameraOnRef.current = isCameraOn; }, [isCameraOn]);

  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOnRef.current || videoRef.current.paused || videoRef.current.ended) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    }
    const context = canvas.getContext('2d');
    if (!context) { console.error("Canvas context error"); return; }
    try { context.drawImage(video, 0, 0, canvas.width, canvas.height); }
    catch (drawError) { console.error("Canvas draw error:", drawError); return; }

    canvas.toBlob(async (blob) => {
      if (!blob) { console.error("Canvas blob error"); return; }
      const formData = new FormData();
      formData.append('file', blob, 'capture.jpg');
      const url = `${BACKEND_URL}/detect-fog`;

      setIsDetecting(true);
      try {
        const response = await axios.post<DetectionResponse>(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 5000,
        });
        setDetectionResult(response.data);
        setError(null);
      } catch (err) {
        console.error("Detection error:", err);
        let errorMsg = "System error.";
        if (axios.isAxiosError(err)) {
          if (err.code === 'ECONNABORTED') errorMsg = "Connection timeout.";
          else if (err.response) errorMsg = `Server error: ${err.response.status}`;
          else if (err.request) errorMsg = "No server response.";
        }
        setError((prev) => (prev === errorMsg ? prev : errorMsg));
        setDetectionResult(null); // Clear result on error
      } finally {
        setIsDetecting(false);
      }
    }, 'image/jpeg', 0.8);
  }, []); // No dependencies needed here

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    captureAndDetect(); // Initial capture
    intervalRef.current = setInterval(captureAndDetect, DETECTION_INTERVAL_MS);
  }, [captureAndDetect]);

  const stopDetectionLoop = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const startCamera = async () => {
    setError(null); setIsLoading(true); setDetectionResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream; setIsCameraOn(true);
        const handleMetadataLoaded = () => {
          setIsLoading(false);
          videoRef.current?.play().catch(err => console.error("Video play error:", err));
          startDetectionLoop();
        };
        videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded, { once: true });
        await videoRef.current.play().catch(err => console.error("Initial play error:", err));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera unavailable. Check permissions.");
      setIsLoading(false); setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    stopDetectionLoop();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false); setDetectionResult(null); setIsLoading(false); setIsDetecting(false); setError(null);
  };

  useEffect(() => { startCamera(); return stopCamera; }, []); // Auto-start on mount

  const intensityStyles = getIntensityStyles(detectionResult?.intensity ?? null);
  const backgroundClass = 'bg-gray-800';

  return (
    <motion.div
      className={`flex flex-col items-center min-h-screen p-4 ${backgroundClass} text-white overflow-hidden`}
      variants={containerVariants} initial="hidden" animate="visible"
    >
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="absolute top-4 bg-red-600 border border-red-800 text-white px-4 py-2 rounded-lg shadow-lg z-10"
            role="alert" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          >
            <span className="font-bold">Error: </span>{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Viewport - Added Back */}
      <motion.div
        className="relative w-full max-w-3xl aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-600/50 shadow-lg mb-6"
        variants={itemVariants}
      >
        <video
          ref={videoRef}
          // Removed hiding styles, added object-cover
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
        {isLoading && ( // Initial camera loading
           <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <svg className="animate-spin h-8 w-8 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-white text-lg animate-pulse">Starting Camera...</p>
           </div>
        )}
      </motion.div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />


      {/* Main Driver Advice Display */}
      <motion.div
        className={`w-full max-w-lg rounded-xl shadow-2xl p-6 md:p-8 border-4 ${intensityStyles.background} ${intensityStyles.text} border-gray-500/50 flex flex-col items-center text-center transition-colors duration-500`}
        variants={itemVariants}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={detectionResult?.timestamp || (isLoading ? 'loading' : (isDetecting ? 'detecting' : 'idle'))} // Adjusted key
            variants={statusVariants} initial="hidden" animate="visible" exit="exit" className="w-full"
          >
            {isLoading ? (
              <div className="flex flex-col items-center py-8">
                 <svg className="animate-spin h-12 w-12 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 <p className="text-xl font-medium">Initializing System...</p>
              </div>
            ) : !isCameraOnRef.current ? (
               <p className="text-xl font-medium text-yellow-300 py-8">Camera Disconnected</p>
            ) : detectionResult ? (
              <div className="flex flex-col items-center py-4">
                 <span className="text-7xl mb-4">{intensityStyles.icon}</span>
                 <h2 className="text-4xl font-bold mb-3 uppercase tracking-wide">{detectionResult.intensity} Fog</h2>
                 <p className="text-xl font-medium px-2">{detectionResult.advice}</p>
                 {isDetecting && <p className="text-sm mt-4 opacity-75 italic">Updating...</p>}
              </div>
            ) : (
              // Show Initializing... if camera is on but no result yet and not detecting
              <p className="text-xl font-medium italic py-8">{isDetecting ? 'Detecting...' : 'Initializing...'}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}