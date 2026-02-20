import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  Bug,
  Lightbulb,
  HelpCircle,
  Star,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { useAgentContext } from "@/components/agent/AgentLayout";

const typeIcons: Record<string, any> = {
  feature: Star,
  bug: Bug,
  improvement: Lightbulb,
  question: HelpCircle,
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-yellow-100 text-yellow-700",
  "in-progress": "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
};

const AgentFeedbackPage = () => {
  const { agent } = useAgentContext();
  const { toast } = useToast();
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState("improvement");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    const result = await api.getFeedback();
    if (result.data) {
      setFeedbackList(result.data);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const fullSubject = `[Agent: ${agent.name}] ${subject.trim()}`;
    const result = await api.submitFeedback(type, fullSubject, message.trim());
    setSubmitting(false);

    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
      setSubject("");
      setMessage("");
      fetchFeedback();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-6"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Feedback
          </h2>
          <p className="text-muted-foreground mt-1">
            Submit feedback or report issues for {agent.name}
          </p>
        </div>

        {/* Submit Feedback Form */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Submit Feedback</CardTitle>
            <CardDescription>
              Help us improve by sharing your experience with this agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue or suggestion in detail..."
                rows={4}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feedback History */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Your Feedback History</CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchFeedback} className="h-8 w-8">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No feedback submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackList.map((item: any) => {
                  const TypeIcon = typeIcons[item.type] || MessageSquare;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-border bg-background/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {item.subject}
                          </span>
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${statusColors[item.status] || ""}`}>
                          {item.status === "new" && <Clock className="w-3 h-3 mr-1" />}
                          {item.status === "reviewed" && <Eye className="w-3 h-3 mr-1" />}
                          {item.status === "resolved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {item.type}
                        </Badge>
                        <span>
                          {item.created_at
                            ? format(new Date(item.created_at), "MMM d, yyyy 'at' HH:mm")
                            : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AgentFeedbackPage;
