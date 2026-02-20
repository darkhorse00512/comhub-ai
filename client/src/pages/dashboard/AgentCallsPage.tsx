import AgentLayout from "@/components/agent/AgentLayout";
import AgentCallsSection from "@/components/agent/AgentCallsSection";

const AgentCallsPage = () => {
  return (
    <AgentLayout>
      {(agent) => (
        <AgentCallsSection agentId={agent.id} />
      )}
    </AgentLayout>
  );
};

export default AgentCallsPage;
