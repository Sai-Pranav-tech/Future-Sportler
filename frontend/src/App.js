import React, { useState, useRef } from 'react';
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
import { Upload, Play, Target, Activity, AlertTriangle, CheckCircle2, TrendingUp, Users, Eye, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sampleVideos, setSampleVideos] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
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

  // Group errors by type
  const groupErrorsByType = (errors) => {
    const grouped = {};
    errors.forEach(error => {
      if (!grouped[error.type]) {
        grouped[error.type] = [];
      }
      grouped[error.type].push(error);
    });
    return grouped;
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
                          <span>Key Recommendations</span>
                        </h4>
                        {analysis.feedback.map((feedback, index) => (
                          <Alert key={index} className="border-l-4 border-l-blue-500">
                            <AlertDescription>{feedback}</AlertDescription>
                          </Alert>
                        ))}
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
                            {Object.entries(groupErrorsByType(analysis.errors)).map(([type, errors]) => (
                              <div key={type} className="space-y-2">
                                <h4 className="font-semibold capitalize flex items-center space-x-2">
                                  {getErrorTypeIcon(type)}
                                  <span>{type} Issues ({errors.length})</span>
                                </h4>
                                <div className="space-y-2">
                                  {errors.map((error, index) => (
                                    <div key={index} className={`p-4 rounded-lg border ${getSeverityColor(error.severity)}`}>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="font-medium">{error.description}</div>
                                          <div className="text-sm mt-1 opacity-80">{error.correction}</div>
                                        </div>
                                        <Badge variant="outline" className="ml-2">
                                          {error.severity}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <Separator />
                              </div>
                            ))}
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
                        <div className="text-center py-8 text-gray-500">
                          <Activity className="w-12 h-12 mx-auto mb-4" />
                          <h3 className="font-medium">Pose Data Captured</h3>
                          <p>
                            {analysis.pose_data?.length || 0} keyframe(s) with pose landmarks detected
                          </p>
                          <div className="text-sm mt-2 text-blue-600">
                            3D visualization coming soon...
                          </div>
                        </div>
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