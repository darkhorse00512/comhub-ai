import { useAgentContext } from "@/components/agent/AgentLayout";
import AgentOutboundSection from "@/components/agent/AgentOutboundSection";

const AgentOutboundPage = () => {
  const { agent, setAgent } = useAgentContext();

  return (
    <AgentOutboundSection
      agent={agent}
      onAgentUpdate={(updatedAgent) => setAgent(updatedAgent)}
    />
  );
};

export default AgentOutboundPage;
