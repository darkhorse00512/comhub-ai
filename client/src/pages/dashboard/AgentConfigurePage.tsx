import AgentLayout from "@/components/agent/AgentLayout";
import AgentConfigureSection from "@/components/agent/AgentConfigureSection";

const AgentConfigurePage = () => {
  return (
    <AgentLayout>
      {(agent, setAgent) => (
        <AgentConfigureSection
          agent={agent}
          onAgentUpdate={(updatedAgent) => setAgent(updatedAgent)}
        />
      )}
    </AgentLayout>
  );
};

export default AgentConfigurePage;
