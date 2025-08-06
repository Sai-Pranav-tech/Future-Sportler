from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import cv2
import mediapipe as mp
import numpy as np
import json
import os
from typing import List, Dict, Any
import uuid
from pydantic import BaseModel
import io
from PIL import Image
import base64

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Serve processed videos and images
app.mount("/videos", StaticFiles(directory="/app/videos"), name="videos")

class AnalysisResult(BaseModel):
    video_id: str
    errors: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    pose_data: List[Dict[str, Any]]
    feedback: List[str]

class ArcheryAnalyzer:
    def __init__(self):
        self.key_landmarks = {
            'left_shoulder': 11,
            'right_shoulder': 12,
            'left_elbow': 13,
            'right_elbow': 14,
            'left_wrist': 15,
            'right_wrist': 16,
            'left_hip': 23,
            'right_hip': 24,
            'left_knee': 25,
            'right_knee': 26,
            'left_ankle': 27,
            'right_ankle': 28,
            'nose': 0
        }
    
    def calculate_angle(self, a, b, c):
        """Calculate angle between three points"""
        a = np.array(a)  # First point
        b = np.array(b)  # Mid point (vertex)
        c = np.array(c)  # End point
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        
        if angle > 180.0:
            angle = 360 - angle
            
        return angle
    
    def analyze_stance(self, landmarks, frame_number=0):
        """Analyze archer's stance and posture"""
        errors = []
        metrics = {}
        
        if not landmarks:
            return errors, metrics
            
        # Get key points
        left_ankle = [landmarks[self.key_landmarks['left_ankle']].x, landmarks[self.key_landmarks['left_ankle']].y]
        right_ankle = [landmarks[self.key_landmarks['right_ankle']].x, landmarks[self.key_landmarks['right_ankle']].y]
        left_shoulder = [landmarks[self.key_landmarks['left_shoulder']].x, landmarks[self.key_landmarks['left_shoulder']].y]
        right_shoulder = [landmarks[self.key_landmarks['right_shoulder']].x, landmarks[self.key_landmarks['right_shoulder']].y]
        left_knee = [landmarks[self.key_landmarks['left_knee']].x, landmarks[self.key_landmarks['left_knee']].y]
        right_knee = [landmarks[self.key_landmarks['right_knee']].x, landmarks[self.key_landmarks['right_knee']].y]
        
        # Calculate foot placement
        foot_distance = abs(left_ankle[0] - right_ankle[0])
        metrics['foot_distance'] = foot_distance
        
        # Check stance width (should be about shoulder-width)
        shoulder_width = abs(left_shoulder[0] - right_shoulder[0])
        
        # Detailed stance analysis
        if foot_distance < shoulder_width * 0.6:
            errors.append({
                'type': 'stance',
                'issue': 'very_narrow_stance',
                'description': f'Frame {frame_number}: Stance is very narrow ({foot_distance:.3f} vs ideal {shoulder_width:.3f})',
                'severity': 'high',
                'correction': 'Significantly widen your feet - move them at least shoulder-width apart',
                'frame': frame_number,
                'measurement': f'Foot distance: {foot_distance:.3f}, Shoulder width: {shoulder_width:.3f}'
            })
        elif foot_distance < shoulder_width * 0.8:
            errors.append({
                'type': 'stance',
                'issue': 'narrow_stance',
                'description': f'Frame {frame_number}: Stance is too narrow for optimal stability',
                'severity': 'medium',
                'correction': 'Widen your feet to about shoulder-width apart for better stability',
                'frame': frame_number,
                'measurement': f'Current: {foot_distance:.3f}, Target: {shoulder_width:.3f}'
            })
        elif foot_distance > shoulder_width * 1.5:
            errors.append({
                'type': 'stance',
                'issue': 'very_wide_stance',
                'description': f'Frame {frame_number}: Stance is extremely wide, affecting balance',
                'severity': 'high',
                'correction': 'Bring your feet significantly closer together',
                'frame': frame_number,
                'measurement': f'Current: {foot_distance:.3f}, Max recommended: {shoulder_width * 1.3:.3f}'
            })
        elif foot_distance > shoulder_width * 1.3:
            errors.append({
                'type': 'stance',
                'issue': 'wide_stance', 
                'description': f'Frame {frame_number}: Stance is wider than recommended',
                'severity': 'medium',
                'correction': 'Narrow your stance slightly for better balance and control',
                'frame': frame_number,
                'measurement': f'Current: {foot_distance:.3f}, Recommended: {shoulder_width:.3f}'
            })
            
        # Check foot angle and positioning
        foot_angle_diff = abs(left_ankle[1] - right_ankle[1])
        if foot_angle_diff > 0.05:
            errors.append({
                'type': 'stance',
                'issue': 'uneven_foot_height',
                'description': f'Frame {frame_number}: Feet are at different heights',
                'severity': 'medium',
                'correction': 'Ensure both feet are planted firmly and evenly on the ground',
                'frame': frame_number,
                'measurement': f'Height difference: {foot_angle_diff:.3f}'
            })
            
        # Check knee alignment
        knee_alignment = abs((left_knee[0] + right_knee[0])/2 - (left_ankle[0] + right_ankle[0])/2)
        if knee_alignment > 0.03:
            errors.append({
                'type': 'stance',
                'issue': 'knee_misalignment',
                'description': f'Frame {frame_number}: Knees are not properly aligned over feet',
                'severity': 'medium',
                'correction': 'Align your knees directly over your feet for better stability',
                'frame': frame_number,
                'measurement': f'Knee-foot alignment offset: {knee_alignment:.3f}'
            })
            
        # Check body alignment
        shoulder_center = [(left_shoulder[0] + right_shoulder[0]) / 2, (left_shoulder[1] + right_shoulder[1]) / 2]
        foot_center = [(left_ankle[0] + right_ankle[0]) / 2, (left_ankle[1] + right_ankle[1]) / 2]
        
        alignment_offset = abs(shoulder_center[0] - foot_center[0])
        metrics['body_alignment'] = alignment_offset
        
        if alignment_offset > 0.08:
            errors.append({
                'type': 'posture',
                'issue': 'severe_misalignment',
                'description': f'Frame {frame_number}: Severe body misalignment - shoulders far from center',
                'severity': 'high',
                'correction': 'Major posture adjustment needed - center your shoulders directly over your feet',
                'frame': frame_number,
                'measurement': f'Alignment offset: {alignment_offset:.3f} (critical threshold: 0.05)'
            })
        elif alignment_offset > 0.05:
            errors.append({
                'type': 'posture',
                'issue': 'moderate_misalignment',
                'description': f'Frame {frame_number}: Moderate body misalignment detected',
                'severity': 'medium',
                'correction': 'Adjust your posture to align shoulders more directly over your feet',
                'frame': frame_number,
                'measurement': f'Alignment offset: {alignment_offset:.3f} (target: <0.03)'
            })
        elif alignment_offset > 0.03:
            errors.append({
                'type': 'posture',
                'issue': 'minor_misalignment',
                'description': f'Frame {frame_number}: Minor body alignment issue',
                'severity': 'low',
                'correction': 'Fine-tune your posture for optimal vertical alignment',
                'frame': frame_number,
                'measurement': f'Alignment offset: {alignment_offset:.3f}'
            })
            
        return errors, metrics
    
    def analyze_draw_phase(self, landmarks):
        """Analyze the drawing phase of the shot"""
        errors = []
        metrics = {}
        
        if not landmarks:
            return errors, metrics
            
        # Get key points for draw analysis
        left_shoulder = [landmarks[self.key_landmarks['left_shoulder']].x, landmarks[self.key_landmarks['left_shoulder']].y]
        right_shoulder = [landmarks[self.key_landmarks['right_shoulder']].x, landmarks[self.key_landmarks['right_shoulder']].y]
        left_elbow = [landmarks[self.key_landmarks['left_elbow']].x, landmarks[self.key_landmarks['left_elbow']].y]
        right_elbow = [landmarks[self.key_landmarks['right_elbow']].x, landmarks[self.key_landmarks['right_elbow']].y]
        left_wrist = [landmarks[self.key_landmarks['left_wrist']].x, landmarks[self.key_landmarks['left_wrist']].y]
        right_wrist = [landmarks[self.key_landmarks['right_wrist']].x, landmarks[self.key_landmarks['right_wrist']].y]
        
        # Calculate elbow angles
        left_elbow_angle = self.calculate_angle(left_shoulder, left_elbow, left_wrist)
        right_elbow_angle = self.calculate_angle(right_shoulder, right_elbow, right_wrist)
        
        metrics['left_elbow_angle'] = left_elbow_angle
        metrics['right_elbow_angle'] = right_elbow_angle
        
        # Check draw arm (usually right arm for right-handed archer)
        # Ideal elbow angle during draw should be around 90-120 degrees
        if right_elbow_angle < 80:
            errors.append({
                'type': 'draw',
                'issue': 'collapsed_elbow',
                'description': 'Drawing elbow is collapsed. Keep elbow up and back.',
                'severity': 'high',
                'correction': 'Raise your drawing elbow to create proper back tension'
            })
        elif right_elbow_angle > 140:
            errors.append({
                'type': 'draw',
                'issue': 'high_elbow',
                'description': 'Drawing elbow is too high. Lower it slightly.',
                'severity': 'medium',
                'correction': 'Lower your drawing elbow to a more natural position'
            })
            
        # Check shoulder alignment during draw
        shoulder_height_diff = abs(left_shoulder[1] - right_shoulder[1])
        metrics['shoulder_alignment'] = shoulder_height_diff
        
        if shoulder_height_diff > 0.03:  # 3% threshold
            errors.append({
                'type': 'draw',
                'issue': 'uneven_shoulders',
                'description': 'Shoulders are not level during draw.',
                'severity': 'medium',
                'correction': 'Keep both shoulders level and relaxed during the draw'
            })
            
        return errors, metrics
    
    def analyze_video(self, video_path):
        """Analyze a complete archery video"""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        all_errors = []
        all_metrics = []
        pose_data = []
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            
            # Process every 5th frame to improve performance
            if frame_count % 5 != 0:
                continue
                
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process frame with MediaPipe
            results = pose.process(rgb_frame)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Analyze different aspects
                stance_errors, stance_metrics = self.analyze_stance(landmarks)
                draw_errors, draw_metrics = self.analyze_draw_phase(landmarks)
                
                # Combine results
                frame_errors = stance_errors + draw_errors
                frame_metrics = {**stance_metrics, **draw_metrics}
                
                all_errors.extend(frame_errors)
                all_metrics.append(frame_metrics)
                
                # Store pose data for visualization
                pose_data.append({
                    'frame': frame_count,
                    'timestamp': frame_count / fps,
                    'landmarks': [{'x': lm.x, 'y': lm.y, 'z': lm.z, 'visibility': lm.visibility} 
                                for lm in landmarks]
                })
        
        cap.release()
        
        # Generate feedback based on most common errors
        feedback = self.generate_feedback(all_errors)
        
        # Calculate summary metrics
        summary_metrics = self.calculate_summary_metrics(all_metrics)
        
        return {
            'errors': all_errors,
            'metrics': summary_metrics,
            'pose_data': pose_data[:20],  # Limit pose data for response size
            'feedback': feedback,
            'total_frames': total_frames,
            'analyzed_frames': len(all_metrics)
        }
    
    def generate_feedback(self, errors):
        """Generate actionable feedback based on detected errors"""
        feedback = []
        
        # Count error types
        error_counts = {}
        for error in errors:
            error_type = f"{error['type']}_{error['issue']}"
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        # Generate feedback for most common issues
        for error_type, count in error_counts.items():
            if count > 5:  # If error appears in more than 5 frames
                error_example = next(e for e in errors if f"{e['type']}_{e['issue']}" == error_type)
                feedback.append(f"⚠️ {error_example['correction']} (detected in {count} frames)")
        
        if not feedback:
            feedback.append("✅ Good form! No major errors detected.")
            
        return feedback
    
    def calculate_summary_metrics(self, all_metrics):
        """Calculate summary metrics from all frame metrics"""
        if not all_metrics:
            return {}
            
        summary = {}
        
        # Calculate averages for numeric metrics
        for key in ['foot_distance', 'body_alignment', 'left_elbow_angle', 'right_elbow_angle', 'shoulder_alignment']:
            values = [m.get(key) for m in all_metrics if m.get(key) is not None]
            if values:
                summary[f'avg_{key}'] = sum(values) / len(values)
                summary[f'std_{key}'] = np.std(values) if len(values) > 1 else 0
        
        return summary

