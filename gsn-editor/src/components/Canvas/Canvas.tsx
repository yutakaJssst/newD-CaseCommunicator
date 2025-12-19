import React, { useRef, useState, useEffect } from 'react';
import { useDiagramStore } from '../../stores/diagramStore';
import { useAuthStore } from '../../stores/authStore';
import { Node } from './Node';
import { Link, ArrowMarker } from './Link';
import { ContextMenu } from './ContextMenu';
import { NodeEditor } from './NodeEditor';
import { CommentPopover } from './CommentPopover';
import { SavePatternModal } from './SavePatternModal';
import { PatternLibrary } from '../Sidebar/PatternLibrary';
import type { Node as NodeType, Link as LinkType } from '../../types/diagram';
import { GRID_SIZE } from '../../types/diagram';
import { patternsApi } from '../../api/patterns';
import type { PatternData } from '../../api/patterns';

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
    selectAll,
    deleteSelectedNodes,
    moveSelectedNodes,
    copySelectedNodes,
    copyNodeTree,
    pasteNodes,
    addLink,
    deleteNode,
    deleteLink,
    convertToModule,
    switchToModule,
    switchToParent,
    currentDiagramId,
    modules,
    addComment,
    deleteComment,
    showPatternLibrary,
    setShowPatternLibrary,
    addNodeDirect,
    addLinkDirect,
    generateLabel,
  } = useDiagramStore();

  const { user } = useAuthStore();

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

  // 右クリックメニュー関連（ノード用）
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // 右クリックメニュー関連（リンク用）
  const [linkContextMenu, setLinkContextMenu] = useState<{
    x: number;
    y: number;
    linkId: string;
  } | null>(null);

  // リンク追加モード
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);

  // ノード編集モーダル
  const [editingNode, setEditingNode] = useState<NodeType | null>(null);

  // コメントポップオーバー
  const [commentPopover, setCommentPopover] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  // パターン関連
  const [showSavePatternModal, setShowSavePatternModal] = useState(false);
  const [patternNodes, setPatternNodes] = useState<NodeType[]>([]);
  const [patternLinks, setPatternLinks] = useState<LinkType[]>([]);

  const { viewport, selectedNodeType, mode, selectedNodes, gridSnapEnabled } = canvasState;

  // グリッドスナップ関数
  const snapToGrid = (value: number): number => {
    if (!gridSnapEnabled) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ノード編集中またはコメントポップオーバー表示中は無効化
      if (editingNode || commentPopover) return;

      // ESC: リンクモードをキャンセル
      if (e.key === 'Escape') {
        setLinkSourceId(null);
        clearSelection();
        return;
      }

      // Delete: 選択ノードを削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedNodes();
        return;
      }

      // Ctrl+A: 全選択
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Ctrl+C: コピー
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelectedNodes();
        return;
      }

      // Ctrl+V: ペースト
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteNodes();
        return;
      }

      // 矢印キー: 選択ノードを移動
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const moveDistance = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;

        if (e.key === 'ArrowUp') dy = -moveDistance;
        if (e.key === 'ArrowDown') dy = moveDistance;
        if (e.key === 'ArrowLeft') dx = -moveDistance;
        if (e.key === 'ArrowRight') dx = moveDistance;

        moveSelectedNodes(dx, dy);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingNode, commentPopover, deleteSelectedNodes, selectAll, clearSelection, moveSelectedNodes, copySelectedNodes, pasteNodes]);

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

    // メニューを閉じる
    setContextMenu(null);
    setLinkContextMenu(null);

    if (mode === 'addNode' && selectedNodeType) {
      const coords = screenToSvgCoordinates(e.clientX, e.clientY);
      const snappedX = snapToGrid(coords.x);
      const snappedY = snapToGrid(coords.y);
      addNode(selectedNodeType, snappedX, snappedY);
    } else {
      clearSelection();
      setLinkSourceId(null); // リンクモードをキャンセル
    }
  };

  // コメントアイコンクリック
  const handleCommentClick = (nodeId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentPopover({
      nodeId,
      x: e.clientX,
      y: e.clientY,
    });
    setContextMenu(null);
    setLinkContextMenu(null);
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
    setLinkContextMenu(null); // リンクメニューを閉じる
    setCommentPopover(null); // コメントポップオーバーを閉じる
  };

  // リンク右クリック
  const handleLinkContextMenu = (linkId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLinkContextMenu({
      x: e.clientX,
      y: e.clientY,
      linkId,
    });
    setContextMenu(null); // ノードメニューを閉じる
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
              const newX = snapToGrid(n.position.x + dx);
              const newY = snapToGrid(n.position.y + dy);
              moveNode(nodeId, newX, newY);
            }
          });
        } else {
          // 単一ノードの移動
          const newX = snapToGrid(node.position.x + dx);
          const newY = snapToGrid(node.position.y + dy);
          moveNode(draggedNodeId, newX, newY);
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

  // ノードがトップゴール（親を持たないGoal）かどうかを判定
  const isTopGoal = (nodeId: string): boolean => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'Goal') return false;

    // このノードがどのリンクのターゲットにもなっていない = トップゴール
    const hasParent = links.some(link => link.target === nodeId);
    return !hasParent;
  };

  // 現在のダイアグラムに親モジュールがあるかどうか
  const hasParentModule = (() => {
    if (currentDiagramId === 'root') return false;

    // modulesに保存されているメタデータをチェック
    const savedMetadata = modules[currentDiagramId]?.metadata?.parentModuleId;
    if (savedMetadata) return true;

    // 保存されていない場合でも、rootでなければ親がいる可能性がある
    // （モジュール作成直後など）
    return currentDiagramId !== 'root';
  })();

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
          {/* グリッド表示 */}
          {gridSnapEnabled && (
            <g opacity="0.15">
              {Array.from({ length: 200 }, (_, i) => i - 100).map((i) => (
                <React.Fragment key={`grid-${i}`}>
                  <line
                    x1={i * GRID_SIZE}
                    y1={-100 * GRID_SIZE}
                    x2={i * GRID_SIZE}
                    y2={100 * GRID_SIZE}
                    stroke="#9CA3AF"
                    strokeWidth={1 / viewport.scale}
                  />
                  <line
                    x1={-100 * GRID_SIZE}
                    y1={i * GRID_SIZE}
                    x2={100 * GRID_SIZE}
                    y2={i * GRID_SIZE}
                    stroke="#9CA3AF"
                    strokeWidth={1 / viewport.scale}
                  />
                </React.Fragment>
              ))}
            </g>
          )}

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
                onContextMenu={handleLinkContextMenu(link.id)}
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
              onCommentClick={handleCommentClick(node.id)}
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
          onCopyTree={() => {
            copyNodeTree(contextMenu.nodeId);
          }}
          onDelete={() => {
            deleteNode(contextMenu.nodeId);
          }}
          onConvertToModule={() => {
            convertToModule(contextMenu.nodeId);
          }}
          onOpenParentModule={
            hasParentModule && isTopGoal(contextMenu.nodeId)
              ? () => switchToParent()
              : undefined
          }
          onSaveAsPattern={() => {
            // 右クリックしたノードからサブツリー全体を取得
            const getSubtree = (rootId: string): { nodes: NodeType[], links: LinkType[] } => {
              const subtreeNodes: NodeType[] = [];
              const subtreeLinks: LinkType[] = [];
              const visited = new Set<string>();

              const traverse = (nodeId: string) => {
                if (visited.has(nodeId)) return;
                visited.add(nodeId);

                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                  subtreeNodes.push(node);

                  // このノードから出るリンク（子ノードへのリンク）を探す
                  const childLinks = links.filter(l => l.source === nodeId);
                  childLinks.forEach(link => {
                    subtreeLinks.push(link);
                    traverse(link.target);
                  });
                }
              };

              traverse(rootId);
              return { nodes: subtreeNodes, links: subtreeLinks };
            };

            // 右クリックしたノードをルートとしてサブツリーを取得
            const subtree = getSubtree(contextMenu.nodeId);
            setPatternNodes(subtree.nodes);
            setPatternLinks(subtree.links);
            setShowSavePatternModal(true);
          }}
          isGoalNode={nodes.find(n => n.id === contextMenu.nodeId)?.type === 'Goal'}
          isTopGoal={isTopGoal(contextMenu.nodeId) && hasParentModule}
          hasSelection={true}
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

      {/* リンク右クリックメニュー */}
      {linkContextMenu && (
        <div
          style={{
            position: 'fixed',
            left: linkContextMenu.x,
            top: linkContextMenu.y,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            minWidth: '160px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              deleteLink(linkContextMenu.linkId);
              setLinkContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#EF4444',
              fontWeight: '500',
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            リンクを削除
          </button>
        </div>
      )}

      {/* ノード編集モーダル */}
      {editingNode && (
        <NodeEditor
          node={editingNode}
          onSave={(content, label) => {
            updateNode(editingNode.id, { content, label });
          }}
          onClose={() => setEditingNode(null)}
        />
      )}

      {/* コメントポップオーバー */}
      {commentPopover && user && (() => {
        const node = nodes.find(n => n.id === commentPopover.nodeId);
        if (!node) return null;

        const userName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email.split('@')[0];

        return (
          <CommentPopover
            nodeId={node.id}
            nodeLabel={node.label || node.type}
            comments={node.comments || []}
            position={{ x: commentPopover.x, y: commentPopover.y }}
            currentUserId={user.id}
            currentUserName={userName}
            onAddComment={(nodeId, content) => {
              addComment(nodeId, user.id, userName, content);
            }}
            onDeleteComment={(nodeId, commentId) => {
              deleteComment(nodeId, commentId);
            }}
            onClose={() => setCommentPopover(null)}
          />
        );
      })()}

      {/* パターン保存モーダル */}
      {showSavePatternModal && (
        <SavePatternModal
          nodes={patternNodes}
          links={patternLinks}
          onSave={async (name, description, isPublic) => {
            try {
              // ノードの位置を相対座標に変換
              const minX = Math.min(...patternNodes.map(n => n.position.x));
              const minY = Math.min(...patternNodes.map(n => n.position.y));
              const relativeNodes = patternNodes.map(n => ({
                ...n,
                position: {
                  x: n.position.x - minX,
                  y: n.position.y - minY,
                },
              }));

              await patternsApi.create({
                name,
                description,
                data: {
                  nodes: relativeNodes,
                  links: patternLinks,
                },
                isPublic,
              });
              setShowSavePatternModal(false);
              setPatternNodes([]);
              setPatternLinks([]);
            } catch (error) {
              console.error('パターン保存エラー:', error);
              alert('パターンの保存に失敗しました');
            }
          }}
          onClose={() => {
            setShowSavePatternModal(false);
            setPatternNodes([]);
            setPatternLinks([]);
          }}
        />
      )}

      {/* パターンライブラリ */}
      {showPatternLibrary && (
        <PatternLibrary
          onApplyPattern={(patternData: PatternData) => {
            // 既存ノードの境界ボックスを計算
            let offsetX = 100;
            let offsetY = 100;

            if (nodes.length > 0) {
              // 既存ノードの右端を計算
              const existingMaxX = Math.max(...nodes.map(n => n.position.x + n.size.width));
              const existingMinY = Math.min(...nodes.map(n => n.position.y));

              // 既存ノードの右側に配置（50pxの間隔）
              offsetX = existingMaxX + 50;
              offsetY = existingMinY;
            }

            // 新しいIDを生成してノードをコピー
            const idMap: Record<string, string> = {};
            const newNodes: NodeType[] = patternData.nodes.map((node: NodeType) => {
              const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              idMap[node.id] = newId;

              // 新しいラベルを生成
              const newLabel = generateLabel(node.type);

              return {
                ...node,
                id: newId,
                label: newLabel,
                position: {
                  x: node.position.x + offsetX,
                  y: node.position.y + offsetY,
                },
              };
            });

            // リンクのIDを新しいIDに置き換え
            const newLinks: LinkType[] = patternData.links.map((link: LinkType) => ({
              ...link,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: idMap[link.source] || link.source,
              target: idMap[link.target] || link.target,
            }));

            // ストアに追加
            newNodes.forEach(node => {
              addNodeDirect(node);
            });
            newLinks.forEach(link => {
              addLinkDirect(link);
            });

            setShowPatternLibrary(false);
          }}
          onClose={() => setShowPatternLibrary(false)}
        />
      )}
    </>
  );
};
