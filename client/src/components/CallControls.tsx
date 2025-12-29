import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallStatus } from "@/hooks/useCall";
import { motion } from "framer-motion";

interface CallControlsProps {
  status: CallStatus;
  isMuted: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

const CallControls = ({
  status,
  isMuted,
  onStartCall,
  onEndCall,
  onToggleMute,
}: CallControlsProps) => {
  const isActive = status === "active";
  const isConnecting = status === "connecting" || status === "ringing";

  return (
    <div className="flex items-center justify-center gap-6">
      {status === "idle" || status === "ended" ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="call"
            size="icon-xl"
            onClick={onStartCall}
            className="relative"
          >
            <div className="absolute inset-0 rounded-full gradient-primary animate-pulse-glow opacity-30" />
            <Phone className="w-7 h-7 relative z-10" />
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-4"
        >
          <Button
            variant="glass"
            size="icon-lg"
            onClick={onToggleMute}
            disabled={!isActive}
            className={isMuted ? "border-destructive/50 text-destructive" : ""}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          <Button
            variant="call-end"
            size="icon-xl"
            onClick={onEndCall}
            disabled={isConnecting}
          >
            <PhoneOff className="w-7 h-7" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CallControls;
