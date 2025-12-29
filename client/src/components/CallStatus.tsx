import { CallStatus } from "@/hooks/useCall";
import { motion, AnimatePresence } from "framer-motion";

interface CallStatusDisplayProps {
  status: CallStatus;
  duration: number;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const statusConfig: Record<CallStatus, { label: string; color: string }> = {
  idle: { label: "Ready to call", color: "text-muted-foreground" },
  connecting: { label: "Connecting...", color: "text-warning" },
  ringing: { label: "Ringing...", color: "text-primary" },
  active: { label: "In call", color: "text-success" },
  ended: { label: "Call ended", color: "text-muted-foreground" },
};

const CallStatusDisplay = ({ status, duration }: CallStatusDisplayProps) => {
  const config = statusConfig[status];

  return (
    <div className="text-center space-y-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="flex items-center justify-center gap-2"
        >
          {(status === "connecting" || status === "ringing") && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
          )}
          {status === "active" && (
            <span className="relative flex h-3 w-3">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-success animate-pulse" />
            </span>
          )}
          <span className={`text-lg font-medium ${config.color}`}>
            {config.label}
          </span>
        </motion.div>
      </AnimatePresence>

      {status === "active" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-3xl font-mono font-bold text-foreground"
        >
          {formatDuration(duration)}
        </motion.p>
      )}
    </div>
  );
};

export default CallStatusDisplay;
