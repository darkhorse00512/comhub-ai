import { useState, useEffect } from "react";
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
  PhoneOutgoing,
  Save,
  Loader2,
  RefreshCw,
  Phone,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  config: any;
}

interface AgentOutboundSectionProps {
  agent: Agent;
  onAgentUpdate: (agent: Agent) => void;
}

const AgentOutboundSection = ({ agent, onAgentUpdate }: AgentOutboundSectionProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);

  const existingSettings = agent.config?.settings || {};

  const [outbound, setOutbound] = useState({
    outboundPhoneNumberId: existingSettings.outboundPhoneNumberId || "",
    callerId: existingSettings.callerId || "",
    maxConcurrentCalls: existingSettings.maxConcurrentCalls?.toString() || "1",
    retryAttempts: existingSettings.retryAttempts?.toString() || "0",
    retryDelayMinutes: existingSettings.retryDelayMinutes?.toString() || "5",
  });

  useEffect(() => {
    const loadPhoneNumbers = async () => {
      setLoadingNumbers(true);
      const result = await api.getPhoneNumbers();
      if (result.data) {
        setPhoneNumbers(result.data);
      }
      setLoadingNumbers(false);
    };
    loadPhoneNumbers();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const updatedConfig = {
      ...agent.config,
      settings: {
        ...agent.config?.settings,
        outboundPhoneNumberId: outbound.outboundPhoneNumberId,
        callerId: outbound.callerId,
        maxConcurrentCalls: parseInt(outbound.maxConcurrentCalls) || 1,
        retryAttempts: parseInt(outbound.retryAttempts) || 0,
        retryDelayMinutes: parseInt(outbound.retryDelayMinutes) || 5,
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
        description: "Outbound configuration updated successfully.",
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
          <h2 className="text-2xl font-bold text-foreground">Outbound</h2>
          <p className="text-muted-foreground mt-1">
            Configure outbound calling settings for this agent
          </p>
        </div>

        {/* Phone Number */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="w-5 h-5 text-primary" />
              Phone Number
            </CardTitle>
            <CardDescription>
              Select the phone number this agent will use for outbound calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Outbound Phone Number</Label>
              {loadingNumbers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading phone numbers...
                </div>
              ) : phoneNumbers.length > 0 ? (
                <Select
                  value={outbound.outboundPhoneNumberId}
                  onValueChange={(value) => setOutbound({ ...outbound, outboundPhoneNumberId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.id}>
                        {phone.phoneNumber || phone.phone_number} {phone.label ? `(${phone.label})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">No phone numbers available</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Add a phone number in the Telephony section first.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Caller ID Override (optional)</Label>
              <Input
                placeholder="e.g. +1234567890"
                value={outbound.callerId}
                onChange={(e) => setOutbound({ ...outbound, callerId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Override the default caller ID shown to the recipient
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Call Rules */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-primary" />
              Call Rules
            </CardTitle>
            <CardDescription>
              Set limits and retry behavior for outbound calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Input
                  type="number"
                  value={outbound.maxConcurrentCalls}
                  onChange={(e) => setOutbound({ ...outbound, maxConcurrentCalls: e.target.value })}
                  min={1}
                  max={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Retry Attempts</Label>
                <Input
                  type="number"
                  value={outbound.retryAttempts}
                  onChange={(e) => setOutbound({ ...outbound, retryAttempts: e.target.value })}
                  min={0}
                  max={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Retry Delay (min)</Label>
                <Input
                  type="number"
                  value={outbound.retryDelayMinutes}
                  onChange={(e) => setOutbound({ ...outbound, retryDelayMinutes: e.target.value })}
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
            {saving ? "Saving..." : "Save Outbound Settings"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentOutboundSection;
