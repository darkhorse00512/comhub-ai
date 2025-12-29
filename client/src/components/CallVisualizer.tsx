import { motion } from "framer-motion";
import { CallStatus } from "@/hooks/useCall";

interface CallVisualizerProps {
  status: CallStatus;
}

const CallVisualizer = ({ status }: CallVisualizerProps) => {
  const isActive = status === "active";
  const isConnecting = status === "connecting" || status === "ringing";

  return (
    <div className="relative w-32 h-32 mx-auto">
      {/* Outer rings */}
      {(isActive || isConnecting) && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            animate={isActive ? { scale: [1, 1.5], opacity: [0.5, 0] } : { scale: 1, opacity: 0.3 }}
            transition={isActive ? { duration: 2, repeat: Infinity } : {}}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/20"
            animate={isActive ? { scale: [1, 1.8], opacity: [0.3, 0] } : { scale: 1, opacity: 0.2 }}
            transition={isActive ? { duration: 2, repeat: Infinity, delay: 0.5 } : {}}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/10"
            animate={isActive ? { scale: [1, 2.1], opacity: [0.2, 0] } : { scale: 1, opacity: 0.1 }}
            transition={isActive ? { duration: 2, repeat: Infinity, delay: 1 } : {}}
          />
        </>
      )}

      {/* Main circle */}
      <motion.div
        className={`absolute inset-4 rounded-full gradient-primary shadow-glow ${
          isActive ? "animate-pulse-glow" : ""
        }`}
        animate={
          isConnecting
            ? { scale: [1, 1.1, 1] }
            : {}
        }
        transition={
          isConnecting
            ? { duration: 1.5, repeat: Infinity }
            : {}
        }
      />

      {/* Inner content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full bg-primary-foreground/10"
          animate={isActive ? { scale: [1, 1.2, 1] } : {}}
          transition={isActive ? { duration: 0.5, repeat: Infinity } : {}}
        />
      </div>
    </div>
  );
};

export default CallVisualizer;
