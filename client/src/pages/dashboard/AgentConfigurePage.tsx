import { useAgentContext } from "@/components/agent/AgentLayout";
import AgentConfigureSection from "@/components/agent/AgentConfigureSection";

const AgentConfigurePage = () => {
  const { agent, setAgent } = useAgentContext();

  return (
    <AgentConfigureSection
      agent={agent}
      onAgentUpdate={(updatedAgent) => setAgent(updatedAgent)}
    />
  );
};

export default AgentConfigurePage;
