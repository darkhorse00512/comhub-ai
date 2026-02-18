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

interface OutputHandle {
  id: string;
  label: string;
  color?: string; // CSS color for the handle dot
}

// Determine output handles for a node based on its type and data
function getNodeOutputHandles(node: Node): OutputHandle[] {
  const nodeType = node.data?.type || node.type;

  if (nodeType === "junction") {
    return [
      { id: "true", label: "True", color: "#22c55e" },
      { id: "false", label: "False", color: "#ef4444" },
    ];
  }

  if (nodeType === "switch") {
    const cases = node.data?.cases || [];
    if (cases.length > 0) {
      // Only show handles for the 3 visible buttons (node renders max 3)
      return cases.slice(0, 3).map((c: any, i: number) => ({
        id: `case-${i}`,
        label: c.label || c.value || `Case ${i + 1}`,
        color: "#ec4899",
      }));
    }
  }

  if (nodeType === "dialogue") {
    const transitions = node.data?.transitions || [];
    const handles: OutputHandle[] = [];
    if (transitions.length > 0) {
      handles.push(
        ...transitions.map((t: any) => ({
          id: t.id || `t-${t.name}`,
          label: t.name,
          color: "#22c55e",
        }))
      );
    } else {
      handles.push({ id: "default", label: "Next" });
    }
    // Always add a fallback handle for dialogue nodes
    handles.push({ id: "fallback", label: "Fallback", color: "#f97316" });
    return handles;
  }

  // Default: single output
  return [{ id: "default", label: "Next" }];
}

// Per-node-type button layout constants for precise handle positioning
function getButtonLayoutForNode(node: Node): {
  buttonHeight: number;
  buttonGap: number;
  bottomPad: number;
  hasBottomButtons: boolean;
  moreTextOffset: number;
} {
  const nodeType = node.data?.type || node.type;

  // AgentSetup and CallDirection have no bottom transition buttons
  if (nodeType === "agentSetup" || nodeType === "callDirection") {
    return { buttonHeight: 0, buttonGap: 0, bottomPad: 0, hasBottomButtons: false, moreTextOffset: 0 };
  }

  // DialogueNode: transitions + fallback button. py-1.5 (34px height), space-y-1.5 (6px gap)
  if (nodeType === "dialogue") {
    return { buttonHeight: 34, buttonGap: 6, bottomPad: 12, hasBottomButtons: true, moreTextOffset: 0 };
  }

  // SwitchNode: may have "+N more cases" text below the 3 visible buttons
  if (nodeType === "switch") {
    const totalCases = (node.data?.cases || []).length;
    // "+N more" text: text-xs (~16px) + space-y-2 gap (8px) = 24px extra
    const moreOffset = totalCases > 3 ? 24 : 0;
    return { buttonHeight: 38, buttonGap: 8, bottomPad: 12, hasBottomButtons: true, moreTextOffset: moreOffset };
  }

  // All others: standard py-2 buttons (38px), space-y-2 gap (8px), pb-3 (12px)
  return { buttonHeight: 38, buttonGap: 8, bottomPad: 12, hasBottomButtons: true, moreTextOffset: 0 };
}

export interface FlowCanvasRef {
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getScale: () => number;
  getPan: () => { x: number; y: number };
  panToNode: (nodeId: string) => void;
}

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onConnect: (sourceId: string, targetId: string, sourceHandle?: string) => void;
  nodeComponents: Record<string, React.ComponentType<any>>;
  errorNodeIds?: Set<string>;
}

