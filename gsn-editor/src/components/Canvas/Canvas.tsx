import React, { useRef, useState, useEffect } from 'react';
import { useDiagramStore } from '../../stores/diagramStore';
import { Node } from './Node';
import { Link, ArrowMarker } from './Link';
import { ContextMenu } from './ContextMenu';
import { NodeEditor } from './NodeEditor';
import type { Node as NodeType } from '../../types/diagram';

export const Canvas: React.FC = () => {
  const {
    nodes,
    links,
    canvasState,
    addNode,
    moveNode,
    updateNode,
    setViewport,
    clearSelection,
    addLink,
    deleteNode,
    deleteLink,
    convertToModule,
    switchToModule,
  } = useDiagramStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // リサイズ関連
  const [isResizing, setIsResizing] = useState(false);
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 右クリックメニュー関連
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // リンク追加モード
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

  // ノード編集モーダル
  const [editingNode, setEditingNode] = useState<NodeType | null>(null);

  const { viewport, selectedNodeType, mode, selectedNodes } = canvasState;

  // ESCキーでリンクモードをキャンセル
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLinkSourceId(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // SVG座標系に変換
  const screenToSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return {
      x: (svgP.x - viewport.offsetX) / viewport.scale,
      y: (svgP.y - viewport.offsetY) / viewport.scale,
    };
  };

  // キャンバスクリック（ノード追加）
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && e.target !== e.currentTarget) return;

    if (mode === 'addNode' && selectedNodeType) {
      const coords = screenToSvgCoordinates(e.clientX, e.clientY);
      addNode(selectedNodeType, coords.x, coords.y);
    } else {
      clearSelection();
      setLinkSourceId(null); // リンクモードをキャンセル
    }
  };

  // ノード右クリック
  const handleNodeContextMenu = (nodeId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId,
    });
  };

  // ノードクリック
  const handleNodeClick = (nodeId: string, e?: React.MouseEvent) => {
    // リンク追加モード中の場合
    if (linkSourceId) {
      if (linkSourceId !== nodeId) {
        addLink(linkSourceId, nodeId, 'solid');
      }
      setLinkSourceId(null);
      return;
    }

    // 通常のクリック処理
    if (mode === 'select') {
      const store = useDiagramStore.getState();

      // Ctrl/Cmdキーが押されている場合は複数選択
      if (e && (e.ctrlKey || e.metaKey)) {
        if (selectedNodes.includes(nodeId)) {
          store.deselectNode(nodeId);
        } else {
          store.selectNode(nodeId);
        }
      } else {
        // 通常のクリックは単一選択（他の選択を解除）
        store.clearSelection();
        store.selectNode(nodeId);
      }
    } else if (mode === 'delete') {
      deleteNode(nodeId);
    }
  };

  // ノードドラッグ開始
  const handleNodeDragStart = (nodeId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    setIsDragging(true);
    const coords = screenToSvgCoordinates(e.clientX, e.clientY);
    setDragStart(coords);
  };

  // リサイズ開始
  const handleResizeStart = (nodeId: string, direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setIsResizing(true);
    setResizingNodeId(nodeId);
    setResizeDirection(direction);
    const coords = screenToSvgCoordinates(e.clientX, e.clientY);
    setResizeStart({
      x: coords.x,
      y: coords.y,
      width: node.size.width,
      height: node.size.height,
    });
  };

  // マウス移動
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging && draggedNodeId) {
      const coords = screenToSvgCoordinates(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === draggedNodeId);
      if (node) {
        const dx = coords.x - dragStart.x;
        const dy = coords.y - dragStart.y;

        // 複数選択されている場合は、選択されている全ノードを移動
        if (selectedNodes.includes(draggedNodeId) && selectedNodes.length > 1) {
          selectedNodes.forEach((nodeId) => {
            const n = nodes.find((node) => node.id === nodeId);
            if (n) {
              moveNode(nodeId, n.position.x + dx, n.position.y + dy);
            }
          });
        } else {
          // 単一ノードの移動
          moveNode(draggedNodeId, node.position.x + dx, node.position.y + dy);
        }
        setDragStart(coords);
      }
    } else if (isResizing && resizingNodeId && resizeDirection) {
      const coords = screenToSvgCoordinates(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === resizingNodeId);
      if (!node) return;

      const dx = coords.x - resizeStart.x;
      const dy = coords.y - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      // リサイズ方向に応じて計算
      switch (resizeDirection) {
        case 'se': // 右下
          newWidth = Math.max(80, resizeStart.width + dx * 2);
          newHeight = Math.max(60, resizeStart.height + dy * 2);
          break;
        case 'sw': // 左下
          newWidth = Math.max(80, resizeStart.width - dx * 2);
          newHeight = Math.max(60, resizeStart.height + dy * 2);
          break;
        case 'ne': // 右上
          newWidth = Math.max(80, resizeStart.width + dx * 2);
          newHeight = Math.max(60, resizeStart.height - dy * 2);
          break;
        case 'nw': // 左上
          newWidth = Math.max(80, resizeStart.width - dx * 2);
          newHeight = Math.max(60, resizeStart.height - dy * 2);
          break;
      }

      updateNode(resizingNodeId, {
        size: { width: newWidth, height: newHeight },
      });
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewport({ offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // マウスアップ
  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNodeId(null);
    setIsPanning(false);
    setIsResizing(false);
    setResizingNodeId(null);
    setResizeDirection(null);
  };

  // パン開始（中ボタン、Shift+左ボタン、または空白領域で左ボタン）
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // 中ボタンまたはShift+左ボタン
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 空白領域で左ボタン（選択モード以外、またはノード追加モードでない場合）
    if (e.button === 0 && e.target === svgRef.current && mode !== 'addNode') {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // ズーム & スクロール
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    // Ctrl/Cmd + ホイールでズーム
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.2, Math.min(3.0, viewport.scale + delta));
      setViewport({ scale: newScale });
    } else {
      // 通常のホイールでスクロール（パン）
      setViewport({
        offsetX: viewport.offsetX - e.deltaX,
        offsetY: viewport.offsetY - e.deltaY,
      });
    }
  };

  return (
    <>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          backgroundColor: '#FFFFFF',
          cursor: isPanning ? 'grabbing' : mode === 'addNode' ? 'crosshair' : linkSourceId ? 'crosshair' : 'default',
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <ArrowMarker />

        <g transform={`translate(${viewport.offsetX}, ${viewport.offsetY}) scale(${viewport.scale})`}>
          {/* リンクを先に描画 */}
          {links.map((link) => {
            const sourceNode = nodes.find((n) => n.id === link.source);
            const targetNode = nodes.find((n) => n.id === link.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <Link
                key={link.id}
                link={link}
                sourceNode={sourceNode}
                targetNode={targetNode}
                onClick={() => {
                  if (mode === 'delete') {
                    deleteLink(link.id);
                  }
                }}
              />
            );
          })}

          {/* ノードを描画 */}
          {nodes.map((node) => (
            <Node
              key={node.id}
              node={node}
              isSelected={selectedNodes.includes(node.id) || linkSourceId === node.id}
              onSelect={(e) => handleNodeClick(node.id, e)}
              onDoubleClick={() => {
                if (node.type === 'Module' && node.moduleId) {
                  switchToModule(node.moduleId);
                } else {
                  setEditingNode(node);
                }
              }}
              onDragStart={handleNodeDragStart(node.id)}
              onContextMenu={handleNodeContextMenu(node.id)}
              onResizeStart={(e, direction) => handleResizeStart(node.id, direction)(e)}
            />
          ))}
        </g>
      </svg>

      {/* 右クリックメニュー */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddLink={() => {
            setLinkSourceId(contextMenu.nodeId);
          }}
          onDelete={() => {
            deleteNode(contextMenu.nodeId);
          }}
          onConvertToModule={() => {
            convertToModule(contextMenu.nodeId);
          }}
          isGoalNode={nodes.find(n => n.id === contextMenu.nodeId)?.type === 'Goal'}
        />
      )}

      {/* リンク追加モード中のヘルプテキスト */}
      {linkSourceId && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 100,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          子ノードをクリックしてリンクを作成（ESCでキャンセル）
        </div>
      )}

      {/* ノード編集モーダル */}
      {editingNode && (
        <NodeEditor
          node={editingNode}
          onSave={(content) => {
            updateNode(editingNode.id, { content });
          }}
          onClose={() => setEditingNode(null)}
        />
      )}
    </>
  );
};
