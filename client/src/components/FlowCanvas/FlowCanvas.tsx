import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Plus, Minus, RotateCcw, Lock, Unlock } from "lucide-react";
import { Node, Edge } from "./types";
import "./FlowCanvas.css";

// Mouse hint SVG icons for the action hints panel
const MouseLeftIcon = () => (
  <svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="24" rx="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="10" y1="1" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="2" width="8" height="10" rx="4" fill="currentColor" opacity="0.25" />
  </svg>
);

const MouseRightIcon = () => (
  <svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="24" rx="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="10" y1="1" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <rect x="10" y="2" width="8" height="10" rx="4" fill="currentColor" opacity="0.25" />
  </svg>
);

const MouseScrollIcon = () => (
  <svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="24" rx="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="10" y1="1" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7.5" y="3.5" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.25" />
  </svg>
);

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

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isDraggingSelected, setIsDraggingSelected] = useState(false);
  const [dragSelectedStart, setDragSelectedStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragSelectedNodePositions, setDragSelectedNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

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
    // Middle-click on a node = start panning (bubble to canvas handler)
    if (e.button === 1) {
      return;
    }

    // Right-click on a node = select it or start dragging selected nodes
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();

      if (selectedNodeIds.has(nodeId)) {
        // Node is already selected - start dragging all selected nodes
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setIsDraggingSelected(true);
        setDragSelectedStart(canvasPos);
        // Store current positions of all selected nodes
        const positions = new Map<string, { x: number; y: number }>();
        nodes.forEach((n) => {
          if (selectedNodeIds.has(n.id)) {
            positions.set(n.id, { ...n.position });
          }
        });
        setDragSelectedNodePositions(positions);
      } else {
        // Node is not selected - select just this node (and start dragging it)
        const newSelection = new Set<string>([nodeId]);
        setSelectedNodeIds(newSelection);
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setIsDraggingSelected(true);
        setDragSelectedStart(canvasPos);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          const positions = new Map<string, { x: number; y: number }>();
          positions.set(nodeId, { ...node.position });
          setDragSelectedNodePositions(positions);
        }
      }
      return;
    }

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

    // Left-click on a selected node = drag all selected nodes together
    if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 0) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setIsDraggingSelected(true);
      setDragSelectedStart(canvasPos);
      const positions = new Map<string, { x: number; y: number }>();
      nodes.forEach((n) => {
        if (selectedNodeIds.has(n.id)) {
          positions.set(n.id, { ...n.position });
        }
      });
      setDragSelectedNodePositions(positions);
      return;
    }

    // Left-click on an unselected node = clear selection, drag single node
    setSelectedNodeIds(new Set());

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

      // Drawing selection rectangle
      if (isSelecting && selectionRect) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setSelectionRect({
          ...selectionRect,
          endX: canvasPos.x,
          endY: canvasPos.y,
        });
      }

      // Dragging selected nodes
      if (isDraggingSelected) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const dx = canvasPos.x - dragSelectedStart.x;
        const dy = canvasPos.y - dragSelectedStart.y;

        onNodesChange(
          nodes.map((node) => {
            const origPos = dragSelectedNodePositions.get(node.id);
            if (origPos) {
              return { ...node, position: { x: origPos.x + dx, y: origPos.y + dy } };
            }
            return node;
          })
        );
      }
    },
    [draggedNode, dragOffset, nodes, onNodesChange, connecting, isPanning, panStart, panOffset, scale, screenToCanvas, isSelecting, selectionRect, isDraggingSelected, dragSelectedStart, dragSelectedNodePositions]
  );

  // Compute which nodes fall inside the selection rectangle
  const getNodesInRect = useCallback((rect: { startX: number; startY: number; endX: number; endY: number }) => {
    const minX = Math.min(rect.startX, rect.endX);
    const maxX = Math.max(rect.startX, rect.endX);
    const minY = Math.min(rect.startY, rect.endY);
    const maxY = Math.max(rect.startY, rect.endY);

    const selected = new Set<string>();
    nodes.forEach((node) => {
      const dims = nodeDimensions.get(node.id) || getFallbackNodeDimensions(node.type);
      const nodeLeft = node.position.x;
      const nodeTop = node.position.y;
      const nodeRight = node.position.x + dims.width;
      const nodeBottom = node.position.y + dims.height;

      // Select if rectangle overlaps the node (intersection, not full containment)
      if (nodeRight >= minX && nodeLeft <= maxX && nodeBottom >= minY && nodeTop <= maxY) {
        selected.add(node.id);
      }
    });
    return selected;
  }, [nodes, nodeDimensions]);

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

      // Finalize selection rectangle
      if (isSelecting && selectionRect) {
        const selected = getNodesInRect(selectionRect);
        setSelectedNodeIds(selected);
        setIsSelecting(false);
        setSelectionRect(null);
      }

      // Stop dragging selected nodes
      if (isDraggingSelected) {
        setIsDraggingSelected(false);
      }

      setDraggedNode(null);
      setIsPanning(false);
    },
    [connecting, onConnect, isSelecting, selectionRect, getNodesInRect, isDraggingSelected]
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
    // Don't zoom if a dialog/modal is open over the canvas
    const target = e.target as HTMLElement;
    if (target.closest('[role="dialog"]') || target.closest('[data-radix-portal]')) {
      return;
    }

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

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle-click (button 1) = pan from anywhere
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffset({ x: pan.x, y: pan.y });
      return;
    }

    // Right-click (button 2) on canvas background = start selection rectangle
    if (e.button === 2) {
      e.preventDefault();
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setIsSelecting(true);
      setSelectionRect({
        startX: canvasPos.x,
        startY: canvasPos.y,
        endX: canvasPos.x,
        endY: canvasPos.y,
      });
      // Clear previous selection when starting a new rectangle
      setSelectedNodeIds(new Set());
      return;
    }

    // Left-click on canvas background = pan + clear selection
    const target = e.target as HTMLElement;
    if (
      target === canvasRef.current ||
      target.classList.contains("flow-canvas-content") ||
      target.classList.contains("flow-edges") ||
      target.tagName === "svg"
    ) {
      e.preventDefault();
      // Clear selection on left-click on canvas background
      setSelectedNodeIds(new Set());
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffset({ x: pan.x, y: pan.y });
    }
  };

  // Prevent context menu on canvas so right-click can be used for selection
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);


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
      onContextMenu={handleContextMenu}
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
          const isSelected = selectedNodeIds.has(node.id);
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
              className={`flow-node${isSelected ? " flow-node-selected" : ""}`}
              data-node-id={node.id}
              style={{
                position: "absolute",
                left: node.position.x,
                top: node.position.y,
                cursor: isPanLocked ? "default" : (draggedNode === node.id || isDraggingSelected && isSelected ? "grabbing" : "grab"),
                zIndex: draggedNode === node.id || (isDraggingSelected && isSelected) ? 1000 : isSelected ? 2 : 1,
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

        {/* Selection rectangle */}
        {isSelecting && selectionRect && (
          <div
            className="flow-selection-rect"
            style={{
              position: "absolute",
              left: Math.min(selectionRect.startX, selectionRect.endX),
              top: Math.min(selectionRect.startY, selectionRect.endY),
              width: Math.abs(selectionRect.endX - selectionRect.startX),
              height: Math.abs(selectionRect.endY - selectionRect.startY),
            }}
          />
        )}
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

      {/* Mouse Action Hints */}
      <div className="flow-action-hints">
        <div className="flow-action-hint">
          <span className="flow-action-hint-icon"><MouseLeftIcon /></span>
          <span className="flow-action-hint-label">Pan</span>
        </div>
        <div className="flow-action-hint-divider" />
        <div className="flow-action-hint">
          <span className="flow-action-hint-icon"><MouseRightIcon /></span>
          <span className="flow-action-hint-label">Select</span>
        </div>
        <div className="flow-action-hint-divider" />
        <div className="flow-action-hint">
          <span className="flow-action-hint-icon"><MouseScrollIcon /></span>
          <span className="flow-action-hint-label">Zoom</span>
        </div>
      </div>
    </div>
  );
});

FlowCanvas.displayName = "FlowCanvas";
