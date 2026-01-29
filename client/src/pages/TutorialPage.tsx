import { useState } from "react";
import { motion } from "framer-motion";
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
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Users,
  PhoneCall,
  PhoneOutgoing,
  X,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nodeDescriptions } from "@/data/nodeDescriptions";

const TutorialPage = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const nodeTypes = [
    { type: "agentSetup", icon: Settings, color: "bg-purple-500/20 text-purple-400", borderColor: "border-purple-500/30" },
    { type: "callDirection", icon: Phone, color: "bg-indigo-500/20 text-indigo-400", borderColor: "border-indigo-500/30" },
    { type: "scripted", icon: FileText, color: "bg-blue-500/20 text-blue-400", borderColor: "border-blue-500/30" },
    { type: "dialogue", icon: MessageSquare, color: "bg-green-500/20 text-green-400", borderColor: "border-green-500/30" },
    { type: "field_setter", icon: Database, color: "bg-yellow-500/20 text-yellow-400", borderColor: "border-yellow-500/30" },
    { type: "junction", icon: GitBranch, color: "bg-cyan-500/20 text-cyan-400", borderColor: "border-cyan-500/30" },
    { type: "switch", icon: GitMerge, color: "bg-pink-500/20 text-pink-400", borderColor: "border-pink-500/30" },
    { type: "call_transfer", icon: PhoneCall, color: "bg-orange-500/20 text-orange-400", borderColor: "border-orange-500/30" },
    { type: "time_limit", icon: Clock, color: "bg-red-500/20 text-red-400", borderColor: "border-red-500/30" },
    { type: "fallback", icon: AlertTriangle, color: "bg-amber-500/20 text-amber-400", borderColor: "border-amber-500/30" },
    { type: "voicemail", icon: Voicemail, color: "bg-slate-500/20 text-slate-400", borderColor: "border-slate-500/30" },
    { type: "reconfigure", icon: RefreshCw, color: "bg-teal-500/20 text-teal-400", borderColor: "border-teal-500/30" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tutorial</h1>
            <p className="text-muted-foreground">Learn how to build AI call workflows</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-primary">12</div>
            <div className="text-sm text-muted-foreground">Node Types</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-primary">4</div>
            <div className="text-sm text-muted-foreground">Templates</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-primary">8</div>
            <div className="text-sm text-muted-foreground">Steps</div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="nodes">Nodes</TabsTrigger>
            <TabsTrigger value="building">Building</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">What is a Call Workflow?</CardTitle>
                <CardDescription>
                  A visual representation of how your AI agent handles phone calls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  A call workflow consists of <strong className="text-foreground">nodes</strong> (individual steps) connected by <strong className="text-foreground">edges</strong> (the flow between steps).
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      Inbound Calls
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Customer calls your business</li>
                      <li>• Support & inquiries</li>
                      <li>• Appointment booking</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <PhoneOutgoing className="w-4 h-4 text-orange-500" />
                      Outbound Calls
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• AI calls customers</li>
                      <li>• Sales & follow-ups</li>
                      <li>• Reminders & surveys</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Key Concepts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { title: "Nodes", desc: "Individual steps in your call flow (greeting, conversation, transfer)" },
                    { title: "Edges", desc: "Connections that define flow from one node to another" },
                    { title: "Agent Setup", desc: "Defines AI personality and instructions" },
                    { title: "Call Direction", desc: "Entry point marking inbound or outbound" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{item.title}:</span>
                        <span className="text-muted-foreground ml-1">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {nodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                const description = nodeDescriptions[nodeType.type];

                return (
                  <Card key={nodeType.type} className="glass border-border/50 hover:shadow-glow-lg transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${nodeType.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <CardTitle className="text-lg text-foreground">
                          {description?.title || nodeType.type}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {description?.tooltip}
                      </p>
                      {description?.examples && (
                        <div className="space-y-1.5">
                          {description.examples.slice(0, 2).map((example, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                              <ArrowRight className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                              <span>{example}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Building Tab */}
          <TabsContent value="building" className="space-y-4">
            {[
              { num: 1, title: "Agent Setup", desc: "Define AI personality and core instructions", color: "from-purple-600 to-purple-700" },
              { num: 2, title: "Call Direction", desc: "Mark entry point as inbound or outbound", color: "from-indigo-600 to-indigo-700" },
              { num: 3, title: "Greeting", desc: "Add warm, professional welcome message", color: "from-blue-600 to-blue-700" },
              { num: 4, title: "Collect Info", desc: "Use Field Setter nodes to gather customer data", color: "from-yellow-600 to-yellow-700" },
              { num: 5, title: "Conversation", desc: "Add Dialogue node for main AI interaction", color: "from-green-600 to-green-700" },
              { num: 6, title: "Branching", desc: "Use Junction or Switch for conditional paths", color: "from-cyan-600 to-cyan-700" },
              { num: 7, title: "Transfer", desc: "Add Call Transfer for human escalation", color: "from-orange-600 to-orange-700" },
              { num: 8, title: "Closing", desc: "End with professional thank you message", color: "from-green-600 to-green-700" },
            ].map((step) => (
              <Card key={step.num} className="glass border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 bg-gradient-to-br ${step.color} text-white rounded-xl flex items-center justify-center font-bold shadow-lg flex-shrink-0`}>
                      {step.num}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4">
            {[
              {
                title: "Customer Support",
                icon: Users,
                color: "text-indigo-400",
                bg: "bg-indigo-500/10",
                steps: ["Agent Setup", "Inbound Direction", "Greeting", "Collect Name", "Main Dialogue", "Resolution Check", "Transfer/Close"]
              },
              {
                title: "Sales Outbound",
                icon: PhoneOutgoing,
                color: "text-orange-400",
                bg: "bg-orange-500/10",
                steps: ["Agent Setup", "Outbound Direction", "Introduction", "Interest Check", "Sales Pitch", "Schedule Follow-up", "Closing"]
              },
              {
                title: "Appointment Booking",
                icon: Clock,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                steps: ["Agent Setup", "Inbound Direction", "Greeting", "Collect Details", "Check Availability", "Confirm Booking", "Send Confirmation"]
              },
              {
                title: "Survey Calls",
                icon: MessageSquare,
                color: "text-green-400",
                bg: "bg-green-500/10",
                steps: ["Agent Setup", "Outbound Direction", "Introduction", "Participation Check", "Survey Questions", "Store Responses", "Thank You"]
              },
            ].map((pattern, idx) => {
              const Icon = pattern.icon;
              return (
                <Card key={idx} className="glass border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${pattern.bg}`}>
                        <Icon className={`w-5 h-5 ${pattern.color}`} />
                      </div>
                      <CardTitle className="text-lg text-foreground">{pattern.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {pattern.steps.map((step, stepIdx) => (
                        <div key={stepIdx} className="flex items-center gap-1">
                          <span className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground">
                            {step}
                          </span>
                          {stepIdx < pattern.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="glass border-green-500/30">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Do's
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {[
                      "Always start with Agent Setup",
                      "Use clear, descriptive node labels",
                      "Include error handling (Fallback)",
                      "Test your workflows thoroughly",
                      "Provide human escalation option",
                      "Keep greetings professional",
                      "Set conversation limits (maxTurns)",
                      "Organize flows visually"
                    ].map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="glass border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    <X className="w-5 h-5" />
                    Don'ts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {[
                      "Skip Agent Setup node",
                      "Create orphaned (unconnected) nodes",
                      "Use vague AI instructions",
                      "Forget closing messages",
                      "Overcomplicate your flows",
                      "Collect unnecessary data",
                      "Ignore edge cases",
                      "Deploy untested workflows"
                    ].map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="glass border-primary/30">
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Pro Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { title: "Use AI Generator", desc: "Click 'Generate with AI' to create workflows automatically" },
                    { title: "Clone Nodes", desc: "Duplicate nodes with similar configurations quickly" },
                    { title: "Lock Canvas", desc: "Lock panning when done arranging to prevent accidents" },
                    { title: "Save Often", desc: "Click 'Save Workflow' regularly to avoid losing progress" },
                  ].map((tip, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <h4 className="font-medium text-foreground text-sm mb-1">{tip.title}</h4>
                      <p className="text-xs text-muted-foreground">{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default TutorialPage;
