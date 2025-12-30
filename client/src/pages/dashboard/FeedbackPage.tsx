import { useState } from "react";
import { motion } from "framer-motion";
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
import {
  MessageSquare,
  Send,
  Sparkles,
  Bug,
  Lightbulb,
  HelpCircle,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FeedbackPage = () => {
  const { toast } = useToast();
  const [feedbackForm, setFeedbackForm] = useState({
    type: "feature",
    subject: "",
    message: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedbackTypes = [
    {
      value: "feature",
      label: "Feature Request",
      icon: Lightbulb,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      value: "bug",
      label: "Bug Report",
      icon: Bug,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      value: "improvement",
      label: "Improvement",
      icon: Sparkles,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      value: "question",
      label: "Question",
      icon: HelpCircle,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackForm.subject.trim() || !feedbackForm.message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. We'll review it shortly.",
      });
      setFeedbackForm({
        type: "feature",
        subject: "",
        message: "",
        email: feedbackForm.email,
      });
    }, 1500);
  };

  const selectedType = feedbackTypes.find((t) => t.value === feedbackForm.type);

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Feedback</h1>
        <p className="text-muted-foreground">
          Help us improve ComHub AI with your feedback and suggestions
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Feedback Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Submit Feedback
              </CardTitle>
              <CardDescription>
                We'd love to hear your thoughts, ideas, and suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Feedback Type */}
                <div className="space-y-2">
                  <Label htmlFor="type">Feedback Type</Label>
                  <Select
                    value={feedbackForm.type}
                    onValueChange={(value) =>
                      setFeedbackForm({ ...feedbackForm, type: value })
                    }
                  >
                    <SelectTrigger>
                      {selectedType && (
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${selectedType.bgColor}`}>
                            <selectedType.icon
                              className={`w-4 h-4 ${selectedType.color}`}
                            />
                          </div>
                          <SelectValue />
                        </div>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {feedbackTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${type.bgColor}`}>
                              <type.icon className={`w-4 h-4 ${type.color}`} />
                            </div>
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">
                    Subject <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of your feedback"
                    value={feedbackForm.subject}
                    onChange={(e) =>
                      setFeedbackForm({ ...feedbackForm, subject: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">
                    Message <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Please provide as much detail as possible..."
                    rows={8}
                    value={feedbackForm.message}
                    onChange={(e) =>
                      setFeedbackForm({ ...feedbackForm, message: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {feedbackForm.message.length} characters
                  </p>
                </div>

                {/* Email (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={feedbackForm.email}
                    onChange={(e) =>
                      setFeedbackForm({ ...feedbackForm, email: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide your email if you'd like us to follow up
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Quick Feedback Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Feedback Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedbackTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() =>
                      setFeedbackForm({ ...feedbackForm, type: type.value })
                    }
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      feedbackForm.type === type.value
                        ? `${type.bgColor} border-2 ${type.color.replace(
                            "text-",
                            "border-"
                          )}`
                        : "bg-secondary/30 hover:bg-secondary/50 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          feedbackForm.type === type.value
                            ? type.bgColor
                            : "bg-background/50"
                        }`}
                      >
                        <type.icon className={`w-4 h-4 ${type.color}`} />
                      </div>
                      <span className="font-medium text-foreground">
                        {type.label}
                      </span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Guidelines */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Feedback Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Be specific and provide examples when possible</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Include steps to reproduce for bug reports</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Explain the use case for feature requests</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Be respectful and constructive</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">
                  Need immediate help?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  For urgent issues or questions, reach out to our support team
                  directly.
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:support@comhubai.com">Contact Support</a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
