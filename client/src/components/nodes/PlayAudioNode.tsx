import { memo, useState, useRef, useCallback } from "react";
import { Copy, Pencil, Trash2, Volume2, ChevronRight, HelpCircle, Upload, Mic, Play, Pause, X, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface PlayAudioNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const PlayAudioNode = ({ id, data, onClone, onDelete, onUpdate }: PlayAudioNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFallbackText, setEditedFallbackText] = useState(data.fallbackText || "");
  const [editedAudioFileName, setEditedAudioFileName] = useState(data.audioFileName || "");
  const [editedAudioData, setEditedAudioData] = useState<string | null>(data.audioData || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClone) onClone(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(data.label || "");
    setEditedFallbackText(data.fallbackText || "");
    setEditedAudioFileName(data.audioFileName || "");
    setEditedAudioData(data.audioData || null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editedName.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter a name for this node",
        variant: "destructive"
      });
      return;
    }

    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        fallbackText: editedFallbackText,
        audioFileName: editedAudioFileName,
        audioData: editedAudioData,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedFallbackText(data.fallbackText || "");
    setEditedAudioFileName(data.audioFileName || "");
    setEditedAudioData(data.audioData || null);
    setIsPlaying(false);
    setIsRecording(false);
    setIsEditModalOpen(false);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/wave"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an MP3, M4A, or WAV file",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 15MB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditedAudioData(reader.result as string);
      setEditedAudioFileName(file.name);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [toast]);

  const handleRemoveAudio = () => {
    setEditedAudioData(null);
    setEditedAudioFileName("");
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const togglePlayback = () => {
    const audioSrc = editedAudioData || data.audioData;
    if (!audioSrc) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
      audioRef.current.onended = () => setIsPlaying(false);
    } else {
      audioRef.current.src = audioSrc;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlaybackPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.audioData) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(data.audioData);
      audioRef.current.onended = () => setIsPlaying(false);
    } else if (audioRef.current.src !== data.audioData) {
      audioRef.current.src = data.audioData;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/wav" });
        const reader = new FileReader();
        reader.onload = () => {
          setEditedAudioData(reader.result as string);
          setEditedAudioFileName("recorded-audio.wav");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribeAudio = () => {
    toast({
      title: "Transcription",
      description: "Audio transcription will be available when connected to a speech-to-text service.",
    });
  };

  const hasAudio = !!(editedAudioData || data.audioData);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100">
            <Volume2 className="w-4 h-4 text-indigo-700" />
            <span className="text-sm font-medium text-indigo-700">Play Audio</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-indigo-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.play_audio?.tooltip || "Plays a pre-recorded audio file during the call."}</p>
                  {nodeDescriptions.play_audio?.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.play_audio.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleClone}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              title="Clone"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-blue-500 hover:text-blue-700"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500 hover:text-red-700"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Node Content */}
        <div className="px-4 py-3">
          {/* Node Name */}
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "Play Audio Node"}
          </h3>

          {/* Audio Preview */}
          {data.audioData ? (
            <button
              onClick={togglePlaybackPreview}
              className="w-full flex items-center gap-2.5 bg-indigo-50 rounded-lg px-3 py-2.5 border border-indigo-200 hover:bg-indigo-100 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-white" />
                ) : (
                  <Play className="w-4 h-4 text-white ml-0.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-indigo-700 truncate">
                  {data.audioFileName || "Audio file"}
                </p>
                <p className="text-[11px] text-indigo-500">
                  {isPlaying ? "Playing..." : "Click to play"}
                </p>
              </div>
            </button>
          ) : (
            <div className="bg-amber-50 rounded-lg px-3 py-2 text-sm border border-amber-200">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-amber-700 font-medium">No audio file linked</span>
              </div>
            </div>
          )}

          {/* Fallback text preview */}
          {data.fallbackText && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
              Fallback: {data.fallbackText}
            </p>
          )}
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-200">
            <span className="text-sm font-medium text-indigo-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Node configuration</DialogTitle>
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveEdit} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="nodeName" className="text-sm font-semibold text-gray-700">Name</Label>
              <Input
                id="nodeName"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter node name..."
              />
            </div>

            {/* Audio File */}
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Audio file</Label>

              {(editedAudioData) ? (
                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayback}
                      className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {editedAudioFileName || "Audio file"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isPlaying ? "Playing..." : "Ready to play"}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveAudio}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove audio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50">
                  {/* Upload area */}
                  <div
                    className="flex flex-col items-center justify-center py-6 px-4 cursor-pointer hover:bg-gray-100/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                      <Upload className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Click to upload file</p>
                    <p className="text-xs text-gray-400 mt-0.5">MP3, M4A or WAV (up to 15MB)</p>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 px-6">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">OR</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Record button */}
                  <div className="flex justify-center py-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-colors font-medium text-sm ${
                        isRecording
                          ? "border-red-400 bg-red-50 text-red-600 hover:bg-red-100"
                          : "border-red-300 bg-white text-red-500 hover:bg-red-50"
                      }`}
                    >
                      <Mic className={`w-4 h-4 ${isRecording ? "animate-pulse" : ""}`} />
                      {isRecording ? "Stop recording" : "Record audio"}
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Fallback Text */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="fallbackText" className="text-sm font-semibold text-gray-700">Fallback text</Label>
                <button
                  onClick={handleTranscribeAudio}
                  className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                  disabled={!editedAudioData}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Transcribe audio
                </button>
              </div>
              <Textarea
                id="fallbackText"
                value={editedFallbackText}
                onChange={(e) => setEditedFallbackText(e.target.value)}
                placeholder="Enter text to speak if audio fails or is missing..."
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="sr-only">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(PlayAudioNode);
