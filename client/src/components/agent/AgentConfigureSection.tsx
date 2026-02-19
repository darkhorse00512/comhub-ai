import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Globe,
  Volume2,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Timer,
  Key,
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

const AgentConfigureSection = ({ agent, onAgentUpdate }: AgentConfigureSectionProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const existingSettings = agent.config?.settings || {};

  const [settings, setSettings] = useState({
    language: existingSettings.language || "en-US",
    ttsProvider: existingSettings.ttsProvider || "openai",
    openaiVoice: existingSettings.openaiVoice || "alloy",
    elevenlabsApiKey: existingSettings.elevenlabsApiKey || "",
    elevenlabsVoiceId: existingSettings.elevenlabsVoiceId || "",
    maxCallDuration: existingSettings.maxCallDuration?.toString() || "30",
    silenceTimeout: existingSettings.silenceTimeout?.toString() || "2",
  });

  const [showApiKey, setShowApiKey] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updatedConfig = {
      ...agent.config,
      settings: {
        ...settings,
        maxCallDuration: parseInt(settings.maxCallDuration) || 30,
        silenceTimeout: parseInt(settings.silenceTimeout) || 2,
      },
    };

    const result = await api.updateAgent(agent.id, { config: updatedConfig });
    setSaving(false);

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      onAgentUpdate({ ...agent, config: updatedConfig });
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
        className="max-w-2xl mx-auto space-y-6"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configure</h2>
          <p className="text-muted-foreground mt-1">
            Set language, voice, and call settings for this agent
          </p>
        </div>

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
            {/* TTS Provider */}
            <div className="space-y-2">
              <Label>TTS Provider</Label>
              <Select
                value={settings.ttsProvider}
                onValueChange={(value) => setSettings({ ...settings, ttsProvider: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* OpenAI Voice */}
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

            {/* ElevenLabs Settings */}
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

        {/* Call Settings */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Timer className="w-5 h-5 text-primary" />
              Call Settings
            </CardTitle>
            <CardDescription>
              Configure timing and behavior during calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Call Duration (seconds)</Label>
                <Input
                  type="number"
                  value={settings.maxCallDuration}
                  onChange={(e) => setSettings({ ...settings, maxCallDuration: e.target.value })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Silence Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={settings.silenceTimeout}
                  onChange={(e) => setSettings({ ...settings, silenceTimeout: e.target.value })}
                  min={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentConfigureSection;
