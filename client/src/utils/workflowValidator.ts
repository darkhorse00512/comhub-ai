import { Node, Edge } from "@/components/FlowCanvas";

export interface ValidationItem {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  errors: ValidationItem[];
  warnings: ValidationItem[];
}

function makeItem(
  node: Node,
  message: string,
  severity: "error" | "warning"
): ValidationItem {
  return {
    nodeId: node.id,
    nodeLabel: node.data?.label || node.type,
    nodeType: node.type,
    message,
    severity,
  };
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: ValidationItem[] = [];
  const warnings: ValidationItem[] = [];

  // Build lookup maps
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const incomingEdges = new Map<string, Edge[]>();
  const outgoingEdges = new Map<string, Edge[]>();
  nodes.forEach((n) => {
    incomingEdges.set(n.id, []);
    outgoingEdges.set(n.id, []);
  });
  edges.forEach((e) => {
    incomingEdges.get(e.target)?.push(e);
    outgoingEdges.get(e.source)?.push(e);
  });

  // --- Structural checks ---

  // 1. Agent Setup must exist
  const agentSetupNode = nodes.find((n) => n.type === "agentSetup");
  if (!agentSetupNode) {
    errors.push({
      nodeId: "",
      nodeLabel: "Workflow",
      nodeType: "workflow",
      message: "Missing required Agent Setup node",
      severity: "error",
    });
  }

  // 2. Call Direction must exist
  const callDirectionNodes = nodes.filter((n) => n.type === "callDirection");
  if (callDirectionNodes.length === 0) {
    errors.push({
      nodeId: "",
      nodeLabel: "Workflow",
      nodeType: "workflow",
      message: "Missing required Call Direction node. Add at least one inbound or outbound entry point.",
      severity: "error",
    });
  }

  // --- Per-node validation ---
  for (const node of nodes) {
    const incoming = incomingEdges.get(node.id) || [];
    const outgoing = outgoingEdges.get(node.id) || [];

    // 3. Agent Setup: must have system message
    if (node.type === "agentSetup") {
      if (!node.data?.systemMessage?.trim()) {
        errors.push(makeItem(node, "Agent Setup has no system message. The AI needs instructions to know how to behave.", "error"));
      }
      // 10. Agent Setup must have outgoing edges
      if (outgoing.length === 0) {
        errors.push(makeItem(node, "Agent Setup has no outgoing connections. Connect it to a Call Direction or other node.", "error"));
      }
    }

    // 11. Call Direction must have outgoing edges
    if (node.type === "callDirection") {
      if (outgoing.length === 0) {
        errors.push(makeItem(node, "Call Direction has no outgoing connections. Connect it to the next step in your flow.", "error"));
      }
    }

    // 4. Dialogue: must have stageMessage
    if (node.type === "standard" && node.data?.type === "dialogue") {
      if (!node.data?.stageMessage?.trim()) {
        errors.push(makeItem(node, "Dialogue node has no instructions. The AI won't know what to say.", "error"));
      }
    }

    // 5. Scripted: must have script
    if (node.type === "standard" && node.data?.type === "scripted") {
      if (!node.data?.script?.trim()) {
        errors.push(makeItem(node, "Scripted node has no script text. Add the message the agent should speak.", "error"));
      }
    }

    // 6. Junction: must have condition
    if (node.type === "standard" && node.data?.type === "junction") {
      const left = node.data?.left;
      const operator = node.data?.operator;
      if (!left?.field_name?.trim()) {
        errors.push(makeItem(node, "Junction node has no condition field. Specify which field to evaluate.", "error"));
      }
      if (!operator) {
        errors.push(makeItem(node, "Junction node has no operator. Choose how to compare the field value.", "error"));
      }
    }

    // 7. Switch: must have at least 2 cases
    if (node.type === "standard" && node.data?.type === "switch") {
      const cases = node.data?.cases;
      if (!cases || !Array.isArray(cases) || cases.length < 2) {
        errors.push(makeItem(node, "Switch node needs at least 2 cases to be useful. Add more options.", "error"));
      }
    }

    // 8. Call Transfer: must have transferTo
    if (node.type === "standard" && node.data?.type === "call_transfer") {
      if (!node.data?.transferTo?.trim()) {
        errors.push(makeItem(node, "Call Transfer node has no destination number. Specify where to transfer the call.", "error"));
      }
    }

    // 9. Orphan nodes (no incoming edges) - except agentSetup
    if (node.type !== "agentSetup" && incoming.length === 0) {
      errors.push(makeItem(node, "This node is disconnected — no edges lead to it. It will never be reached during a call.", "error"));
    }

    // --- Warnings ---

    // W1. Fallback with retryCount 0
    if (node.type === "standard" && node.data?.type === "fallback") {
      if (node.data?.retryCount === 0 || node.data?.retryCount === "0") {
        warnings.push(makeItem(node, "Fallback has 0 retries — it will escalate immediately without retrying.", "warning"));
      }
    }

    // W2. Time Limit too short
    if (node.type === "standard" && node.data?.type === "time_limit") {
      const duration = Number(node.data?.maxDuration);
      if (duration > 0 && duration < 10) {
        warnings.push(makeItem(node, `Time limit is very short (${duration}s). Most conversations need at least 10 seconds.`, "warning"));
      }
    }

    // W3. Outgoing edges to non-existent nodes (dangling)
    for (const edge of outgoing) {
      if (!nodeMap.has(edge.target)) {
        warnings.push(makeItem(node, `Has an edge pointing to a non-existent node (${edge.target}).`, "warning"));
      }
    }
  }

  // W4. Very long linear chain without branching
  // Walk from each call direction node and count sequential non-branching nodes
  for (const cdNode of callDirectionNodes) {
    let current = cdNode.id;
    let chainLength = 0;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const node = nodeMap.get(current);
      if (!node) break;
      const nodeType = node.data?.type;
      if (nodeType === "junction" || nodeType === "switch") break; // branching found
      chainLength++;
      const outs = outgoingEdges.get(current) || [];
      if (outs.length === 1) {
        current = outs[0].target;
      } else {
        break;
      }
    }
    if (chainLength > 8) {
      warnings.push({
        nodeId: cdNode.id,
        nodeLabel: cdNode.data?.label || "Call Direction",
        nodeType: cdNode.type,
        message: `Long linear chain (${chainLength} nodes) without any branching. Consider adding a junction or switch for better flow control.`,
        severity: "warning",
      });
    }
  }

  return { errors, warnings };
}
