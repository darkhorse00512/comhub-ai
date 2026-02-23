import { useState } from "react";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeedbackModal = ({ open, onOpenChange }: FeedbackModalProps) => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setSubmitting(true);
    const response = await api.submitFeedback("general", "General Feedback", message.trim());
    setSubmitting(false);

    if (response.error) {
      toast({
        title: "Failed to submit feedback",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
      setMessage("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Open feedback</DialogTitle>
          <DialogDescription>
            We value your feedback! Your insights help us improve our platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="feedback-message">
            What can we do to improve our product?{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="feedback-message"
            placeholder="Tell us what you like, what could be improved, or any issues you're experiencing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-500">How We Use Your Feedback</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your feedback is reviewed by our product team and helps us prioritize features and improvements.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || submitting}
            className="gradient-primary"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
