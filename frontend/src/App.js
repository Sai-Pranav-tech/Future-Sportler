import React, { useState, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import './App.css';

// UI Components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Alert, AlertDescription } from './components/ui/alert';
import { Separator } from './components/ui/separator';

// Icons
import { Upload, Play, Target, Activity, AlertTriangle, CheckCircle2, TrendingUp, Users, Eye, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// 3D Pose Visualization Component
function PoseVisualization({ poseData }) {
  if (!poseData || poseData.length === 0) {
    return null;
  }

  // Use the first frame with pose data for static visualization
  const firstFrame = poseData[0];
  if (!firstFrame || !firstFrame.landmarks) {
    return null;
  }

  const landmarks = firstFrame.landmarks;

  // MediaPipe pose connections (simplified key connections for archery analysis)
  const connections = [
    // Spine and torso
    [11, 12], // Left shoulder to right shoulder
    [11, 23], // Left shoulder to left hip
    [12, 24], // Right shoulder to right hip
    [23, 24], // Left hip to right hip
    
    // Arms
    [11, 13], // Left shoulder to left elbow
    [13, 15], // Left elbow to left wrist
    [12, 14], // Right shoulder to right elbow
    [14, 16], // Right elbow to right wrist
    
    // Legs
    [23, 25], // Left hip to left knee
    [25, 27], // Left knee to left ankle
    [24, 26], // Right hip to right knee
    [26, 28], // Right knee to right ankle
  ];

  return (
    <group>
      {/* Draw landmarks as spheres */}
      {landmarks.map((landmark, index) => (
        <Sphere 
          key={index}
          position={[
            (landmark.x - 0.5) * 4,  // Scale and center X
            (0.5 - landmark.y) * 4,  // Scale and flip Y
            landmark.z * 2            // Scale Z
          ]}
          args={[0.05, 8, 8]}
        >
          <meshBasicMaterial color={
            index === 11 || index === 12 ? "#ff6b6b" : // Shoulders - red
            index === 13 || index === 14 ? "#4ecdc4" : // Elbows - teal  
            index === 15 || index === 16 ? "#45b7d1" : // Wrists - blue
            index === 23 || index === 24 ? "#96ceb4" : // Hips - green
            "#ffeaa7"  // Other points - yellow
          } />
        </Sphere>
      ))}
      
      {/* Draw connections as lines */}
      {connections.map((connection, index) => {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        
        if (!start || !end) return null;
        
        const startPos = [
          (start.x - 0.5) * 4,
          (0.5 - start.y) * 4,
          start.z * 2
        ];
        const endPos = [
          (end.x - 0.5) * 4,
          (0.5 - end.y) * 4,
          end.z * 2
        ];
        
        return (
          <Line
            key={index}
            points={[startPos, endPos]}
            color="#6c5ce7"
            lineWidth={2}
          />
        );
      })}
      
      {/* Add axis labels */}
      <Text position={[2.5, 0, 0]} fontSize={0.2} color="#666">X</Text>
      <Text position={[0, 2.5, 0]} fontSize={0.2} color="#666">Y</Text>
      <Text position={[0, 0, 1.5]} fontSize={0.2} color="#666">Z</Text>
    </group>
  );
}

function App() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sampleVideos, setSampleVideos] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showAllErrors, setShowAllErrors] = useState({});
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const fileInputRef = useRef(null);

  // Load sample videos on component mount
  React.useEffect(() => {
    fetch(`${BACKEND_URL}/api/sample-videos`)
      .then(res => res.json())
      .then(data => setSampleVideos(data.videos || []))
      .catch(err => console.error('Failed to load sample videos:', err));
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setUploadedFile(file);
      setSelectedVideo(null);
      setAnalysis(null);
    }
  };

  const analyzeVideo = async (isUpload = false) => {
    setLoading(true);
    setAnalysis(null);

    try {
      let response;
      
      if (isUpload && uploadedFile) {
        // Analyze uploaded video
        const formData = new FormData();
        formData.append('file', uploadedFile);
        
        response = await fetch(`${BACKEND_URL}/api/analyze-video`, {
          method: 'POST',
          body: formData
        });
      } else if (selectedVideo) {
        // Analyze sample video
        response = await fetch(`${BACKEND_URL}/api/analyze-sample/${selectedVideo}`);
      } else {
        throw new Error('No video selected');
      }

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getErrorTypeIcon = (type) => {
    switch (type) {
      case 'stance': return <Users className="w-4 h-4" />;
      case 'posture': return <Activity className="w-4 h-4" />;
      case 'draw': return <Target className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // Group errors by type and prioritize by severity
  const groupErrorsByType = (errors) => {
    const grouped = {};
    errors.forEach(error => {
      if (!grouped[error.type]) {
        grouped[error.type] = [];
      }
      grouped[error.type].push(error);
    });
    
    // Sort each group by severity (high -> medium -> low)
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      });
    });
    
    return grouped;
  };

  const getTopPriorityErrors = (errors, limit = 5) => {
    return errors
      .sort((a, b) => {
        const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      })
      .slice(0, limit);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  AI Archery Form Analyzer
                </h1>
                <p className="text-sm text-gray-500">Advanced biomechanical analysis for perfect form</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Eye className="w-4 h-4" />
              <span>Powered by MediaPipe</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Video Selection & Upload */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Section */}
            <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-blue-500" />
                  <span>Upload Video</span>
                </CardTitle>
                <CardDescription>
                  Upload your archery video for analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {uploadedFile ? uploadedFile.name : 'Click to upload video'}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadedFile && (
                    <Button 
                      onClick={() => analyzeVideo(true)} 
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Analyze Upload
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sample Videos */}
            <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Play className="w-5 h-5 text-green-500" />
                  <span>Sample Videos</span>
                </CardTitle>
                <CardDescription>
                  Try analysis with provided archery videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sampleVideos.map((video) => (
                    <div 
                      key={video.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedVideo === video.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedVideo(video.id);
                        setUploadedFile(null);
                        setAnalysis(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{video.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(video.size / 1024)} KB
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {selectedVideo && (
                    <Button 
                      onClick={() => analyzeVideo(false)} 
                      disabled={loading}
                      className="w-full mt-4 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Target className="w-4 h-4 mr-2" />
                          Analyze Sample
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Analysis Results */}
          <div className="lg:col-span-2">
            {loading && (
              <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold mb-2">Analyzing Archery Form</h3>
                  <p className="text-gray-600 mb-4">Processing video with AI pose estimation...</p>
                  <Progress value={75} className="w-full max-w-md mx-auto" />
                </CardContent>
              </Card>
            )}

            {analysis && (
              <div className="space-y-6">
                {/* Analysis Summary */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      <span>Analysis Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{analysis.analyzed_frames}</div>
                        <div className="text-sm text-blue-600">Frames Analyzed</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{analysis.errors?.length || 0}</div>
                        <div className="text-sm text-red-600">Issues Detected</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{analysis.feedback?.length || 0}</div>
                        <div className="text-sm text-green-600">Recommendations</div>
                      </div>
                    </div>

                    {/* Key Feedback */}
                    {analysis.feedback && analysis.feedback.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Top Priority Recommendations</span>
                        </h4>
                        {analysis.feedback.slice(0, showAllRecommendations ? analysis.feedback.length : 3).map((feedback, index) => (
                          <Alert key={index} className="border-l-4 border-l-blue-500">
                            <AlertDescription>{feedback}</AlertDescription>
                          </Alert>
                        ))}
                        {analysis.feedback.length > 3 && (
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                            className="mt-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            {showAllRecommendations ? (
                              <>Show Less <ChevronUp className="w-4 h-4 ml-1" /></>
                            ) : (
                              <>Show {analysis.feedback.length - 3} More Recommendations <ChevronDown className="w-4 h-4 ml-1" /></>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detailed Analysis */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Detailed Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="errors" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="errors">Error Detection</TabsTrigger>
                        <TabsTrigger value="metrics">Metrics</TabsTrigger>
                        <TabsTrigger value="pose">Pose Data</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="errors" className="mt-6">
                        {analysis.errors && analysis.errors.length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(groupErrorsByType(analysis.errors)).map(([type, errors]) => {
                              const showAll = showAllErrors[type] || false;
                              const displayErrors = showAll ? errors : getTopPriorityErrors(errors, 5);
                              
                              return (
                                <div key={type} className="space-y-2">
                                  <h4 className="font-semibold capitalize flex items-center space-x-2">
                                    {getErrorTypeIcon(type)}
                                    <span>{type} Issues ({errors.length})</span>
                                    {errors.length > 5 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {showAll ? 'All' : 'Top 5'}
                                      </Badge>
                                    )}
                                  </h4>
                                  <div className="space-y-2">
                                    {displayErrors.map((error, index) => (
                                      <div key={index} className={`p-4 rounded-lg border ${getSeverityColor(error.severity)}`}>
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="font-medium">{error.description}</div>
                                            <div className="text-sm mt-1 opacity-80">{error.correction}</div>
                                            {error.measurement && (
                                              <div className="text-xs mt-1 font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                {error.measurement}
                                              </div>
                                            )}
                                          </div>
                                          <Badge variant="outline" className="ml-2">
                                            {error.severity}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                    {errors.length > 5 && (
                                      <Button
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowAllErrors(prev => ({
                                          ...prev,
                                          [type]: !prev[type]
                                        }))}
                                        className="w-full mt-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                      >
                                        {showAll ? (
                                          <>Show Less <ChevronUp className="w-4 h-4 ml-1" /></>
                                        ) : (
                                          <>Show {errors.length - 5} More {type} Issues <ChevronDown className="w-4 h-4 ml-1" /></>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                  <Separator />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                            <h3 className="font-medium">Excellent Form!</h3>
                            <p>No major errors detected in your archery technique.</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="metrics" className="mt-6">
                        {analysis.metrics && Object.keys(analysis.metrics).length > 0 ? (
                          <div className="grid md:grid-cols-2 gap-4">
                            {Object.entries(analysis.metrics).map(([key, value]) => (
                              <div key={key} className="p-4 bg-gray-50 rounded-lg">
                                <div className="font-medium capitalize">
                                  {key.replace(/_/g, ' ')}
                                </div>
                                <div className="text-2xl font-bold text-blue-600">
                                  {typeof value === 'number' ? value.toFixed(2) : value}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No metrics data available
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="pose" className="mt-6">
                        {analysis.pose_data && analysis.pose_data.length > 0 ? (
                          <div className="space-y-6">
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-6">
                              <h4 className="font-semibold mb-4 flex items-center space-x-2">
                                <Activity className="w-5 h-5 text-blue-500" />
                                <span>3D Pose Visualization</span>
                              </h4>
                              
                              <div className="h-96 bg-white rounded-lg border overflow-hidden">
                                <Canvas camera={{ position: [3, 3, 5], fov: 60 }}>
                                  <Suspense fallback={null}>
                                    <ambientLight intensity={0.6} />
                                    <pointLight position={[10, 10, 10]} />
                                    <PoseVisualization poseData={analysis.pose_data} />
                                    <OrbitControls />
                                    <gridHelper args={[8, 8]} />
                                  </Suspense>
                                </Canvas>
                              </div>
                              
                              <div className="mt-4 text-sm text-gray-600 space-y-1">
                                <p><strong>🔴 Red:</strong> Shoulders | <strong>🟢 Teal:</strong> Elbows | <strong>🔵 Blue:</strong> Wrists</p>
                                <p><strong>🟢 Green:</strong> Hips | <strong>🟡 Yellow:</strong> Other key points</p>
                                <p className="text-xs mt-2 opacity-75">Use mouse to rotate, zoom, and pan the 3D view</p>
                              </div>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-white p-4 rounded-lg border">
                                <h5 className="font-medium text-gray-800 mb-2">Pose Statistics</h5>
                                <div className="space-y-1 text-sm">
                                  <div>Keyframes captured: <span className="font-mono text-blue-600">{analysis.pose_data.length}</span></div>
                                  <div>Landmarks per frame: <span className="font-mono text-blue-600">{analysis.pose_data[0]?.landmarks?.length || 0}</span></div>
                                  <div>Visualization: <span className="font-mono text-green-600">Real-time 3D</span></div>
                                </div>
                              </div>
                              
                              <div className="bg-white p-4 rounded-lg border">
                                <h5 className="font-medium text-gray-800 mb-2">Analysis Quality</h5>
                                <div className="space-y-1 text-sm">
                                  <div>Pose detection: <span className="font-mono text-green-600">Active</span></div>
                                  <div>3D reconstruction: <span className="font-mono text-green-600">Complete</span></div>
                                  <div>Biomechanical analysis: <span className="font-mono text-green-600">Running</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Activity className="w-12 h-12 mx-auto mb-4" />
                            <h3 className="font-medium">No Pose Data Available</h3>
                            <p>
                              Run analysis on a video to see 3D pose visualization
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}

            {!loading && !analysis && (
              <Card className="border-0 shadow-lg bg-white/60 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold mb-2">Ready to Analyze</h3>
                  <p className="text-gray-600">
                    Select a sample video or upload your own archery video to get started with AI-powered form analysis.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-gray-500">
            <p>AI Archery Form Analyzer - Advanced biomechanical analysis for perfect archery form</p>
            <p className="text-sm mt-2">Powered by MediaPipe pose estimation and computer vision</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;