export const FlowCanvas = forwardRef<FlowCanvasRef, FlowCanvasProps>(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeComponents,
  errorNodeIds,
}, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodeDimensions, setNodeDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{
    sourceId: string;
    sourceHandleId: string;
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

    const x = (screenX - canvasRect.left) / scale - pan.x;
    const y = (screenY - canvasRect.top) / scale - pan.y;
    return { x, y };
  }, [scale, pan]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    screenToCanvas,
    getScale: () => scale,
    getPan: () => pan,
    panToNode: (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const measured = nodeDimensions.get(nodeId);
      const nw = measured?.width ?? 250;
      const nh = measured?.height ?? 100;
      const targetX = centerX - (node.position.x + nw / 2) * scale;
      const targetY = centerY - (node.position.y + nh / 2) * scale;
      setPan({ x: targetX, y: targetY });
    },
  }), [screenToCanvas, scale, pan, nodes, nodeDimensions]);

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
    if (e.button === 1) return;

    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();

      if (selectedNodeIds.has(nodeId)) {
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
      } else {
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

    if (isPanLocked) return;

    const target = e.target as HTMLElement;

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

    setSelectedNodeIds(new Set());

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDraggedNode(nodeId);
    setDragOffset({
      x: canvasPos.x - node.position.x,
      y: canvasPos.y - node.position.y,
    });
  };

  // Handle mouse move
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
        setPan({
          x: panOffset.x + dx / scale,
          y: panOffset.y + dy / scale,
        });
      }

      if (isSelecting && selectionRect) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setSelectionRect({
          ...selectionRect,
          endX: canvasPos.x,
          endY: canvasPos.y,
        });
      }

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
      const nodeRight = node.position.x + dims.width;
      const nodeBottom = node.position.y + dims.height;
      if (nodeRight >= minX && node.position.x <= maxX && nodeBottom >= minY && node.position.y <= maxY) {
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
              onConnect(connecting.sourceId, targetNodeId, connecting.sourceHandleId);
            }
          }
        }
        setConnecting(null);
      }

      if (isSelecting && selectionRect) {
        const selected = getNodesInRect(selectionRect);
        setSelectedNodeIds(selected);
        setIsSelecting(false);
        setSelectionRect(null);
      }

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

  // Handle zoom with mouse wheel
  const handleWheelEvent = useCallback((e: WheelEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[role="dialog"]') || target.closest('[data-radix-portal]')) return;

    e.preventDefault();
    e.stopPropagation();

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 3);

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;
    const canvasX = mouseX / scale - pan.x;
    const canvasY = mouseY / scale - pan.y;
    const newPanX = mouseX / newScale - canvasX;
    const newPanY = mouseY / newScale - canvasY;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => { canvas.removeEventListener('wheel', handleWheelEvent); };
  }, [handleWheelEvent]);

  // Handle connection start from a specific output handle
  const handleConnectionStart = (
    e: React.MouseEvent,
    nodeId: string,
    handleId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    setConnecting({
      sourceId: nodeId,
      sourceHandleId: handleId,
      position: canvasPos,
    });
  };

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffset({ x: pan.x, y: pan.y });
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setIsSelecting(true);
      setSelectionRect({
        startX: canvasPos.x, startY: canvasPos.y,
        endX: canvasPos.x, endY: canvasPos.y,
      });
      setSelectedNodeIds(new Set());
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target === canvasRef.current ||
      target.classList.contains("flow-canvas-content") ||
      target.classList.contains("flow-edges") ||
      target.tagName === "svg"
    ) {
      e.preventDefault();
      setSelectedNodeIds(new Set());
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffset({ x: pan.x, y: pan.y });
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Get fallback node dimensions based on node type
  const getFallbackNodeDimensions = (nodeType: string) => {
    if (nodeType === "agentSetup") return { width: 300, height: 140 };
    if (nodeType === "callDirection") return { width: 200, height: 100 };
    if (nodeType === "standard") return { width: 300, height: 180 };
    return { width: 280, height: 200 };
  };

  // Get the canvas position of a specific output handle on a node
  const getOutputHandlePosition = (nodeId: string, handleId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const measured = nodeDimensions.get(nodeId);
    const dimensions = measured || getFallbackNodeDimensions(node.type);
    const layout = getButtonLayoutForNode(node);

    // For nodes without bottom buttons (agentSetup, callDirection), center vertically
    if (!layout.hasBottomButtons) {
      return {
        x: node.position.x + dimensions.width,
        y: node.position.y + dimensions.height / 2,
      };
    }

    const handles = getNodeOutputHandles(node);
    const handleIndex = handles.findIndex((h) => h.id === handleId);
    const idx = handleIndex >= 0 ? handleIndex : 0;
    const N = handles.length;

    // Position handle to align with the corresponding transition button
    // From bottom: bottomPad + moreTextOffset + (N-1-idx)*(btnH+gap) + btnH/2
    const yFromBottom = layout.bottomPad + layout.moreTextOffset +
      (N - 1 - idx) * (layout.buttonHeight + layout.buttonGap) +
      layout.buttonHeight / 2;

    return {
      x: node.position.x + dimensions.width,
      y: node.position.y + dimensions.height - yFromBottom,
    };
  };

  // Get input handle position (always left center)
  const getInputHandlePosition = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const measured = nodeDimensions.get(nodeId);
    const dimensions = measured || getFallbackNodeDimensions(node.type);

    return {
      x: node.position.x,
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

    const x1 = source.x, y1 = source.y;
    const x2 = source.x + controlPointOffset, y2 = source.y;
    const x3 = target.x - controlPointOffset, y3 = target.y;
    const x4 = target.x, y4 = target.y;

    const x = mt * mt * mt * x1 + 3 * mt * mt * t * x2 + 3 * mt * t * t * x3 + t * t * t * x4;
    const y = mt * mt * mt * y1 + 3 * mt * mt * t * y2 + 3 * mt * t * t * y3 + t * t * t * y4;

    return { x, y };
  };

  // Render edge path
  const renderEdge = (edge: Edge) => {
    // Source: use sourceHandle if specified, otherwise default output
    const sourceNode = nodes.find((n) => n.id === edge.source);
    let sourceHandleId = edge.sourceHandle || "default";
    if (sourceNode) {
      const handles = getNodeOutputHandles(sourceNode);
      // If the edge's sourceHandle doesn't match any handle, use the first one
      if (!handles.find((h) => h.id === sourceHandleId)) {
        sourceHandleId = handles[0]?.id || "default";
      }
    }

    const source = getOutputHandlePosition(edge.source, sourceHandleId);
    const target = getInputHandlePosition(edge.target);

    const dx = target.x - source.x;
    const controlPointOffset = Math.abs(dx) / 2;

    const path = `M ${source.x},${source.y} C ${source.x + controlPointOffset},${source.y} ${target.x - controlPointOffset},${target.y} ${target.x},${target.y}`;

    const isHovered = hoveredEdge === edge.id;
    const midpoint = getBezierMidpoint(source, target);

    return (
      <g key={edge.id}>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: "pointer", pointerEvents: "stroke" }}
          onMouseEnter={() => setHoveredEdge(edge.id)}
          onMouseLeave={() => setHoveredEdge(null)}
        />
        <path
          d={path}
          fill="none"
          stroke={isHovered ? "#ef4444" : "#b1b1b7"}
          strokeWidth={isHovered ? "3" : "2"}
          markerEnd={isHovered ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
          className={edge.animated ? "edge-animated" : ""}
          style={{ pointerEvents: "none", transition: "stroke 0.15s, stroke-width 0.15s" }}
        />
        {isHovered && (
          <g
            transform={`translate(${midpoint.x}, ${midpoint.y})`}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onClick={(e) => { e.stopPropagation(); handleDeleteEdge(edge.id); }}
            onMouseEnter={() => setHoveredEdge(edge.id)}
          >
            <circle r="12" fill="#ef4444" stroke="white" strokeWidth="2" />
            <line x1="-5" y1="-5" x2="5" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="5" y1="-5" x2="-5" y2="5" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
      </g>
    );
  };

  // Render connecting line
  const renderConnectingLine = () => {
    if (!connecting) return null;

    const source = getOutputHandlePosition(connecting.sourceId, connecting.sourceHandleId);
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

  // Render output handles for a node
  const renderOutputHandles = (node: Node, dimensions: { width: number; height: number }) => {
    const handles = getNodeOutputHandles(node);
    const layout = getButtonLayoutForNode(node);

    // For nodes without bottom buttons (agentSetup, callDirection), centered handle
    if (!layout.hasBottomButtons) {
      return (
        <div
          className="node-handle node-handle-right"
          style={{ top: "50%", transform: "translateY(-50%)" }}
          onMouseDown={(e) => handleConnectionStart(e, node.id, handles[0]?.id || "default")}
        />
      );
    }

    // Position each handle to align with its corresponding transition button
    const N = handles.length;

    return handles.map((handle, idx) => {
      const yFromBottom = layout.bottomPad + layout.moreTextOffset +
        (N - 1 - idx) * (layout.buttonHeight + layout.buttonGap) +
        layout.buttonHeight / 2;
      const yOffset = dimensions.height - yFromBottom;

      return (
        <div
          key={handle.id}
          className="node-handle node-handle-right"
          data-handle-id={handle.id}
          style={{
            top: yOffset,
            transform: "translateY(-50%)",
            background: handle.color || "#7c3aed",
          }}
          onMouseDown={(e) => handleConnectionStart(e, node.id, handle.id)}
        />
      );
    });
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
        {/* SVG for edges */}
        <svg className="flow-edges" style={{ overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#b1b1b7" />
            </marker>
            <marker id="arrowhead-hover" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
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
          const isError = errorNodeIds?.has(node.id) ?? false;
          const measured = nodeDimensions.get(node.id);
          const dimensions = measured || getFallbackNodeDimensions(node.type);

          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) { nodeRefs.current.set(node.id, el); }
                else { nodeRefs.current.delete(node.id); }
              }}
              className={`flow-node${isSelected ? " flow-node-selected" : ""}${isError ? " flow-node-error" : ""}`}
              data-node-id={node.id}
              style={{
                position: "absolute",
                left: node.position.x,
                top: node.position.y,
                cursor: isPanLocked ? "default" : (draggedNode === node.id || (isDraggingSelected && isSelected) ? "grabbing" : "grab"),
                zIndex: draggedNode === node.id || (isDraggingSelected && isSelected) ? 1000 : isSelected ? 2 : 1,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            >
              {/* Left handle (input) */}
              {node.type !== "agentSetup" && (
                <div
                  className="node-handle node-handle-left"
                  onMouseDown={(e) => { e.stopPropagation(); }}
                />
              )}

              {/* Node content */}
              <NodeComponent {...node} data={node.data} isConnectable={true} />

              {/* Right handles (output) - multiple for junction/switch/dialogue */}
              {renderOutputHandles(node, dimensions)}
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
        <button onClick={() => setScale((s) => Math.min(s * 1.2, 3))} title="Zoom In">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => setScale((s) => Math.max(s * 0.8, 0.1))} title="Zoom Out">
          <Minus className="w-4 h-4" />
        </button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} title="Reset View">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={() => setIsPanLocked(!isPanLocked)} title={isPanLocked ? "Unlock Panning" : "Lock Panning"} className={isPanLocked ? "active" : ""}>
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
