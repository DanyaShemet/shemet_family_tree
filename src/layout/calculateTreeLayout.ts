import type { FamilyTreeData, PositionedNode, Edge } from '../types/family';

const NODE_W = 160;
const NODE_H = 70;
const UNION_W = 24;
const UNION_H = 24;
const H_GAP = 40;
const V_GAP = 100;
const PARTNER_GAP = 20;

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: Edge[];
  width: number;
  height: number;
}

// One union that an anchor person participates in.
// Layout (left-to-right after the anchor):
//   [GAP][union node][GAP][partner]...
//              |
//        [children of this union]
interface UnionSlot {
  unionId: string;
  otherPartnerIds: string[];
  childSubTrees: SubTree[];
  // Width of the slot (set by computeWidth, reused in assignPositions)
  slotWidth: number;
}

interface SubTree {
  anchorPersonId: string;
  unions: UnionSlot[];
  x: number;
  width: number;
}

export function calculateTreeLayout(data: FamilyTreeData): LayoutResult {
  const nodes: PositionedNode[] = [];
  const edges: Edge[] = [];

  const personUnions: Record<string, string[]> = {};
  for (const union of Object.values(data.unions)) {
    for (const partnerId of union.partners) {
      if (!personUnions[partnerId]) personUnions[partnerId] = [];
      personUnions[partnerId].push(union.id);
    }
  }

  const visited = new Set<string>();
  const visitedUnions = new Set<string>();

  function buildSubTree(personId: string): SubTree {
    const st: SubTree = { anchorPersonId: personId, unions: [], x: 0, width: NODE_W };
    if (visited.has(personId)) return st;
    visited.add(personId);

    for (const unionId of personUnions[personId] || []) {
      if (visitedUnions.has(unionId)) continue;
      visitedUnions.add(unionId);

      const union = data.unions[unionId];
      const otherPartnerIds = union.partners.filter(p => p !== personId);
      for (const p of otherPartnerIds) visited.add(p);

      const childSubTrees: SubTree[] = [];
      for (const childId of union.children) {
        if (!visited.has(childId)) childSubTrees.push(buildSubTree(childId));
      }

      st.unions.push({ unionId, otherPartnerIds, childSubTrees, slotWidth: 0 });
    }

    return st;
  }

  // Width of the top-row portion a slot adds (union node + partners, no anchor)
  function slotRowWidth(slot: UnionSlot): number {
    const partnersW =
      slot.otherPartnerIds.length > 0
        ? slot.otherPartnerIds.length * NODE_W + (slot.otherPartnerIds.length - 1) * PARTNER_GAP
        : 0;
    return PARTNER_GAP + UNION_W + PARTNER_GAP + partnersW;
  }

  // Total pixel width of a slot's children row
  function slotChildrenWidth(slot: UnionSlot): number {
    if (slot.childSubTrees.length === 0) return 0;
    return (
      slot.childSubTrees.reduce((s, c) => s + c.width, 0) +
      H_GAP * (slot.childSubTrees.length - 1)
    );
  }

  // Bottom-up width computation.
  // Each slot gets slotWidth = max(rowWidth, childrenWidth).
  // This guarantees the section is wide enough for both partners and children
  // so that sectionX boundaries never overlap when used in assignPositions.
  function computeWidth(st: SubTree): number {
    for (const slot of st.unions) {
      for (const child of slot.childSubTrees) computeWidth(child);

      const rw = slotRowWidth(slot);
      const cw = slotChildrenWidth(slot);
      slot.slotWidth = Math.max(rw, cw);
    }

    st.width = NODE_W + st.unions.reduce((s, slot) => s + slot.slotWidth, 0);
    return st.width;
  }

  // Top-down position assignment.
  function assignPositions(st: SubTree, startX: number, depth: number) {
    const y = depth * (NODE_H + V_GAP);

    nodes.push({
      id: `person-${st.anchorPersonId}`,
      type: 'person',
      personId: st.anchorPersonId,
      x: startX,
      y,
      width: NODE_W,
      height: NODE_H,
    });

    // sectionX is the left edge of the current slot's section (starts after anchor)
    let sectionX = startX + NODE_W;

    for (const slot of st.unions) {
      const divorced = data.unions[slot.unionId]?.status === 'divorced';
      const rw = slotRowWidth(slot);
      const cw = slotChildrenWidth(slot);

      // Union node sits at the start of the slot section
      const unionX = sectionX + PARTNER_GAP;
      const unionY = y + NODE_H / 2 - UNION_H / 2;
      const unionCenterX = unionX + UNION_W / 2;

      nodes.push({
        id: `union-${slot.unionId}`,
        type: 'union',
        unionId: slot.unionId,
        x: unionX,
        y: unionY,
        width: UNION_W,
        height: UNION_H,
      });

      edges.push({
        id: `e-${st.anchorPersonId}-${slot.unionId}`,
        fromId: `person-${st.anchorPersonId}`,
        toId: `union-${slot.unionId}`,
        type: 'partner',
        divorced,
      });

      // Partners to the right of the union node
      let px = unionX + UNION_W + PARTNER_GAP;
      for (const partnerId of slot.otherPartnerIds) {
        nodes.push({
          id: `person-${partnerId}`,
          type: 'person',
          personId: partnerId,
          x: px,
          y,
          width: NODE_W,
          height: NODE_H,
        });
        edges.push({
          id: `e-${slot.unionId}-${partnerId}`,
          fromId: `union-${slot.unionId}`,
          toId: `person-${partnerId}`,
          type: 'partner',
          divorced,
        });
        px += NODE_W + PARTNER_GAP;
      }

      // Children centered under the union node, clamped to sectionX so they
      // never escape into an adjacent slot's territory.
      // Because slot.slotWidth = max(rw, cw), children always fit within
      // [sectionX, sectionX + slotWidth].
      if (slot.childSubTrees.length > 0) {
        const idealCx = unionCenterX - cw / 2;
        let cx = Math.max(sectionX, idealCx);

        for (const child of slot.childSubTrees) {
          assignPositions(child, cx, depth + 1);

          edges.push({
            id: `e-${slot.unionId}-to-${child.anchorPersonId}`,
            fromId: `union-${slot.unionId}`,
            toId: `person-${child.anchorPersonId}`,
            type: 'parent-child',
          });

          cx += child.width + H_GAP;
        }
      }

      // Advance past this slot — guaranteed no overlap with next slot
      sectionX += slot.slotWidth;

      // Suppress unused-variable warning for rw (used implicitly via slotWidth)
      void rw;
    }
  }

  const root = buildSubTree(data.rootPersonId);
  computeWidth(root);
  assignPositions(root, 0, 0);

  // Shift to (40, 40) padding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  const offsetX = 40 - minX;
  const offsetY = 40 - minY;
  for (const node of nodes) {
    node.x += offsetX;
    node.y += offsetY;
  }

  return { nodes, edges, width: maxX - minX + 80, height: maxY - minY + 80 };
}
