import { useAgentContext } from "@/components/agent/AgentLayout";
import AgentConfigureSection from "@/components/agent/AgentConfigureSection";

const AgentConfigurePage = () => {
  const { agent, setAgent, registerNavGuard } = useAgentContext();

  return (
    <AgentConfigureSection
      agent={agent}
      onAgentUpdate={(updatedAgent) => setAgent(updatedAgent)}
      registerNavGuard={registerNavGuard}
    />
  );
};

export default AgentConfigurePage;
