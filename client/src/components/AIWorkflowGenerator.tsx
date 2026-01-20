import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Building2, Phone, Target, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Node, Edge } from "@/components/FlowCanvas";

interface AIWorkflowGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (nodes: Node[], edges: Edge[]) => void;
  agentId: string;
}

const AIWorkflowGenerator = ({
  isOpen,
  onClose,
  onGenerate,
  agentId,
}: AIWorkflowGeneratorProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    industry: "",
    description: "",
    targetAudience: "",
    mainServices: "",
  });

  const [callFlowConfig, setCallFlowConfig] = useState({
    generateInbound: true,
    generateOutbound: true,
    inboundPurpose: "",
    outboundPurpose: "",
    collectInfo: [] as string[],
    transferToHuman: true,
    businessHours: "",
  });

  const infoToCollect = [
    { id: "name", label: "Customer Name" },
    { id: "email", label: "Email Address" },
    { id: "phone", label: "Phone Number" },
    { id: "company", label: "Company Name" },
    { id: "reason", label: "Reason for Call" },
    { id: "appointment", label: "Appointment Scheduling" },
  ];

  const handleNext = () => {
    if (step === 1) {
      if (!businessInfo.businessName || !businessInfo.description) {
        toast({
          title: "Missing Information",
          description: "Please fill in your business name and description",
          variant: "destructive",
        });
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      const token = localStorage.getItem("backend_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"}/agents/${agentId}/generate-workflow`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            businessInfo,
            callFlowConfig,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate workflow");
      }

      const data = await response.json();

      if (data.success && data.workflow) {
        onGenerate(data.workflow.nodes, data.workflow.edges);
        toast({
          title: "Workflow Generated",
          description: "Your AI-powered call workflow has been created successfully!",
        });
        handleClose();
      } else {
        throw new Error(data.error || "Failed to generate workflow");
      }
    } catch (error) {
      console.error("Error generating workflow:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setBusinessInfo({
      businessName: "",
      industry: "",
      description: "",
      targetAudience: "",
      mainServices: "",
    });
    setCallFlowConfig({
      generateInbound: true,
      generateOutbound: true,
      inboundPurpose: "",
      outboundPurpose: "",
      collectInfo: [],
      transferToHuman: true,
      businessHours: "",
    });
    onClose();
  };

  const toggleCollectInfo = (id: string) => {
    setCallFlowConfig((prev) => ({
      ...prev,
      collectInfo: prev.collectInfo.includes(id)
        ? prev.collectInfo.filter((i) => i !== id)
        : [...prev.collectInfo, id],
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Complete Workflow with AI
          </DialogTitle>
          <DialogDescription>
            Tell us about your business and we'll create a complete phone call workflow for you.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 ${
                    step > s ? "bg-purple-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Business Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-purple-700">
              <Building2 className="w-5 h-5" />
              Tell us about your business
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={businessInfo.businessName}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, businessName: e.target.value })
                  }
                  placeholder="e.g., Acme Corporation"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={businessInfo.industry}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, industry: e.target.value })
                  }
                  placeholder="e.g., Healthcare, Real Estate, E-commerce"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Business Description *</Label>
                <Textarea
                  id="description"
                  value={businessInfo.description}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, description: e.target.value })
                  }
                  placeholder="Describe what your business does, your main products/services, and what makes you unique..."
                  rows={4}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input
                  id="targetAudience"
                  value={businessInfo.targetAudience}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, targetAudience: e.target.value })
                  }
                  placeholder="e.g., Small business owners, Healthcare professionals"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mainServices">Main Services/Products</Label>
                <Textarea
                  id="mainServices"
                  value={businessInfo.mainServices}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, mainServices: e.target.value })
                  }
                  placeholder="List your main services or products that callers might ask about..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Call Flow Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-purple-700">
              <Phone className="w-5 h-5" />
              Configure Your Call Flows
            </div>

            <div className="grid gap-4">
              {/* Inbound/Outbound Selection */}
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateInbound"
                    checked={callFlowConfig.generateInbound}
                    onCheckedChange={(checked) =>
                      setCallFlowConfig({ ...callFlowConfig, generateInbound: !!checked })
                    }
                  />
                  <Label htmlFor="generateInbound" className="cursor-pointer">
                    Generate Inbound Flow
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateOutbound"
                    checked={callFlowConfig.generateOutbound}
                    onCheckedChange={(checked) =>
                      setCallFlowConfig({ ...callFlowConfig, generateOutbound: !!checked })
                    }
                  />
                  <Label htmlFor="generateOutbound" className="cursor-pointer">
                    Generate Outbound Flow
                  </Label>
                </div>
              </div>

              {callFlowConfig.generateInbound && (
                <div className="grid gap-2 p-4 bg-blue-50 rounded-lg">
                  <Label htmlFor="inboundPurpose" className="text-blue-800">
                    Inbound Call Purpose
                  </Label>
                  <Textarea
                    id="inboundPurpose"
                    value={callFlowConfig.inboundPurpose}
                    onChange={(e) =>
                      setCallFlowConfig({ ...callFlowConfig, inboundPurpose: e.target.value })
                    }
                    placeholder="What should happen when customers call you? e.g., Answer questions, schedule appointments, provide support..."
                    rows={3}
                  />
                </div>
              )}

              {callFlowConfig.generateOutbound && (
                <div className="grid gap-2 p-4 bg-purple-50 rounded-lg">
                  <Label htmlFor="outboundPurpose" className="text-purple-800">
                    Outbound Call Purpose
                  </Label>
                  <Textarea
                    id="outboundPurpose"
                    value={callFlowConfig.outboundPurpose}
                    onChange={(e) =>
                      setCallFlowConfig({ ...callFlowConfig, outboundPurpose: e.target.value })
                    }
                    placeholder="What's the purpose of outbound calls? e.g., Sales follow-up, appointment reminders, surveys..."
                    rows={3}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Information to Collect</Label>
                <div className="grid grid-cols-2 gap-2">
                  {infoToCollect.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={item.id}
                        checked={callFlowConfig.collectInfo.includes(item.id)}
                        onCheckedChange={() => toggleCollectInfo(item.id)}
                      />
                      <Label htmlFor={item.id} className="cursor-pointer text-sm">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transferToHuman"
                  checked={callFlowConfig.transferToHuman}
                  onCheckedChange={(checked) =>
                    setCallFlowConfig({ ...callFlowConfig, transferToHuman: !!checked })
                  }
                />
                <Label htmlFor="transferToHuman" className="cursor-pointer">
                  Include option to transfer to human agent
                </Label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="businessHours">Business Hours (Optional)</Label>
                <Input
                  id="businessHours"
                  value={callFlowConfig.businessHours}
                  onChange={(e) =>
                    setCallFlowConfig({ ...callFlowConfig, businessHours: e.target.value })
                  }
                  placeholder="e.g., Mon-Fri 9am-5pm EST"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-purple-700">
              <Target className="w-5 h-5" />
              Review & Generate
            </div>

            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Business:</span>{" "}
                  <span className="text-gray-900">{businessInfo.businessName}</span>
                </div>
                {businessInfo.industry && (
                  <div>
                    <span className="font-medium text-gray-700">Industry:</span>{" "}
                    <span className="text-gray-900">{businessInfo.industry}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">Description:</span>{" "}
                  <span className="text-gray-900 text-sm">{businessInfo.description}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="font-medium text-gray-700">Workflows to Generate:</div>
                <div className="flex gap-2">
                  {callFlowConfig.generateInbound && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      Inbound
                    </span>
                  )}
                  {callFlowConfig.generateOutbound && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                      Outbound
                    </span>
                  )}
                </div>
                {callFlowConfig.collectInfo.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Collecting:</span>{" "}
                    <span className="text-gray-900 text-sm">
                      {callFlowConfig.collectInfo
                        .map((id) => infoToCollect.find((i) => i.id === id)?.label)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {callFlowConfig.transferToHuman && (
                  <div className="text-sm text-green-700">
                    ✓ Human transfer option included
                  </div>
                )}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-purple-900">
                      AI will generate a complete workflow including:
                    </div>
                    <ul className="text-sm text-purple-700 mt-2 space-y-1">
                      <li>• Professional greeting and introduction</li>
                      <li>• Information collection nodes</li>
                      <li>• Conversation handling with context</li>
                      <li>• Decision points and routing logic</li>
                      <li>• Fallback handling for errors</li>
                      <li>• Professional call closing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isGenerating}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} className="bg-purple-600 hover:bg-purple-700">
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Workflow
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIWorkflowGenerator;
