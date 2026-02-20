import { useAgentContext } from "@/components/agent/AgentLayout";
import AgentCallsSection from "@/components/agent/AgentCallsSection";

const AgentCallsPage = () => {
  const { agent } = useAgentContext();

  return <AgentCallsSection agentId={agent.id} />;
};

export default AgentCallsPage;
