import { useState } from "react";
import {
  BookOpen,
  MessageSquare,
  FileText,
  Database,
  GitBranch,
  GitMerge,
  Phone,
  Settings,
  Clock,
  AlertTriangle,
  Voicemail,
  Code,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Zap,
  Users,
  PhoneCall,
  PhoneOutgoing,
  X,
  Award,
  Target,
  TrendingUp as TrendingUpIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nodeDescriptions } from "@/data/nodeDescriptions";

const TutorialPage = () => {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "nodes", label: "Node Types", icon: GitBranch },
    { id: "building", label: "Building Workflows", icon: Settings },
    { id: "patterns", label: "Common Patterns", icon: Zap },
    { id: "best-practices", label: "Best Practices", icon: Lightbulb },
  ];

  const nodeTypes = [
    { type: "agentSetup", icon: Settings, color: "bg-purple-100 text-purple-700", borderColor: "border-purple-300" },
    { type: "callDirection", icon: Phone, color: "bg-indigo-100 text-indigo-700", borderColor: "border-indigo-300" },
    { type: "scripted", icon: FileText, color: "bg-blue-100 text-blue-700", borderColor: "border-blue-300" },
    { type: "dialogue", icon: MessageSquare, color: "bg-green-100 text-green-700", borderColor: "border-green-300" },
    { type: "field_setter", icon: Database, color: "bg-yellow-100 text-yellow-700", borderColor: "border-yellow-300" },
    { type: "junction", icon: GitBranch, color: "bg-blue-100 text-blue-700", borderColor: "border-blue-300" },
    { type: "switch", icon: GitMerge, color: "bg-pink-100 text-pink-700", borderColor: "border-pink-300" },
    { type: "call_transfer", icon: PhoneCall, color: "bg-orange-100 text-orange-700", borderColor: "border-orange-300" },
    { type: "time_limit", icon: Clock, color: "bg-red-100 text-red-700", borderColor: "border-red-300" },
    { type: "fallback", icon: AlertTriangle, color: "bg-amber-100 text-amber-700", borderColor: "border-amber-300" },
    { type: "voicemail", icon: Voicemail, color: "bg-slate-100 text-slate-700", borderColor: "border-slate-300" },
    { type: "reconfigure", icon: Settings, color: "bg-cyan-100 text-cyan-700", borderColor: "border-cyan-300" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white py-20 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                  Complete Guide
                </span>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                  12 Node Types
                </span>
              </div>
              <h1 className="text-5xl font-bold">Call System Tutorial</h1>
            </div>
          </div>
          <p className="text-xl text-blue-50 max-w-3xl leading-relaxed">
            Master AI-driven call workflows with our comprehensive guide. Learn to build professional
            inbound and outbound call systems that delight your customers.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-10 max-w-2xl">
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">12</div>
              <div className="text-sm text-blue-100">Node Types</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">4</div>
              <div className="text-sm text-blue-100">Ready Templates</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-1">∞</div>
              <div className="text-sm text-blue-100">Possibilities</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 py-4 overflow-x-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "outline"}
                  onClick={() => setActiveSection(section.id)}
                  className="whitespace-nowrap"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {section.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">What is a Call Workflow?</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                A call workflow is a visual representation of how your AI agent handles phone calls.
                It consists of <strong>nodes</strong> (individual steps) connected by <strong>edges</strong> (the flow between steps).
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Key Concepts
                </h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Nodes:</strong> Individual steps in your call flow (greeting, conversation, transfer, etc.)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Edges:</strong> Connections that define the flow from one node to another</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Inbound Calls:</strong> Calls coming into your business (customer support, inquiries)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Outbound Calls:</strong> Calls made by your AI agent (sales, reminders, follow-ups)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-indigo-600" />
                    Inbound Call Flow
                  </CardTitle>
                  <CardDescription>Customer calls your business</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span>1. Greeting message</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span>2. Collect customer information</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span>3. AI conversation to help</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span>4. Transfer to human if needed</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-indigo-500" />
                      <span>5. Closing / Thank you</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PhoneOutgoing className="w-5 h-5 text-orange-600" />
                    Outbound Call Flow
                  </CardTitle>
                  <CardDescription>Your AI calls customers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                      <span>1. Introduction & permission</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                      <span>2. Check if interested</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                      <span>3. Pitch or information delivery</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                      <span>4. Schedule follow-up</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <ArrowRight className="w-4 h-4 text-orange-500" />
                      <span>5. Polite closing</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Node Types Section */}
        {activeSection === "nodes" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Understanding Node Types</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                Each node type serves a specific purpose in your call workflow. Learn what each one does and when to use it.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {nodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                const description = nodeDescriptions[nodeType.type];

                return (
                  <Card
                    key={nodeType.type}
                    className="border-2 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-xl ${nodeType.color} shadow-md`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1">{description?.title || nodeType.type}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Award className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-gray-500 font-medium">Essential Node</span>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-base leading-relaxed text-gray-700">
                        {description?.tooltip}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {description?.examples && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent"></div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Use Cases</p>
                            <div className="h-px flex-1 bg-gradient-to-l from-blue-200 to-transparent"></div>
                          </div>
                          <ul className="space-y-2">
                            {description.examples.map((example, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2 pl-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="leading-relaxed">{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {description?.useCases && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                            <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Scenarios</p>
                          </div>
                          <ul className="space-y-2">
                            {description.useCases.map((useCase, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2 pl-2">
                                <Target className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <span className="leading-relaxed">{useCase}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Building Workflows Section */}
        {activeSection === "building" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Building Your First Workflow</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                Follow this step-by-step guide to create a complete call workflow from scratch.
              </p>
            </div>

            <div className="space-y-6">
              {/* Step 1 */}
              <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-purple-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      1
                    </div>
                    <span className="text-xl">Start with Agent Setup</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Every workflow MUST start with an <strong>Agent Setup</strong> node. This defines your AI agent's personality and core instructions.
                  </p>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-purple-900 mb-2">What to include:</p>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li>• Agent's role and personality (professional, friendly, etc.)</li>
                      <li>• Company name and industry</li>
                      <li>• Core behavior guidelines</li>
                      <li>• Tone and communication style</li>
                    </ul>
                  </div>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 font-mono text-sm">
                    <p className="text-gray-600 mb-2">Example:</p>
                    <p className="text-gray-800">
                      "You are a professional customer service AI for Acme Corp. Be polite, empathetic, and solution-oriented.
                      Listen carefully to customer needs and provide helpful assistance."
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-indigo-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      2
                    </div>
                    <span className="text-xl">Add Call Direction Node</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Add a <strong>Call Direction</strong> node to mark the entry point. Set it to "inbound" or "outbound" depending on your use case.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="font-semibold text-blue-900 mb-2">Inbound:</p>
                      <p className="text-sm text-gray-700">Customer calls you (support, inquiries, bookings)</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="font-semibold text-orange-900 mb-2">Outbound:</p>
                      <p className="text-sm text-gray-700">You call customer (sales, reminders, surveys)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      3
                    </div>
                    <span className="text-xl">Create Greeting (Scripted Node)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Add a <strong>Scripted Node</strong> with a warm, professional greeting. This gives a consistent first impression.
                  </p>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 font-mono text-sm">
                    <p className="text-gray-600 mb-2">Example:</p>
                    <p className="text-gray-800">
                      "Thank you for calling Acme Corporation. My name is Sarah, your AI assistant. How may I help you today?"
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 4 */}
              <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-yellow-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-yellow-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      4
                    </div>
                    <span className="text-xl">Collect Information (Field Setter Nodes)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Use <strong>Field Setter Nodes</strong> to collect customer data like name, phone, email, or account number.
                  </p>
                  <div className="space-y-2">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                      <strong>Field:</strong> customer_name | <strong>Type:</strong> text
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                      <strong>Field:</strong> customer_phone | <strong>Type:</strong> phone
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                      <strong>Field:</strong> customer_email | <strong>Type:</strong> email
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 5 */}
              <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-green-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      5
                    </div>
                    <span className="text-xl">Main Conversation (Dialogue Node)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Add a <strong>Dialogue Node</strong> for the main AI conversation. This is where your agent helps the customer.
                  </p>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 font-mono text-sm">
                    <p className="text-gray-600 mb-2">Example Instructions:</p>
                    <p className="text-gray-800">
                      "Listen to the customer's inquiry. Ask clarifying questions to understand their needs.
                      Provide helpful information or solutions. Be patient and empathetic."
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Set max turns to limit conversation length (e.g., 10 turns)
                  </p>
                </CardContent>
              </Card>

              {/* Step 6 */}
              <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      6
                    </div>
                    <span className="text-xl">Add Branching Logic (Junction/Switch Nodes)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Use <strong>Junction Nodes</strong> (if/then) or <strong>Switch Nodes</strong> (multiple options) to route calls based on conditions.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Junction:
                      </p>
                      <p className="text-sm text-gray-700">Two paths: "Is issue resolved?" → True/False</p>
                    </div>
                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                      <p className="font-semibold text-pink-900 mb-2 flex items-center gap-2">
                        <GitMerge className="w-4 h-4" />
                        Switch:
                      </p>
                      <p className="text-sm text-gray-700">Multiple paths: "Press 1 for Sales, 2 for Support"</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step 7 */}
              <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-orange-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      7
                    </div>
                    <span className="text-xl">Handle Escalation (Call Transfer Node)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    Add a <strong>Call Transfer Node</strong> to transfer complex cases to human agents.
                  </p>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-orange-900 mb-2">Best Practice:</p>
                    <p className="text-sm text-gray-700">
                      Always include a warm transfer message: "Let me connect you with a specialist who can help you better."
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 8 */}
              <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow bg-gradient-to-r from-green-50/50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                      8
                    </div>
                    <span className="text-xl">Close the Call (Scripted Node)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-700">
                    End with a <strong>Scripted Node</strong> thanking the customer and closing professionally.
                  </p>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 font-mono text-sm">
                    <p className="text-gray-600 mb-2">Example:</p>
                    <p className="text-gray-800">
                      "Thank you for contacting Acme Corporation. We appreciate your business. Have a great day!"
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Common Patterns Section */}
        {activeSection === "patterns" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Common Call Flow Patterns</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                Pre-built patterns you can use as templates for your workflows.
              </p>
            </div>

            <Tabs defaultValue="support" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="support">Customer Support</TabsTrigger>
                <TabsTrigger value="sales">Sales Outbound</TabsTrigger>
                <TabsTrigger value="booking">Booking System</TabsTrigger>
                <TabsTrigger value="survey">Survey Calls</TabsTrigger>
              </TabsList>

              <TabsContent value="support" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Customer Support Pattern
                    </CardTitle>
                    <CardDescription>Handle inbound customer inquiries and issues</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="font-semibold text-gray-900 mb-3">Flow Structure:</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="font-medium text-gray-900">Agent Setup</p>
                            <p className="text-sm text-gray-600">Professional support agent personality</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="font-medium text-gray-900">Call Direction (Inbound)</p>
                            <p className="text-sm text-gray-600">Mark as incoming call</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="font-medium text-gray-900">Greeting (Scripted)</p>
                            <p className="text-sm text-gray-600">"Thank you for calling [Company]. How can I help?"</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                          <div>
                            <p className="font-medium text-gray-900">Collect Info (Field Setter)</p>
                            <p className="text-sm text-gray-600">Get customer name, account number</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
                          <div>
                            <p className="font-medium text-gray-900">Support Dialogue</p>
                            <p className="text-sm text-gray-600">AI conversation to resolve issue</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
                          <div>
                            <p className="font-medium text-gray-900">Resolution Check (Junction)</p>
                            <p className="text-sm text-gray-600">Is issue resolved? True → Thank you, False → Transfer</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">7</div>
                          <div>
                            <p className="font-medium text-gray-900">Transfer to Human (if needed)</p>
                            <p className="text-sm text-gray-600">Escalate complex issues</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">8</div>
                          <div>
                            <p className="font-medium text-gray-900">Closing (Scripted)</p>
                            <p className="text-sm text-gray-600">Thank customer and say goodbye</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sales" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PhoneOutgoing className="w-5 h-5 text-orange-600" />
                      Sales Outbound Pattern
                    </CardTitle>
                    <CardDescription>Make outbound sales or follow-up calls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="font-semibold text-gray-900 mb-3">Flow Structure:</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="font-medium text-gray-900">Agent Setup</p>
                            <p className="text-sm text-gray-600">Friendly sales representative personality</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="font-medium text-gray-900">Call Direction (Outbound)</p>
                            <p className="text-sm text-gray-600">Mark as outgoing call</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="font-medium text-gray-900">Introduction (Scripted)</p>
                            <p className="text-sm text-gray-600">"Hi [Name], this is [Agent] from [Company]. Is now a good time?"</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                          <div>
                            <p className="font-medium text-gray-900">Interest Check (Junction)</p>
                            <p className="text-sm text-gray-600">Is prospect interested? True → Continue, False → Polite exit</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
                          <div>
                            <p className="font-medium text-gray-900">Sales Pitch (Dialogue)</p>
                            <p className="text-sm text-gray-600">Present offer, answer questions</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
                          <div>
                            <p className="font-medium text-gray-900">Schedule Follow-up (Field Setter)</p>
                            <p className="text-sm text-gray-600">Set next contact date</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">7</div>
                          <div>
                            <p className="font-medium text-gray-900">Closing (Scripted)</p>
                            <p className="text-sm text-gray-600">Thank prospect, confirm next steps</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-orange-900 mb-2">Important:</p>
                      <p className="text-sm text-gray-700">
                        Always respect the prospect's time. If they're not interested, politely end the call.
                        Include an option to opt-out of future calls.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="booking" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      Appointment Booking Pattern
                    </CardTitle>
                    <CardDescription>Schedule appointments and reservations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="font-semibold text-gray-900 mb-3">Flow Structure:</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="font-medium text-gray-900">Agent Setup</p>
                            <p className="text-sm text-gray-600">Efficient booking assistant</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="font-medium text-gray-900">Call Direction (Inbound)</p>
                            <p className="text-sm text-gray-600">Customer calling to book</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="font-medium text-gray-900">Greeting (Scripted)</p>
                            <p className="text-sm text-gray-600">"Thank you for calling. I can help you schedule an appointment."</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                          <div>
                            <p className="font-medium text-gray-900">Collect Details (Field Setters)</p>
                            <p className="text-sm text-gray-600">Name, phone, email, preferred date/time</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
                          <div>
                            <p className="font-medium text-gray-900">Check Availability (Function)</p>
                            <p className="text-sm text-gray-600">API call to check calendar</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
                          <div>
                            <p className="font-medium text-gray-900">Available? (Junction)</p>
                            <p className="text-sm text-gray-600">True → Confirm, False → Offer alternatives</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">7</div>
                          <div>
                            <p className="font-medium text-gray-900">Confirmation (Scripted)</p>
                            <p className="text-sm text-gray-600">Confirm details, send confirmation email</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="survey" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PhoneOutgoing className="w-5 h-5 text-green-600" />
                      Survey Call Pattern
                    </CardTitle>
                    <CardDescription>Conduct customer satisfaction surveys</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="font-semibold text-gray-900 mb-3">Flow Structure:</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <div>
                            <p className="font-medium text-gray-900">Agent Setup</p>
                            <p className="text-sm text-gray-600">Brief, respectful survey agent</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <div>
                            <p className="font-medium text-gray-900">Call Direction (Outbound)</p>
                            <p className="text-sm text-gray-600">Survey outreach call</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <div>
                            <p className="font-medium text-gray-900">Introduction (Scripted)</p>
                            <p className="text-sm text-gray-600">"Quick 2-minute survey about your recent experience"</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                          <div>
                            <p className="font-medium text-gray-900">Willing to participate? (Junction)</p>
                            <p className="text-sm text-gray-600">True → Continue, False → Thank and end</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
                          <div>
                            <p className="font-medium text-gray-900">Survey Questions (Dialogue)</p>
                            <p className="text-sm text-gray-600">Ask questions, collect responses</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
                          <div>
                            <p className="font-medium text-gray-900">Store Responses (Field Setters)</p>
                            <p className="text-sm text-gray-600">Save satisfaction rating, comments</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">7</div>
                          <div>
                            <p className="font-medium text-gray-900">Thank You (Scripted)</p>
                            <p className="text-sm text-gray-600">Appreciate their time and feedback</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-green-900 mb-2">Best Practice:</p>
                      <p className="text-sm text-gray-700">
                        Keep surveys under 3 minutes. Let customers know upfront how long it will take.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Best Practices Section */}
        {activeSection === "best-practices" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Best Practices</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                Follow these guidelines to create professional, effective call workflows.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Do's */}
              <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50">
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <CheckCircle2 className="w-6 h-6" />
                    Do's
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Start with Agent Setup</p>
                        <p className="text-sm text-gray-600">Always define your agent's personality and role first</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Use Clear Labels</p>
                        <p className="text-sm text-gray-600">Name nodes descriptively: "Greeting", "Collect Name", "Main Support"</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Include Error Handling</p>
                        <p className="text-sm text-gray-600">Add fallback nodes for when things go wrong</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Test Your Workflows</p>
                        <p className="text-sm text-gray-600">Use the test feature to verify your flow works correctly</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Provide Human Escalation</p>
                        <p className="text-sm text-gray-600">Always include a path to transfer to a human agent</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Keep Greetings Professional</p>
                        <p className="text-sm text-gray-600">Use warm, clear language that represents your brand</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Set Conversation Limits</p>
                        <p className="text-sm text-gray-600">Use maxTurns in dialogue nodes to prevent endless loops</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Organize Your Flow</p>
                        <p className="text-sm text-gray-600">Keep inbound and outbound flows visually separated</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Don'ts */}
              <Card className="border-2 border-red-200">
                <CardHeader className="bg-red-50">
                  <CardTitle className="flex items-center gap-2 text-red-900">
                    <AlertTriangle className="w-6 h-6" />
                    Don'ts
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Skip Agent Setup</p>
                        <p className="text-sm text-gray-600">Workflows without agent setup will behave inconsistently</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Create Orphaned Nodes</p>
                        <p className="text-sm text-gray-600">Every node should be connected to the workflow</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Use Vague Instructions</p>
                        <p className="text-sm text-gray-600">Be specific in dialogue node instructions for best results</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Forget Closing Messages</p>
                        <p className="text-sm text-gray-600">Always end calls professionally, don't just disconnect</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Overcomplicate</p>
                        <p className="text-sm text-gray-600">Start simple, add complexity only when needed</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Collect Unnecessary Data</p>
                        <p className="text-sm text-gray-600">Only ask for information you actually need</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Ignore Edge Cases</p>
                        <p className="text-sm text-gray-600">Plan for errors, confusion, and unexpected responses</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">Don't Deploy Untested Workflows</p>
                        <p className="text-sm text-gray-600">Always test before going live with real customers</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Quick Tips */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Lightbulb className="w-6 h-6 text-yellow-600" />
                  Pro Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="font-semibold text-gray-900 mb-2">Use AI Generator</p>
                    <p className="text-sm text-gray-600">
                      Click "Generate with AI" to create a complete workflow automatically based on your business info.
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="font-semibold text-gray-900 mb-2">Clone Nodes</p>
                    <p className="text-sm text-gray-600">
                      Use the clone button to duplicate nodes with similar configurations quickly.
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="font-semibold text-gray-900 mb-2">Lock Canvas</p>
                    <p className="text-sm text-gray-600">
                      Lock panning when you're done arranging nodes to prevent accidental moves.
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="font-semibold text-gray-900 mb-2">Save Often</p>
                    <p className="text-sm text-gray-600">
                      Click "Save Workflow" regularly to avoid losing your progress.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="relative bg-gradient-to-br from-purple-700 via-blue-700 to-indigo-800 text-white py-20 mt-16 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
            <TrendingUpIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">Start Building Today</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Build Your Call System?</h2>
          <p className="text-xl text-purple-100 mb-8 leading-relaxed">
            Join thousands of businesses creating professional AI-driven call workflows
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-purple-700 hover:bg-purple-50 hover:scale-105 transition-all text-lg px-8 py-6 shadow-2xl"
              onClick={() => window.location.href = '/dashboard'}
            >
              <Zap className="w-5 h-5 mr-2" />
              Go to Agent Studio
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              onClick={() => setActiveSection('overview')}
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Review Tutorial
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-white/20">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">5min</div>
              <div className="text-sm text-purple-200">Quick Start</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">24/7</div>
              <div className="text-sm text-purple-200">Always Available</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">Free</div>
              <div className="text-sm text-purple-200">No Credit Card</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialPage;
