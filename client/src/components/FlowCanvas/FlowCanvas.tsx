import { useState, useRef, useEffect, useCallback } from "react";
import { Node, Edge, Position } from "./types";
import "./FlowCanvas.css";

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  nodeComponents: Record<string, React.ComponentType<any>>;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeComponents,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{
    sourceId: string;
    sourceHandle: "left" | "right";
    position: { x: number; y: number };
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Handle node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest(".node-handle")) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setDraggedNode(nodeId);
    setDragOffset({
      x: (e.clientX - canvasRect.left) / scale - pan.x - node.position.x,
      y: (e.clientY - canvasRect.top) / scale - pan.y - node.position.y,
    });
  };

  // Handle node drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggedNode && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvasRect.left) / scale - pan.x - dragOffset.x;
        const y = (e.clientY - canvasRect.top) / scale - pan.y - dragOffset.y;

        onNodesChange(
          nodes.map((node) =>
            node.id === draggedNode
              ? { ...node, position: { x, y } }
              : node
          )
        );
      }

      if (connecting) {
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;

        setConnecting({
          ...connecting,
          position: {
            x: (e.clientX - canvasRect.left) / scale - pan.x,
            y: (e.clientY - canvasRect.top) / scale - pan.y,
          },
        });
      }

      if (isPanning && canvasRef.current) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPan({
          x: pan.x + dx / scale,
          y: pan.y + dy / scale,
        });
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [draggedNode, dragOffset, nodes, onNodesChange, connecting, isPanning, pan, panStart, scale]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (connecting) {
        const target = e.target as HTMLElement;
        const handle = target.closest(".node-handle");
        if (handle) {
          const nodeEl = handle.closest(".flow-node");
          if (nodeEl) {
            const targetNodeId = nodeEl.getAttribute("data-node-id");
            if (targetNodeId && targetNodeId !== connecting.sourceId) {
              onConnect(connecting.sourceId, targetNodeId);
            }
          }
        }
        setConnecting(null);
      }
      setDraggedNode(null);
      setIsPanning(false);
    },
    [connecting, onConnect]
  );

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Handle connection start
  const handleConnectionStart = (
    e: React.MouseEvent,
    nodeId: string,
    handle: "left" | "right"
  ) => {
    e.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    setConnecting({
      sourceId: nodeId,
      sourceHandle: handle,
      position: {
        x: (e.clientX - canvasRect.left) / scale - pan.x,
        y: (e.clientY - canvasRect.top) / scale - pan.y,
      },
    });
  };

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("flow-canvas-content")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 3));
  };

  // Get node position with handles
  const getNodeHandlePosition = (nodeId: string, handle: "left" | "right") => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const handleOffset = handle === "left" ? 0 : 200; // Assuming node width ~200px
    return {
      x: node.position.x + handleOffset,
      y: node.position.y + 50, // Middle of node height
    };
  };

  // Render edge path
  const renderEdge = (edge: Edge) => {
    const source = getNodeHandlePosition(edge.source, "right");
    const target = getNodeHandlePosition(edge.target, "left");

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const controlPointOffset = Math.abs(dx) / 2;

    const path = `M ${source.x},${source.y} C ${source.x + controlPointOffset},${source.y} ${target.x - controlPointOffset},${target.y} ${target.x},${target.y}`;

    return (
      <g key={edge.id}>
        <path
          d={path}
          fill="none"
          stroke="#b1b1b7"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
          className={edge.animated ? "edge-animated" : ""}
        />
      </g>
    );
  };

  // Render connecting line
  const renderConnectingLine = () => {
    if (!connecting) return null;

    const source = getNodeHandlePosition(connecting.sourceId, connecting.sourceHandle);
    const path = `M ${source.x},${source.y} L ${connecting.position.x},${connecting.position.y}`;

    return (
      <path
        d={path}
        fill="none"
        stroke="#555"
        strokeWidth="2"
        strokeDasharray="5,5"
      />
    );
  };

  return (
    <div
      ref={canvasRef}
      className="flow-canvas"
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
    >
      <div
        className="flow-canvas-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        {/* SVG for edges */}
        <svg className="flow-edges">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#b1b1b7" />
            </marker>
          </defs>
          {edges.map(renderEdge)}
          {renderConnectingLine()}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const NodeComponent = nodeComponents[node.type] || nodeComponents.default;
          return (
            <div
              key={node.id}
              className="flow-node"
              data-node-id={node.id}
              style={{
                position: "absolute",
                left: node.position.x,
                top: node.position.y,
                cursor: draggedNode === node.id ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            >
              {/* Left handle (input) */}
              {node.type !== "agentSetup" && (
                <div
                  className="node-handle node-handle-left"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                />
              )}

              {/* Node content */}
              <NodeComponent {...node} data={node.data} isConnectable={true} />

              {/* Right handle (output) */}
              <div
                className="node-handle node-handle-right"
                onMouseDown={(e) => handleConnectionStart(e, node.id, "right")}
              />
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flow-controls">
        <button onClick={() => setScale((s) => Math.min(s * 1.2, 3))}>+</button>
        <button onClick={() => setScale((s) => Math.max(s * 0.8, 0.1))}>-</button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>⊙</button>
      </div>
    </div>
  );
};
