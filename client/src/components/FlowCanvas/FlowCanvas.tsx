import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Plus, Minus, RotateCcw, Lock, Unlock } from "lucide-react";
import { Node, Edge } from "./types";
import "./FlowCanvas.css";

export interface FlowCanvasRef {
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getScale: () => number;
  getPan: () => { x: number; y: number };
}

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  nodeComponents: Record<string, React.ComponentType<any>>;
}

export const FlowCanvas = forwardRef<FlowCanvasRef, FlowCanvasProps>(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeComponents,
}, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodeDimensions, setNodeDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
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
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [isPanLocked, setIsPanLocked] = useState(false);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return { x: 0, y: 0 };

    // Transform is: scale(scale) translate(pan.x, pan.y)
    // So: screenPos = (canvasPos + pan) * scale
    // Therefore: canvasPos = screenPos / scale - pan
    const x = (screenX - canvasRect.left) / scale - pan.x;
    const y = (screenY - canvasRect.top) / scale - pan.y;
    return { x, y };
  }, [scale, pan]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    screenToCanvas,
    getScale: () => scale,
    getPan: () => pan,
  }), [screenToCanvas, scale, pan]);

  // Measure node dimensions after render
  useEffect(() => {
    requestAnimationFrame(() => {
      const newDimensions = new Map<string, { width: number; height: number }>();
      nodeRefs.current.forEach((el, nodeId) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          newDimensions.set(nodeId, {
            width: rect.width / scale,
            height: rect.height / scale
          });
        }
      });
      setNodeDimensions(newDimensions);
    });
  }, [nodes, scale]);

  // Handle node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    // Don't allow node dragging when pan is locked
    if (isPanLocked) return;

    const target = e.target as HTMLElement;

    // Don't start drag if clicking on interactive elements
    if (target.closest(".node-handle")) return;
    if (target.closest("button")) return;
    if (target.closest("input")) return;
    if (target.closest("textarea")) return;
    if (target.closest("a")) return;
    if (target.closest("[role='button']")) return;
    if (target.closest("select")) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    e.preventDefault();
    e.stopPropagation();

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    setDraggedNode(nodeId);
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y,
    });
  };

  // Handle node drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggedNode) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const x = canvasPos.x - dragOffset.x;
        const y = canvasPos.y - dragOffset.y;

        onNodesChange(
          nodes.map((node) =>
            node.id === draggedNode
              ? { ...node, position: { x, y } }
              : node
          )
        );
      }

      if (connecting) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setConnecting({
          ...connecting,
          position: canvasPos,
        });
      }

      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;

        // Pan is in canvas coordinates (before scale is applied)
        setPan({
          x: panOffset.x + dx / scale,
          y: panOffset.y + dy / scale,
        });
      }
    },
    [draggedNode, dragOffset, nodes, onNodesChange, connecting, isPanning, panStart, panOffset, scale, screenToCanvas]
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

  // Handle zoom with mouse wheel - use passive: false to prevent browser zoom
  const handleWheelEvent = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 3);

    // Mouse position relative to canvas container
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    // Current canvas position under mouse (before zoom)
    const canvasX = mouseX / scale - pan.x;
    const canvasY = mouseY / scale - pan.y;

    // New pan to keep the same canvas point under mouse
    const newPanX = mouseX / newScale - canvasX;
    const newPanY = mouseY / newScale - canvasY;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan]);

  // Attach wheel event listener with passive: false for proper preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [handleWheelEvent]);

  // Handle connection start
  const handleConnectionStart = (
    e: React.MouseEvent,
    nodeId: string,
    handle: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    setConnecting({
      sourceId: nodeId,
      sourceHandle: handle,
      position: canvasPos,
    });
  };

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only start panning if clicking on the canvas background or SVG
    if (
      target === canvasRef.current ||
      target.classList.contains("flow-canvas-content") ||
      target.classList.contains("flow-edges") ||
      target.tagName === "svg"
    ) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffset({ x: pan.x, y: pan.y });
    }
  };


  // Get fallback node dimensions based on node type
  const getFallbackNodeDimensions = (nodeType: string) => {
    if (nodeType === "agentSetup") {
      return { width: 300, height: 140 };
    }
    if (nodeType === "callDirection") {
      return { width: 200, height: 100 };
    }
    // Standard nodes have a larger size with the new design
    if (nodeType === "standard") {
      return { width: 300, height: 180 };
    }
    return { width: 280, height: 160 };
  };

  // Get node position with handles
  const getNodeHandlePosition = (nodeId: string, handle: "left" | "right") => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const measured = nodeDimensions.get(nodeId);
    const dimensions = measured || getFallbackNodeDimensions(node.type);
    const handleOffsetX = handle === "left" ? 0 : dimensions.width;

    return {
      x: node.position.x + handleOffsetX,
      y: node.position.y + dimensions.height / 2,
    };
  };

  // Delete an edge
  const handleDeleteEdge = (edgeId: string) => {
    onEdgesChange(edges.filter((e) => e.id !== edgeId));
  };

  // Get the midpoint of a bezier curve
  const getBezierMidpoint = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const dx = target.x - source.x;
    const controlPointOffset = Math.abs(dx) / 2;

    const t = 0.5;
    const mt = 1 - t;

    const x1 = source.x;
    const y1 = source.y;
    const x2 = source.x + controlPointOffset;
    const y2 = source.y;
    const x3 = target.x - controlPointOffset;
    const y3 = target.y;
    const x4 = target.x;
    const y4 = target.y;

    const x = mt * mt * mt * x1 + 3 * mt * mt * t * x2 + 3 * mt * t * t * x3 + t * t * t * x4;
    const y = mt * mt * mt * y1 + 3 * mt * mt * t * y2 + 3 * mt * t * t * y3 + t * t * t * y4;

    return { x, y };
  };

  // Render edge path with hover detection and delete button
  const renderEdge = (edge: Edge) => {
    const source = getNodeHandlePosition(edge.source, "right");
    const target = getNodeHandlePosition(edge.target, "left");

    const dx = target.x - source.x;
    const controlPointOffset = Math.abs(dx) / 2;

    const path = `M ${source.x},${source.y} C ${source.x + controlPointOffset},${source.y} ${target.x - controlPointOffset},${target.y} ${target.x},${target.y}`;

    const isHovered = hoveredEdge === edge.id;
    const midpoint = getBezierMidpoint(source, target);

    return (
      <g key={edge.id}>
        {/* Invisible wider path for easier hover detection */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: "pointer", pointerEvents: "stroke" }}
          onMouseEnter={() => setHoveredEdge(edge.id)}
          onMouseLeave={() => setHoveredEdge(null)}
        />
        {/* Visible edge path */}
        <path
          d={path}
          fill="none"
          stroke={isHovered ? "#ef4444" : "#b1b1b7"}
          strokeWidth={isHovered ? "3" : "2"}
          markerEnd={isHovered ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
          className={edge.animated ? "edge-animated" : ""}
          style={{ pointerEvents: "none", transition: "stroke 0.15s, stroke-width 0.15s" }}
        />
        {/* Delete button at midpoint */}
        {isHovered && (
          <g
            transform={`translate(${midpoint.x}, ${midpoint.y})`}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteEdge(edge.id);
            }}
            onMouseEnter={() => setHoveredEdge(edge.id)}
          >
            <circle
              r="12"
              fill="#ef4444"
              stroke="white"
              strokeWidth="2"
            />
            <line
              x1="-5"
              y1="-5"
              x2="5"
              y2="5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="5"
              y1="-5"
              x2="-5"
              y2="5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}
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
        style={{ pointerEvents: "none" }}
      />
    );
  };

  return (
    <div
      ref={canvasRef}
      className="flow-canvas"
      onMouseDown={handleCanvasMouseDown}
    >
      <div
        className="flow-canvas-content"
        style={{
          transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG for edges - rendered first so nodes appear on top */}
        <svg className="flow-edges" style={{ overflow: "visible", pointerEvents: "none" }}>
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
            <marker
              id="arrowhead-hover"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
            </marker>
          </defs>
          <g style={{ pointerEvents: "auto" }}>
            {edges.map(renderEdge)}
          </g>
          {renderConnectingLine()}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const NodeComponent = nodeComponents[node.type] || nodeComponents.default;
          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) {
                  nodeRefs.current.set(node.id, el);
                } else {
                  nodeRefs.current.delete(node.id);
                }
              }}
              className="flow-node"
              data-node-id={node.id}
              style={{
                position: "absolute",
                left: node.position.x,
                top: node.position.y,
                cursor: isPanLocked ? "default" : (draggedNode === node.id ? "grabbing" : "grab"),
                zIndex: draggedNode === node.id ? 1000 : 1,
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
        <button
          onClick={() => setScale((s) => Math.min(s * 1.2, 3))}
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.8, 0.1))}
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsPanLocked(!isPanLocked)}
          title={isPanLocked ? "Unlock Panning" : "Lock Panning"}
          className={isPanLocked ? "active" : ""}
        >
          {isPanLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

FlowCanvas.displayName = "FlowCanvas";
