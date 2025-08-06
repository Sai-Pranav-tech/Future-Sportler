#!/usr/bin/env python3
"""
Backend API Testing for AI Archery Form Analyzer
Tests all endpoints and validates AI analysis functionality
"""

import requests
import sys
import json
import os
from datetime import datetime

class ArcheryAPITester:
    def __init__(self, base_url="https://9e7543cb-d619-4f54-8781-c3c56cb73461.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.sample_videos = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
        
        if details:
            print(f"   Details: {details}")
        print()

    def test_root_endpoint(self):
        """Test the root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expected_message = "AI Archery Form Analyzer API"
                success = data.get("message") == expected_message
                details = f"Status: {response.status_code}, Message: {data.get('message', 'N/A')}"
            else:
                details = f"Status: {response.status_code}"
                
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test("Root Endpoint", success, details)
        return success

    def test_sample_videos_endpoint(self):
        """Test GET /api/sample-videos endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/sample-videos", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                videos = data.get("videos", [])
                self.sample_videos = videos
                
                # Validate response structure
                expected_videos = ["Video-1", "Video-2", "Video-3", "Video-4", "Video-5"]
                found_videos = [v.get("id") for v in videos]
                
                success = len(videos) == 5 and all(vid in found_videos for vid in expected_videos)
                
                # Check video structure
                if success and videos:
                    sample_video = videos[0]
                    required_fields = ["id", "name", "path", "size"]
                    success = all(field in sample_video for field in required_fields)
                
                details = f"Status: {response.status_code}, Videos found: {len(videos)}, IDs: {found_videos}"
            else:
                details = f"Status: {response.status_code}"
                
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test("Sample Videos Endpoint", success, details)
        return success

    def test_analyze_sample_video(self, video_id):
        """Test GET /api/analyze-sample/{video_id} endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/analyze-sample/{video_id}", timeout=30)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ["video_id", "errors", "metrics", "pose_data", "feedback", "total_frames", "analyzed_frames"]
                success = all(field in data for field in required_fields)
                
                if success:
                    # Validate data types and content
                    errors = data.get("errors", [])
                    metrics = data.get("metrics", {})
                    pose_data = data.get("pose_data", [])
                    feedback = data.get("feedback", [])
                    
                    # Check if analysis actually found something meaningful
                    has_analysis = (
                        isinstance(errors, list) and
                        isinstance(metrics, dict) and
                        isinstance(pose_data, list) and
                        isinstance(feedback, list) and
                        data.get("analyzed_frames", 0) > 0
                    )
                    
                    success = has_analysis
                    
                    details = f"Status: {response.status_code}, Analyzed frames: {data.get('analyzed_frames', 0)}, Errors: {len(errors)}, Metrics: {len(metrics)}, Pose data: {len(pose_data)}, Feedback: {len(feedback)}"
                else:
                    missing_fields = [field for field in required_fields if field not in data]
                    details = f"Status: {response.status_code}, Missing fields: {missing_fields}"
            else:
                details = f"Status: {response.status_code}"
                
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test(f"Analyze Sample Video ({video_id})", success, details)
        return success, data if success else {}

    def test_analyze_sample_video_not_found(self):
        """Test GET /api/analyze-sample/{video_id} with non-existent video"""
        try:
            response = requests.get(f"{self.base_url}/api/analyze-sample/NonExistent", timeout=10)
            success = response.status_code == 404
            details = f"Status: {response.status_code} (Expected 404)"
                
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test("Analyze Non-existent Video (404 Test)", success, details)
        return success

    def test_upload_video_endpoint(self):
        """Test POST /api/analyze-video endpoint with a sample video"""
        try:
            # Use one of the sample videos for upload test
            video_path = "/app/videos/Archery/Video-1.mp4"
            
            if not os.path.exists(video_path):
                success = False
                details = f"Sample video not found: {video_path}"
            else:
                with open(video_path, 'rb') as video_file:
                    files = {'file': ('test_video.mp4', video_file, 'video/mp4')}
                    response = requests.post(f"{self.base_url}/api/analyze-video", files=files, timeout=60)
                    
                success = response.status_code == 200
                
                if success:
                    data = response.json()
                    
                    # Validate response structure (same as sample video analysis)
                    required_fields = ["video_id", "errors", "metrics", "pose_data", "feedback", "total_frames", "analyzed_frames"]
                    success = all(field in data for field in required_fields)
                    
                    if success:
                        details = f"Status: {response.status_code}, Video ID: {data.get('video_id', 'N/A')}, Analyzed frames: {data.get('analyzed_frames', 0)}"
                    else:
                        missing_fields = [field for field in required_fields if field not in data]
                        details = f"Status: {response.status_code}, Missing fields: {missing_fields}"
                else:
                    details = f"Status: {response.status_code}"
                    
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test("Upload Video Analysis", success, details)
        return success

    def test_upload_invalid_file(self):
        """Test POST /api/analyze-video with invalid file type"""
        try:
            # Create a fake text file
            fake_file_content = b"This is not a video file"
            files = {'file': ('fake.txt', fake_file_content, 'text/plain')}
            
            response = requests.post(f"{self.base_url}/api/analyze-video", files=files, timeout=10)
            success = response.status_code == 400  # Should return bad request
            details = f"Status: {response.status_code} (Expected 400 for invalid file type)"
                
        except Exception as e:
            success = False
            details = f"Error: {str(e)}"
            
        self.log_test("Upload Invalid File Type (400 Test)", success, details)
        return success

    def validate_ai_analysis_quality(self, analysis_results):
        """Validate the quality and meaningfulness of AI analysis"""
        quality_score = 0
        total_checks = 0
        issues = []

        for video_id, result in analysis_results.items():
            if not result:
                continue
                
            total_checks += 5  # 5 quality checks per video
            
            # Check 1: Has meaningful error detection
            errors = result.get("errors", [])
            if errors and len(errors) > 0:
                # Check if errors have proper structure
                sample_error = errors[0]
                if all(key in sample_error for key in ["type", "issue", "description", "severity", "correction"]):
                    quality_score += 1
                else:
                    issues.append(f"{video_id}: Error structure incomplete")
            else:
                # It's okay to have no errors, but should have some analysis
                quality_score += 0.5
            
            # Check 2: Has quantified metrics
            metrics = result.get("metrics", {})
            if metrics and len(metrics) > 0:
                # Check if metrics are numeric and reasonable
                numeric_metrics = [v for v in metrics.values() if isinstance(v, (int, float))]
                if len(numeric_metrics) > 0:
                    quality_score += 1
                else:
                    issues.append(f"{video_id}: No numeric metrics found")
            else:
                issues.append(f"{video_id}: No metrics provided")
            
            # Check 3: Has pose data
            pose_data = result.get("pose_data", [])
            if pose_data and len(pose_data) > 0:
                # Check if pose data has proper structure
                sample_pose = pose_data[0]
                if "landmarks" in sample_pose and len(sample_pose["landmarks"]) > 0:
                    quality_score += 1
                else:
                    issues.append(f"{video_id}: Pose data structure incomplete")
            else:
                issues.append(f"{video_id}: No pose data captured")
            
            # Check 4: Has actionable feedback
            feedback = result.get("feedback", [])
            if feedback and len(feedback) > 0:
                # Check if feedback is meaningful (not just generic)
                meaningful_feedback = [f for f in feedback if len(f) > 20 and ("⚠️" in f or "✅" in f)]
                if meaningful_feedback:
                    quality_score += 1
                else:
                    issues.append(f"{video_id}: Feedback not actionable enough")
            else:
                issues.append(f"{video_id}: No feedback provided")
            
            # Check 5: Analyzed reasonable number of frames
            analyzed_frames = result.get("analyzed_frames", 0)
            total_frames = result.get("total_frames", 0)
            if analyzed_frames > 0 and total_frames > 0:
                analysis_ratio = analyzed_frames / total_frames
                if analysis_ratio > 0.1:  # At least 10% of frames analyzed
                    quality_score += 1
                else:
                    issues.append(f"{video_id}: Too few frames analyzed ({analyzed_frames}/{total_frames})")
            else:
                issues.append(f"{video_id}: Frame analysis data missing")

        quality_percentage = (quality_score / total_checks * 100) if total_checks > 0 else 0
        
        print(f"\n🎯 AI Analysis Quality Assessment:")
        print(f"   Quality Score: {quality_score}/{total_checks} ({quality_percentage:.1f}%)")
        
        if issues:
            print(f"   Issues Found:")
            for issue in issues[:10]:  # Show first 10 issues
                print(f"   - {issue}")
            if len(issues) > 10:
                print(f"   ... and {len(issues) - 10} more issues")
        
        return quality_percentage >= 70  # 70% quality threshold

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏹 Starting AI Archery Form Analyzer Backend Tests")
        print("=" * 60)
        
        # Test 1: Root endpoint
        self.test_root_endpoint()
        
        # Test 2: Sample videos endpoint
        if not self.test_sample_videos_endpoint():
            print("❌ Cannot proceed with sample video tests - sample videos endpoint failed")
            return False
        
        # Test 3: Analyze each sample video
        analysis_results = {}
        video_ids = ["Video-1", "Video-2", "Video-3", "Video-4", "Video-5"]
        
        for video_id in video_ids:
            success, result = self.test_analyze_sample_video(video_id)
            if success:
                analysis_results[video_id] = result
        
        # Test 4: Test non-existent video (404)
        self.test_analyze_sample_video_not_found()
        
        # Test 5: Upload video analysis
        self.test_upload_video_endpoint()
        
        # Test 6: Upload invalid file (400)
        self.test_upload_invalid_file()
        
        # Test 7: AI Analysis Quality Assessment
        if analysis_results:
            ai_quality_good = self.validate_ai_analysis_quality(analysis_results)
            self.log_test("AI Analysis Quality", ai_quality_good, 
                         "AI provides meaningful archery form analysis" if ai_quality_good else "AI analysis needs improvement")
        
        # Final Results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend is working correctly.")
            return True
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} test(s) failed. Backend needs attention.")
            return False

def main():
    """Main test execution"""
    tester = ArcheryAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())