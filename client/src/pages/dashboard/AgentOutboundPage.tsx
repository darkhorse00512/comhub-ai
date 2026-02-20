import AgentLayout from "@/components/agent/AgentLayout";
import AgentOutboundSection from "@/components/agent/AgentOutboundSection";

const AgentOutboundPage = () => {
  return (
    <AgentLayout>
      {(agent, setAgent) => (
        <AgentOutboundSection
          agent={agent}
          onAgentUpdate={(updatedAgent) => setAgent(updatedAgent)}
        />
      )}
    </AgentLayout>
  );
};

export default AgentOutboundPage;