# Initialize analyzer
analyzer = ArcheryAnalyzer()

@app.get("/")
async def root():
    return {"message": "AI Archery Form Analyzer API"}

@app.get("/api/sample-videos")
async def get_sample_videos():
    """Get list of sample archery videos"""
    video_dir = "/app/videos/Archery"
    videos = []
    
    if os.path.exists(video_dir):
        for filename in os.listdir(video_dir):
            if filename.endswith('.mp4'):
                videos.append({
                    'id': filename.replace('.mp4', ''),
                    'name': filename,
                    'path': f"/videos/Archery/{filename}",
                    'size': os.path.getsize(os.path.join(video_dir, filename))
                })
    
    return {'videos': videos}

@app.post("/api/analyze-video")
async def analyze_video_upload(file: UploadFile = File(...)):
    """Analyze uploaded archery video"""
    
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Save uploaded file temporarily
    video_id = str(uuid.uuid4())
    temp_path = f"/tmp/{video_id}.mp4"
    
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        
        # Analyze video
        result = analyzer.analyze_video(temp_path)
        result['video_id'] = video_id
        result['filename'] = file.filename
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/analyze-sample/{video_id}")
async def analyze_sample_video(video_id: str):
    """Analyze one of the sample archery videos"""
    
    video_path = f"/app/videos/Archery/{video_id}.mp4"
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        result = analyzer.analyze_video(video_path)
        result['video_id'] = video_id
        result['filename'] = f"{video_id}.mp4"
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)