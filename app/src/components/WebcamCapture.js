import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable } from 'react-native';

const WebcamCapture = forwardRef(({ onCapture, width = 300, height = 300, style }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  useImperativeHandle(ref, () => ({
    capture: () => {
      if (Platform.OS !== 'web' || !videoRef.current || !canvasRef.current) return null;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      // Mirror the canvas if using the front camera so the captured image matches the preview
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.8);
      
      if (onCapture) onCapture(base64Data);
      return base64Data;
    },
    stop: () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }));

  useEffect(() => {
    let activeStream = null;
    if (Platform.OS === 'web') {
      const startCamera = async () => {
        // Stop existing stream if we're switching cameras
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode } 
          });
          setStream(mediaStream);
          setHasPermission(true);
          activeStream = mediaStream;
        } catch (err) {
          console.error("Camera access denied or error:", err);
          setHasPermission(false);
        }
      };
      startCamera();
    } else {
      setHasPermission(false);
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const handleVideoRef = (node) => {
    videoRef.current = node;
    if (node && stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play().catch(e => console.log("Video Play Error:", e));
    }
  };

  useEffect(() => {
    if (hasPermission && stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("Video Play Error:", e));
      }
    }
  }, [stream, hasPermission]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Camera not supported on this platform</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator color="#34C759" />
        <Text style={styles.loadingText}>Starting Camera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Camera Permission Denied</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { width, height, overflow: 'hidden', display: 'flex', position: 'relative' }]}>
      {React.createElement('video', {
        ref: handleVideoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: { 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover',
          transform: facingMode === 'user' ? [{ scaleX: -1 }] : []
        }
      })}
      {React.createElement('canvas', {
        ref: canvasRef,
        style: { display: 'none' }
      })}
      
      {/* Camera Flip Button */}
      <Pressable 
        style={({pressed}) => ({ 
          position: 'absolute', 
          bottom: 16, 
          backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.5)', 
          borderRadius: 20, 
          paddingVertical: 6, 
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)'
        })}
        onPress={(e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
          {facingMode === 'user' ? 'FRONT' : 'BACK'} ⟲
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#04070C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'monospace'
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'monospace'
  }
});

export default WebcamCapture;
