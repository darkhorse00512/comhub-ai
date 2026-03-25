import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Volume2,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Timer,
  Key,
  Settings,
  VolumeX,
  Brain,
  Info,
  Music,
  Play,
  Pause,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  config: any;
}

interface AgentConfigureSectionProps {
  agent: Agent;
  onAgentUpdate: (agent: Agent) => void;
}

const InfoTooltip = ({ text }: { text: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const AgentConfigureSection = ({ agent, onAgentUpdate }: AgentConfigureSectionProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const existingSettings = agent.config?.settings || {};

  // Agent info
  const [agentName, setAgentName] = useState(agent.name || "");
  const [agentDescription, setAgentDescription] = useState(agent.description || "");

  // Existing settings
  const [settings, setSettings] = useState({
    language: existingSettings.language || "en-US",
    ttsProvider: existingSettings.ttsProvider || "openai",
    openaiVoice: existingSettings.openaiVoice || "alloy",
    elevenlabsApiKey: existingSettings.elevenlabsApiKey || "",
    elevenlabsVoiceId: existingSettings.elevenlabsVoiceId || "",
    maxCallDuration: existingSettings.maxCallDuration?.toString() || "600",
    silenceTimeout: existingSettings.silenceTimeout?.toString() || "2",
    speechTimeout: existingSettings.speechTimeout || "auto",
    // Background noise
    backgroundNoiseEnabled: existingSettings.backgroundNoiseEnabled ?? false,
    backgroundNoiseType: existingSettings.backgroundNoiseType || "office",
    backgroundNoiseApplyTo: existingSettings.backgroundNoiseApplyTo || "whole_call",
    backgroundNoiseVolume: existingSettings.backgroundNoiseVolume ?? 0.28,
    // On Idle
    onIdleMessage: existingSettings.onIdleMessage || "",
    onIdleTimeout: existingSettings.onIdleTimeout?.toString() || "10",
    onIdleThreshold: existingSettings.onIdleThreshold?.toString() || "3",
    onIdleTerminationMessage: existingSettings.onIdleTerminationMessage || "",
    // Interruption
    interruptionSensitivity: existingSettings.interruptionSensitivity || "low",
    interruptionWordCountThreshold: existingSettings.interruptionWordCountThreshold?.toString() || "1",
    // ComhubAI Voice
    comhubaiVoiceModelId: existingSettings.comhubaiVoiceModelId || "",
    // AI Model
    aiModel: existingSettings.aiModel || "",
  });

  const [showApiKey, setShowApiKey] = useState(false);

  // ComhubAI Voice Library
  const [voiceLibraryOpen, setVoiceLibraryOpen] = useState(false);
  const [voiceModels, setVoiceModels] = useState<any[]>([]);
  const [voiceModelsLoading, setVoiceModelsLoading] = useState(false);
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<any>(null);
  const [playingModelId, setPlayingModelId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Load selected voice model info on mount if comhubai is selected
  useEffect(() => {
    if (settings.ttsProvider === "comhubai" && existingSettings.comhubaiVoiceModelId && !selectedVoiceModel) {
      (async () => {
        const result = await api.getPublicVoiceModels();
        if (result.data) {
          const model = result.data.find((m: any) => m.id === existingSettings.comhubaiVoiceModelId);
          if (model) setSelectedVoiceModel(model);
        }
      })();
    }
  }, []);

  const openVoiceLibrary = async () => {
    setVoiceLibraryOpen(true);
    setVoiceModelsLoading(true);
    const result = await api.getPublicVoiceModels();
    if (result.data) {
      setVoiceModels(result.data);
    }
    setVoiceModelsLoading(false);
  };

  const selectVoiceModel = (model: any) => {
    setSelectedVoiceModel(model);
    setSettings({ ...settings, comhubaiVoiceModelId: model.id });
    setVoiceLibraryOpen(false);
    stopAudio();
  };

  const handlePlayPreview = (model: any) => {
    if (!model.preview_audio_url) return;

    if (playingModelId === model.id) {
      stopAudio();
      return;
    }

    stopAudio();
    const audio = new Audio(model.preview_audio_url);
    audio.onended = () => setPlayingModelId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingModelId(model.id);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingModelId(null);
  };

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast({
        title: "Error",
        description: "Agent name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const updatedConfig = {
      ...agent.config,
      settings: {
        ...settings,
        maxCallDuration: parseInt(settings.maxCallDuration) || 600,
        silenceTimeout: settings.silenceTimeout === "auto" ? 2 : (parseInt(settings.silenceTimeout) || 2),
        speechTimeout: settings.speechTimeout,
        backgroundNoiseVolume: settings.backgroundNoiseVolume,
        onIdleTimeout: parseInt(settings.onIdleTimeout) || 10,
        onIdleThreshold: parseInt(settings.onIdleThreshold) || 3,
        interruptionWordCountThreshold: parseInt(settings.interruptionWordCountThreshold) || 1,
      },
    };

    const result = await api.updateAgent(agent.id, {
      name: agentName.trim(),
      description: agentDescription.trim(),
      config: updatedConfig,
    });
    setSaving(false);

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      onAgentUpdate({
        ...agent,
        name: agentName.trim(),
        description: agentDescription.trim(),
        config: updatedConfig,
      });
      toast({
        title: "Settings saved",
        description: "Agent configuration updated successfully.",
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Configure</h2>
            <p className="text-muted-foreground mt-1">
              Manage your agent's settings
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="gap-1.5">
              <Settings className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="voice" className="gap-1.5">
              <Volume2 className="w-4 h-4" />
              Voice & Audio
            </TabsTrigger>
            <TabsTrigger value="call" className="gap-1.5">
              <Timer className="w-4 h-4" />
              Call Settings
            </TabsTrigger>
          </TabsList>

          {/* ===== GENERAL TAB ===== */}
          <TabsContent value="general" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Agent Section */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-primary">Agent</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        Agent Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Enter agent name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Agent Description</Label>
                      <Textarea
                        value={agentDescription}
                        onChange={(e) => setAgentDescription(e.target.value)}
                        placeholder="Describe what this agent does..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* AI Model */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-primary">
                      <Brain className="w-4 h-4" />
                      AI Model
                    </CardTitle>
                    <CardDescription>
                      Default model for all dialogue nodes. Can be overridden per node.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={settings.aiModel || "__default__"}
                      onValueChange={(v) =>
                        setSettings({ ...settings, aiModel: v === "__default__" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Server default (gpt-4-turbo-preview)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Server default</SelectItem>
                        <SelectItem value="gpt-4o">GPT4o</SelectItem>
                        <SelectItem value="gpt-4.1">GPT4.1</SelectItem>
                        <SelectItem value="gpt-4.1-mini">GPT4.1 mini</SelectItem>
                        <SelectItem value="gpt-5-mini">GPT5 mini</SelectItem>
                        <SelectItem value="gpt-5.2">GPT5.2</SelectItem>
                        <SelectItem value="GPT-OSS-120B">GPT-OSS 120B</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Background Noise */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-primary">
                      <VolumeX className="w-4 h-4" />
                      Background Noise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bg-noise"
                        checked={settings.backgroundNoiseEnabled}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, backgroundNoiseEnabled: checked === true })
                        }
                      />
                      <label
                        htmlFor="bg-noise"
                        className="text-sm font-medium cursor-pointer select-none"
                      >
                        Enable background noise
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add ambient background noise to make conversations more natural
                    </p>

                    {settings.backgroundNoiseEnabled && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>Noise Type</Label>
                          <Select
                            value={settings.backgroundNoiseType}
                            onValueChange={(value) =>
                              setSettings({ ...settings, backgroundNoiseType: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="cafe">Cafe</SelectItem>
                              <SelectItem value="restaurant">Restaurant</SelectItem>
                              <SelectItem value="street">Street</SelectItem>
                              <SelectItem value="nature">Nature</SelectItem>
                              <SelectItem value="rain">Rain</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose the type of background ambience
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Apply To</Label>
                          <Select
                            value={settings.backgroundNoiseApplyTo}
                            onValueChange={(value) =>
                              setSettings({ ...settings, backgroundNoiseApplyTo: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whole_call">Whole Call</SelectItem>
                              <SelectItem value="agent_only">Agent Only</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose when to apply the background noise
                          </p>
                        </div>

                        <div className="space-y-3">
                          <Label>Volume</Label>
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[settings.backgroundNoiseVolume]}
                              onValueChange={([value]) =>
                                setSettings({ ...settings, backgroundNoiseVolume: value })
                              }
                              min={0}
                              max={1}
                              step={0.01}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              value={settings.backgroundNoiseVolume}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v >= 0 && v <= 1) {
                                  setSettings({ ...settings, backgroundNoiseVolume: v });
                                }
                              }}
                              className="w-20 text-center"
                              min={0}
                              max={1}
                              step={0.01}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Set the volume level (0.0 = silent, 1.0 = full volume)
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* On Idle */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-primary">On Idle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        Message <span className="text-destructive">*</span>
                        <InfoTooltip text="The message the agent will say when the user is idle (not speaking). This helps re-engage the conversation." />
                      </Label>
                      <Textarea
                        value={settings.onIdleMessage}
                        onChange={(e) =>
                          setSettings({ ...settings, onIdleMessage: e.target.value })
                        }
                        placeholder="e.g., Are you still there?"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          Timeout <span className="text-destructive">*</span>
                          <InfoTooltip text="Number of seconds of silence before the idle message is sent." />
                        </Label>
                        <Input
                          type="number"
                          value={settings.onIdleTimeout}
                          onChange={(e) =>
                            setSettings({ ...settings, onIdleTimeout: e.target.value })
                          }
                          min={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          Threshold <span className="text-destructive">*</span>
                          <InfoTooltip text="Maximum number of times the idle message can be sent before the call is terminated." />
                        </Label>
                        <Input
                          type="number"
                          value={settings.onIdleThreshold}
                          onChange={(e) =>
                            setSettings({ ...settings, onIdleThreshold: e.target.value })
                          }
                          min={1}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        Termination Message
                        <InfoTooltip text="The final message the agent will say before hanging up when the idle threshold is reached." />
                      </Label>
                      <Textarea
                        value={settings.onIdleTerminationMessage}
                        onChange={(e) =>
                          setSettings({ ...settings, onIdleTerminationMessage: e.target.value })
                        }
                        placeholder="e.g., Sorry, I'm not sure I can help with that. Goodbye!"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </TabsContent>

          {/* ===== VOICE & AUDIO TAB ===== */}
          <TabsContent value="voice" className="mt-6 space-y-6">
            <div>
              {/* Language */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5 text-primary" />
                    Language
                  </CardTitle>
                  <CardDescription>
                    Set the primary language for this agent
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Agent Language</Label>
                    <Select
                      value={settings.language}
                      onValueChange={(value) => setSettings({ ...settings, language: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="de-DE">German</SelectItem>
                        <SelectItem value="es-ES">Spanish</SelectItem>
                        <SelectItem value="fr-FR">French</SelectItem>
                        <SelectItem value="it-IT">Italian</SelectItem>
                        <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                        <SelectItem value="ja-JP">Japanese</SelectItem>
                        <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                        <SelectItem value="ko-KR">Korean</SelectItem>
                        <SelectItem value="ru-RU">Russian</SelectItem>
                        <SelectItem value="tr-TR">Turkish</SelectItem>
                        <SelectItem value="ar-SA">Arabic</SelectItem>
                        <SelectItem value="nl-NL">Dutch</SelectItem>
                        <SelectItem value="pl-PL">Polish</SelectItem>
                        <SelectItem value="sv-SE">Swedish</SelectItem>
                        <SelectItem value="hi-IN">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Voice & Audio */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Volume2 className="w-5 h-5 text-primary" />
                    Voice & Audio
                  </CardTitle>
                  <CardDescription>
                    Choose the TTS provider and voice for this agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>TTS Provider</Label>
                    <Select
                      value={settings.ttsProvider}
                      onValueChange={(value) => {
                        setSettings({ ...settings, ttsProvider: value });
                        if (value !== "comhubai") {
                          setSelectedVoiceModel(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comhubai">ComhubAI Voices</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.ttsProvider === "comhubai" && (
                    <div className="space-y-4">
                      {selectedVoiceModel && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          {selectedVoiceModel.image_url ? (
                            <img
                              src={selectedVoiceModel.image_url}
                              alt={selectedVoiceModel.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Music className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-sm">{selectedVoiceModel.name}</span>
                            </div>
                            {selectedVoiceModel.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {selectedVoiceModel.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              setSelectedVoiceModel(null);
                              setSettings({ ...settings, comhubaiVoiceModelId: "" });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={openVoiceLibrary}
                      >
                        <Music className="w-4 h-4" />
                        {selectedVoiceModel ? "Change Voice" : "ComhubAI Voice Library"}
                      </Button>
                    </div>
                  )}

                  {settings.ttsProvider === "openai" && (
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <Select
                        value={settings.openaiVoice}
                        onValueChange={(value) => setSettings({ ...settings, openaiVoice: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                          <SelectItem value="echo">Echo (Male)</SelectItem>
                          <SelectItem value="fable">Fable (British)</SelectItem>
                          <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                          <SelectItem value="nova">Nova (Female)</SelectItem>
                          <SelectItem value="shimmer">Shimmer (Soft Female)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {settings.ttsProvider === "elevenlabs" && (
                    <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5" />
                          ElevenLabs API Key
                        </Label>
                        <div className="relative">
                          <Input
                            type={showApiKey ? "text" : "password"}
                            placeholder="Enter your ElevenLabs API key"
                            value={settings.elevenlabsApiKey}
                            onChange={(e) => setSettings({ ...settings, elevenlabsApiKey: e.target.value })}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get your API key from{" "}
                          <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            elevenlabs.io
                          </a>
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Voice ID</Label>
                        <Input
                          placeholder="Enter ElevenLabs voice ID"
                          value={settings.elevenlabsVoiceId}
                          onChange={(e) => setSettings({ ...settings, elevenlabsVoiceId: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Find voice IDs in your ElevenLabs dashboard under Voice Lab
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== CALL SETTINGS TAB ===== */}
          <TabsContent value="call" className="mt-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Timing */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-primary">
                    <Timer className="w-4 h-4" />
                    Timing
                  </CardTitle>
                  <CardDescription>
                    Control call duration and speech detection timing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Max Call Duration (seconds)
                      <InfoTooltip text="Maximum duration for a single call. The call will automatically end after this time. Default: 600s (10 minutes)." />
                    </Label>
                    <Input
                      type="number"
                      value={settings.maxCallDuration}
                      onChange={(e) => setSettings({ ...settings, maxCallDuration: e.target.value })}
                      min={30}
                      max={3600}
                    />
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const sec = parseInt(settings.maxCallDuration) || 600;
                        const min = Math.floor(sec / 60);
                        const rem = sec % 60;
                        return min > 0
                          ? `${min} minute${min !== 1 ? "s" : ""}${rem > 0 ? ` ${rem}s` : ""}`
                          : `${sec} seconds`;
                      })()}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Speech Timeout
                      <InfoTooltip text="How long to wait after the user stops speaking before processing their input. 'Auto' lets Twilio detect natural pauses. A custom value (in seconds) gives you precise control." />
                    </Label>
                    <Select
                      value={settings.speechTimeout === "auto" ? "auto" : "custom"}
                      onValueChange={(value) => {
                        if (value === "auto") {
                          setSettings({ ...settings, speechTimeout: "auto" });
                        } else {
                          setSettings({ ...settings, speechTimeout: settings.silenceTimeout || "2" });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (recommended)</SelectItem>
                        <SelectItem value="custom">Custom (seconds)</SelectItem>
                      </SelectContent>
                    </Select>
                    {settings.speechTimeout !== "auto" && (
                      <div className="pt-1">
                        <Input
                          type="number"
                          value={settings.speechTimeout}
                          onChange={(e) => setSettings({ ...settings, speechTimeout: e.target.value })}
                          min={1}
                          max={15}
                          placeholder="Seconds of silence before processing"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Wait {settings.speechTimeout || "2"}s of silence before processing speech
                        </p>
                      </div>
                    )}
                    {settings.speechTimeout === "auto" && (
                      <p className="text-xs text-muted-foreground">
                        Twilio automatically detects natural pauses in conversation
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Silence Timeout
                      <InfoTooltip text="How long to wait in silence before the agent sends an idle/follow-up message. 'Auto' uses a smart 2-second default that works well for natural conversation. Also used as the speech timeout fallback when Speech Timeout is set to Custom." />
                    </Label>
                    <Select
                      value={settings.silenceTimeout === "auto" ? "auto" : "custom"}
                      onValueChange={(value) => {
                        if (value === "auto") {
                          setSettings({ ...settings, silenceTimeout: "auto" });
                        } else {
                          setSettings({ ...settings, silenceTimeout: "2" });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (2s — recommended)</SelectItem>
                        <SelectItem value="custom">Custom (seconds)</SelectItem>
                      </SelectContent>
                    </Select>
                    {settings.silenceTimeout !== "auto" && (
                      <div className="pt-1">
                        <Input
                          type="number"
                          value={settings.silenceTimeout}
                          onChange={(e) => setSettings({ ...settings, silenceTimeout: e.target.value })}
                          min={1}
                          max={30}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Wait {settings.silenceTimeout || "2"}s of silence before idle message
                        </p>
                      </div>
                    )}
                    {settings.silenceTimeout === "auto" && (
                      <p className="text-xs text-muted-foreground">
                        Waits 2 seconds of silence — balances responsiveness with natural pauses
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Interruption */}
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-primary">
                    <Volume2 className="w-4 h-4" />
                    Interruption (Barge-in)
                  </CardTitle>
                  <CardDescription>
                    Control whether users can interrupt the agent while it's speaking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Sensitivity
                      <InfoTooltip text="Low: Agent finishes speaking before listening — more structured conversation. High: User can interrupt at any time (barge-in) — more natural, real-time feel." />
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({ ...settings, interruptionSensitivity: "low" })
                        }
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          settings.interruptionSensitivity === "low"
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border"
                        }`}
                      >
                        Low
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({ ...settings, interruptionSensitivity: "high" })
                        }
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          settings.interruptionSensitivity === "high"
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border"
                        }`}
                      >
                        High
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {settings.interruptionSensitivity === "high"
                        ? "User can speak over the agent — audio stops immediately and speech is captured"
                        : "Agent completes speaking before listening — prevents accidental interruptions"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      Word Count Threshold
                      <InfoTooltip text="Minimum number of words the user must speak before it's treated as an intentional interruption. Helps filter out accidental sounds like 'uh' or 'um'." />
                    </Label>
                    <Input
                      type="number"
                      value={settings.interruptionWordCountThreshold}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          interruptionWordCountThreshold: e.target.value,
                        })
                      }
                      min={1}
                      max={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ignore speech shorter than {settings.interruptionWordCountThreshold || "1"} word{parseInt(settings.interruptionWordCountThreshold) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ComhubAI Voice Library Modal */}
      <Dialog open={voiceLibraryOpen} onOpenChange={(open) => {
        if (!open) stopAudio();
        setVoiceLibraryOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              ComhubAI Voice Library
            </DialogTitle>
          </DialogHeader>

          {voiceModelsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : voiceModels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No voice models available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              {voiceModels.map((model: any) => {
                const isSelected = selectedVoiceModel?.id === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => selectVoiceModel(model)}
                    onMouseEnter={(e) => {
                      if (model.description) {
                        setHoverTooltip({ text: model.description, x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (model.description && hoverTooltip) {
                        setHoverTooltip({ text: model.description, x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseLeave={() => setHoverTooltip(null)}
                    className={`relative group text-left rounded-xl border-2 p-3 transition-all hover:shadow-md ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col items-center text-center gap-2">
                      {model.image_url ? (
                        <img
                          src={model.image_url}
                          alt={model.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                          <Music className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium text-sm">{model.name}</span>
                      {model.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {model.description}
                        </p>
                      )}
                      {model.preview_audio_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayPreview(model);
                          }}
                        >
                          {playingModelId === model.id ? (
                            <>
                              <Pause className="w-3 h-3" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              Preview
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mouse-tracking tooltip for voice card descriptions */}
      {hoverTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none px-3 py-2 rounded-md bg-popover text-popover-foreground border shadow-md max-w-[250px]"
          style={{ left: hoverTooltip.x + 12, top: hoverTooltip.y + 12 }}
        >
          <p className="text-xs">{hoverTooltip.text}</p>
        </div>
      )}
    </div>
  );
};

export default AgentConfigureSection;
