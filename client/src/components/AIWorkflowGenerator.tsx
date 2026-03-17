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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Building2,
  Phone,
  Target,
  Plus,
  X,
  PhoneIncoming,
  PhoneOutgoing,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  Database,
  Languages,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Node, Edge } from "@/components/FlowCanvas";

interface WorkflowField {
  name: string;
  type: "text" | "number" | "boolean";
}

interface AIWorkflowGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (nodes: Node[], edges: Edge[], fields?: WorkflowField[]) => void;
  agentId: string;
  existingNodes?: Node[];
  existingEdges?: Edge[];
  existingFields?: WorkflowField[];
  currentLanguage?: string;
  onLanguageChange?: (language: string) => void;
}

const PRESET_FIELDS = [
  { id: "name", label: "Customer Name", icon: "user" },
  { id: "email", label: "Email Address", icon: "mail" },
  { id: "phone", label: "Phone Number", icon: "phone" },
  { id: "company", label: "Company Name", icon: "building" },
  { id: "reason", label: "Reason for Call", icon: "message" },
  { id: "appointment", label: "Appointment Scheduling", icon: "calendar" },
];

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ko-KR", label: "Korean" },
  { value: "ru-RU", label: "Russian" },
  { value: "tr-TR", label: "Turkish" },
  { value: "ar-SA", label: "Arabic" },
  { value: "nl-NL", label: "Dutch" },
  { value: "pl-PL", label: "Polish" },
  { value: "sv-SE", label: "Swedish" },
  { value: "hi-IN", label: "Hindi" },
];

const AIWorkflowGenerator = ({
  isOpen,
  onClose,
  onGenerate,
  agentId,
  existingNodes,
  existingEdges,
  existingFields,
  currentLanguage,
  onLanguageChange,
}: AIWorkflowGeneratorProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Language change state
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || "en-US");
  const [isTranslating, setIsTranslating] = useState(false);

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
    generateOutbound: false,
    inboundPurpose: "",
    outboundPurpose: "",
    collectInfo: [] as string[],
    customFields: [] as string[],
    transferToHuman: true,
    businessHours: "",
  });

  const [newCustomField, setNewCustomField] = useState("");

  const handleNext = () => {
    if (step === 1) {
      if (!businessInfo.businessName.trim()) {
        toast({
          title: "Business name required",
          description: "Please enter your business name to continue.",
          variant: "destructive",
        });
        return;
      }
      if (!businessInfo.description.trim()) {
        toast({
          title: "Description required",
          description: "Please describe your business so AI can create a relevant workflow.",
          variant: "destructive",
        });
        return;
      }
    }
    if (step === 2) {
      if (!callFlowConfig.generateInbound && !callFlowConfig.generateOutbound) {
        toast({
          title: "Select at least one flow",
          description: "Please select at least one call flow type (Inbound or Outbound).",
          variant: "destructive",
        });
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
    setGenerateError(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      const token = localStorage.getItem("backend_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Combine preset field IDs and custom field labels into collectInfo
      const allCollectInfo = [
        ...callFlowConfig.collectInfo,
        ...callFlowConfig.customFields,
      ];

      // Include existing workflow so AI can improve/complete it instead of starting from scratch
      const hasExistingWorkflow = existingNodes && existingNodes.length > 0;
      const existingWorkflow = hasExistingWorkflow
        ? {
            nodes: existingNodes,
            edges: existingEdges || [],
            fields: existingFields || [],
          }
        : undefined;

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"}/agents/${agentId}/generate-workflow`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            businessInfo,
            callFlowConfig: {
              ...callFlowConfig,
              collectInfo: allCollectInfo,
            },
            existingWorkflow,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to generate workflow");
      }

      if (data.success && data.workflow) {
        onGenerate(data.workflow.nodes, data.workflow.edges, data.workflow.fields);
        toast({
          title: hasExistingWorkflow ? "Workflow Improved" : "Workflow Generated",
          description: `${hasExistingWorkflow ? 'Improved' : 'Created'} workflow with ${data.workflow.nodes.length} nodes and ${data.workflow.edges.length} connections.`,
        });
        handleClose();
      } else {
        throw new Error(data.error || "Failed to generate workflow");
      }
    } catch (error) {
      console.error("Error generating workflow:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      setGenerateError(errorMsg);
      toast({
        title: "Generation Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslateWorkflow = async () => {
    if (!existingNodes || existingNodes.length === 0) {
      toast({
        title: "No workflow to translate",
        description: "Please create a workflow first before changing the language.",
        variant: "destructive",
      });
      return;
    }

    if (selectedLanguage === currentLanguage) {
      toast({
        title: "Same language selected",
        description: "Please select a different language.",
        variant: "destructive",
      });
      return;
    }

    setIsTranslating(true);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      const token = localStorage.getItem("backend_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"}/agents/${agentId}/translate-workflow`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            targetLanguage: selectedLanguage,
            nodes: existingNodes,
            edges: existingEdges || [],
            fields: existingFields || [],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to translate workflow");
      }

      if (data.success && data.workflow) {
        // Update the workflow nodes/edges/fields
        onGenerate(data.workflow.nodes, data.workflow.edges, data.workflow.fields);

        // Update the agent language setting
        if (onLanguageChange) {
          onLanguageChange(data.targetLanguage);
        }

        const targetLabel = LANGUAGE_OPTIONS.find(l => l.value === selectedLanguage)?.label || selectedLanguage;
        toast({
          title: "Workflow Translated",
          description: `Workflow and agent language changed to ${targetLabel}.`,
        });

        setShowLanguageSelector(false);
        handleClose();
      } else {
        throw new Error(data.error || "Translation failed");
      }
    } catch (error) {
      console.error("Error translating workflow:", error);
      toast({
        title: "Translation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setGenerateError(null);
    setNewCustomField("");
    setShowLanguageSelector(false);
    setSelectedLanguage(currentLanguage || "en-US");
    setBusinessInfo({
      businessName: "",
      industry: "",
      description: "",
      targetAudience: "",
      mainServices: "",
    });
    setCallFlowConfig({
      generateInbound: true,
      generateOutbound: false,
      inboundPurpose: "",
      outboundPurpose: "",
      collectInfo: [],
      customFields: [],
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

  const addCustomField = () => {
    const trimmed = newCustomField.trim();
    if (!trimmed) return;
    if (callFlowConfig.customFields.includes(trimmed)) {
      toast({
        title: "Field already exists",
        description: `"${trimmed}" is already in your list.`,
        variant: "destructive",
      });
      return;
    }
    setCallFlowConfig((prev) => ({
      ...prev,
      customFields: [...prev.customFields, trimmed],
    }));
    setNewCustomField("");
  };

  const removeCustomField = (field: string) => {
    setCallFlowConfig((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((f) => f !== field),
    }));
  };

  // Resolve display labels for summary
  const getFieldLabel = (id: string): string => {
    const preset = PRESET_FIELDS.find((f) => f.id === id);
    return preset ? preset.label : id;
  };

  const allSelectedFields = [
    ...callFlowConfig.collectInfo.map(getFieldLabel),
    ...callFlowConfig.customFields,
  ];

  const stepLabels = ["Business Info", "Call Flow", "Review"];

  const currentLangLabel = LANGUAGE_OPTIONS.find(l => l.value === (currentLanguage || "en-US"))?.label || "English (US)";
  const hasExistingWorkflow = existingNodes && existingNodes.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Workflow Generator
          </DialogTitle>
          <DialogDescription>
            {hasExistingWorkflow
              ? "AI will improve and complete your existing workflow based on your preferences."
              : "Describe your business and preferences — AI will create a production-ready call workflow."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1 py-3">
          {stepLabels.map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      step > s
                        ? "bg-green-500 text-white"
                        : step === s
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  <span className={`text-[10px] font-medium ${step >= s ? "text-purple-700" : "text-gray-400"}`}>
                    {label}
                  </span>
                </div>
                {s < 3 && (
                  <div
                    className={`w-16 h-0.5 mx-1 mb-4 rounded transition-colors ${
                      step > s ? "bg-green-400" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Business Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <Building2 className="w-5 h-5 text-purple-600" />
              Business Information
            </div>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="businessName" className="text-sm">
                    Business Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    value={businessInfo.businessName}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, businessName: e.target.value })
                    }
                    placeholder="Acme Corporation"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="industry" className="text-sm">Industry</Label>
                  <Input
                    id="industry"
                    value={businessInfo.industry}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, industry: e.target.value })
                    }
                    placeholder="Healthcare, Real Estate, etc."
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="description" className="text-sm">
                  Business Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={businessInfo.description}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, description: e.target.value })
                  }
                  placeholder="What does your business do? Describe your products, services, and what makes you unique..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="targetAudience" className="text-sm">Target Audience</Label>
                  <Input
                    id="targetAudience"
                    value={businessInfo.targetAudience}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, targetAudience: e.target.value })
                    }
                    placeholder="Small business owners, etc."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mainServices" className="text-sm">Key Services/Products</Label>
                  <Input
                    id="mainServices"
                    value={businessInfo.mainServices}
                    onChange={(e) =>
                      setBusinessInfo({ ...businessInfo, mainServices: e.target.value })
                    }
                    placeholder="Consulting, SaaS, etc."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Call Flow Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <Phone className="w-5 h-5 text-purple-600" />
              Call Flow Configuration
            </div>

            <div className="grid gap-4">
              {/* Inbound/Outbound Toggle Cards */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCallFlowConfig({ ...callFlowConfig, generateInbound: !callFlowConfig.generateInbound })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    callFlowConfig.generateInbound
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneIncoming className={`w-4 h-4 ${callFlowConfig.generateInbound ? "text-blue-600" : "text-gray-400"}`} />
                    <span className={`text-sm font-semibold ${callFlowConfig.generateInbound ? "text-blue-800" : "text-gray-500"}`}>
                      Inbound Calls
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Handle incoming customer calls
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCallFlowConfig({ ...callFlowConfig, generateOutbound: !callFlowConfig.generateOutbound })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    callFlowConfig.generateOutbound
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneOutgoing className={`w-4 h-4 ${callFlowConfig.generateOutbound ? "text-purple-600" : "text-gray-400"}`} />
                    <span className={`text-sm font-semibold ${callFlowConfig.generateOutbound ? "text-purple-800" : "text-gray-500"}`}>
                      Outbound Calls
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Proactive outreach & follow-ups
                  </p>
                </button>
              </div>

              {/* Inbound Purpose */}
              {callFlowConfig.generateInbound && (
                <div className="grid gap-1.5 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <Label htmlFor="inboundPurpose" className="text-sm text-blue-800 font-medium">
                    Inbound Call Purpose
                  </Label>
                  <Textarea
                    id="inboundPurpose"
                    value={callFlowConfig.inboundPurpose}
                    onChange={(e) =>
                      setCallFlowConfig({ ...callFlowConfig, inboundPurpose: e.target.value })
                    }
                    placeholder="e.g., Answer product questions, schedule appointments, provide technical support, handle billing inquiries..."
                    rows={2}
                    className="bg-white"
                  />
                </div>
              )}

              {/* Outbound Purpose */}
              {callFlowConfig.generateOutbound && (
                <div className="grid gap-1.5 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                  <Label htmlFor="outboundPurpose" className="text-sm text-purple-800 font-medium">
                    Outbound Call Purpose
                  </Label>
                  <Textarea
                    id="outboundPurpose"
                    value={callFlowConfig.outboundPurpose}
                    onChange={(e) =>
                      setCallFlowConfig({ ...callFlowConfig, outboundPurpose: e.target.value })
                    }
                    placeholder="e.g., Sales follow-up, appointment reminders, customer satisfaction surveys, renewal notifications..."
                    rows={2}
                    className="bg-white"
                  />
                </div>
              )}

              {/* Information to Collect */}
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-500" />
                  <Label className="text-sm font-medium">Information to Collect</Label>
                </div>
                <p className="text-xs text-gray-500 -mt-1">
                  Select common fields or add your own custom fields below.
                </p>

                {/* Preset field checkboxes */}
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_FIELDS.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        callFlowConfig.collectInfo.includes(item.id)
                          ? "border-purple-300 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <Checkbox
                        id={item.id}
                        checked={callFlowConfig.collectInfo.includes(item.id)}
                        onCheckedChange={() => toggleCollectInfo(item.id)}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* Custom fields */}
                {callFlowConfig.customFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {callFlowConfig.customFields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium"
                      >
                        {field}
                        <button
                          type="button"
                          onClick={() => removeCustomField(field)}
                          className="ml-0.5 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add custom field input */}
                <div className="flex gap-2">
                  <Input
                    value={newCustomField}
                    onChange={(e) => setNewCustomField(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomField();
                      }
                    }}
                    placeholder="Add custom field (e.g., Order Number, Policy ID)..."
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomField}
                    disabled={!newCustomField.trim()}
                    className="shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Options row */}
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  callFlowConfig.transferToHuman ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                }`}>
                  <Checkbox
                    id="transferToHuman"
                    checked={callFlowConfig.transferToHuman}
                    onCheckedChange={(checked) =>
                      setCallFlowConfig({ ...callFlowConfig, transferToHuman: !!checked })
                    }
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-sm font-medium">Human Transfer</span>
                    </div>
                    <p className="text-[11px] text-gray-500">Escalate to agent</p>
                  </div>
                </label>

                <div className="grid gap-1.5">
                  <div className="flex items-center gap-1.5 px-3 pt-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">Business Hours</span>
                  </div>
                  <Input
                    id="businessHours"
                    value={callFlowConfig.businessHours}
                    onChange={(e) =>
                      setCallFlowConfig({ ...callFlowConfig, businessHours: e.target.value })
                    }
                    placeholder="Mon-Fri 9am-5pm"
                    className="text-sm h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <Target className="w-5 h-5 text-purple-600" />
              Review & Generate
            </div>

            {/* Business Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Business</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{businessInfo.businessName}</span>
                {businessInfo.industry && (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">{businessInfo.industry}</span>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{businessInfo.description}</p>
            </div>

            {/* Flow Config Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Configuration</div>

              <div className="flex gap-2 flex-wrap">
                {callFlowConfig.generateInbound && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                    <PhoneIncoming className="w-3 h-3" /> Inbound
                  </span>
                )}
                {callFlowConfig.generateOutbound && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium">
                    <PhoneOutgoing className="w-3 h-3" /> Outbound
                  </span>
                )}
                {callFlowConfig.transferToHuman && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                    <UserPlus className="w-3 h-3" /> Human Transfer
                  </span>
                )}
                {callFlowConfig.businessHours && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs font-medium">
                    <Clock className="w-3 h-3" /> {callFlowConfig.businessHours}
                  </span>
                )}
              </div>

              {allSelectedFields.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500">Fields to collect:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {allSelectedFields.map((label) => (
                      <span key={label} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-700">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI Info Box */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div className="text-sm text-purple-800">
                  AI will generate a complete workflow with professional greetings, conversation handling,
                  decision routing, field collection{callFlowConfig.transferToHuman ? ", human escalation" : ""},
                  and error fallbacks tailored to <span className="font-semibold">{businessInfo.businessName}</span>.
                </div>
              </div>
            </div>

            {/* Error display */}
            {generateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-red-800">Generation failed</div>
                  <div className="text-xs text-red-600 mt-0.5">{generateError}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Language Change Selector — shown inline above the footer */}
        {showLanguageSelector && (
          <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
              <Languages className="w-4 h-4" />
              Change Agent Language
            </div>
            <p className="text-xs text-blue-600">
              AI will translate all workflow nodes (greetings, dialogues, messages) to the selected language and update the agent&apos;s language setting.
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={selectedLanguage}
                onValueChange={setSelectedLanguage}
                disabled={isTranslating}
              >
                <SelectTrigger className="flex-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                      {lang.value === currentLanguage && " (current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleTranslateWorkflow}
                disabled={isTranslating || selectedLanguage === currentLanguage}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Translating...
                  </>
                ) : (
                  "Change"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowLanguageSelector(false);
                  setSelectedLanguage(currentLanguage || "en-US");
                }}
                disabled={isTranslating}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={isGenerating}>
                Back
              </Button>
            )}
            {/* Change Agent Language button — only shown on step 1 when there's an existing workflow */}
            {step === 1 && hasExistingWorkflow && !showLanguageSelector && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLanguageSelector(true)}
                disabled={isGenerating || isTranslating}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Languages className="w-4 h-4 mr-1.5" />
                {currentLangLabel}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isGenerating || isTranslating}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext} className="bg-purple-600 hover:bg-purple-700" disabled={isTranslating}>
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 min-w-[160px]"
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
