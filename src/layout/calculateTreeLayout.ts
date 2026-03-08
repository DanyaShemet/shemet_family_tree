import type { FamilyTreeData, PositionedNode, Edge } from '../types/family';

const NODE_W = 160;
const NODE_H = 70;
const UNION_W = 24;
const UNION_H = 24;
const H_GAP = 40;
const V_GAP = 100;
const PARTNER_GAP = 20;
const INLAW_PADDING = 80; // extra horizontal space around in-law parent pairs

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: Edge[];
  width: number;
  height: number;
}

// A partner in a union slot. If the partner has known parents in the data,
// inlawUnionId records that parent union so it can be rendered above them.
interface OtherPartner {
  personId: string;
  inlawUnionId?: string; // parent union to render above this partner
}

interface UnionSlot {
  unionId: string;
  otherPartners: OtherPartner[];
  childSubTrees: SubTree[];
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

  const parentUnionsOf: Record<string, string[]> = {};
  for (const union of Object.values(data.unions)) {
    for (const childId of union.children) {
      if (!parentUnionsOf[childId]) parentUnionsOf[childId] = [];
      parentUnionsOf[childId].push(union.id);
    }
  }

  const allChildren = new Set<string>(
    Object.values(data.unions).flatMap(u => u.children)
  );

  function findTopAncestor(personId: string, seen = new Set<string>()): string {
    if (seen.has(personId)) return personId;
    seen.add(personId);
    const parentUnionIds = parentUnionsOf[personId];
    if (!parentUnionIds || parentUnionIds.length === 0) return personId;
    return findTopAncestor(data.unions[parentUnionIds[0]].partners[0], seen);
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
      const otherPartners: OtherPartner[] = [];

      for (const partnerId of union.partners.filter(p => p !== personId)) {
        visited.add(partnerId);

        // Check if this partner has known parents — if so, record the parent union
        // and mark its members visited so they don't appear as a disconnected subtree.
        let inlawUnionId: string | undefined;
        for (const puId of parentUnionsOf[partnerId] || []) {
          if (!visitedUnions.has(puId)) {
            visitedUnions.add(puId);
            inlawUnionId = puId;
            for (const p of data.unions[puId].partners) visited.add(p);
            break; // only handle the first parent union
          }
        }

        otherPartners.push({ personId: partnerId, inlawUnionId });
      }

      const childSubTrees: SubTree[] = [];
      for (const childId of union.children) {
        if (!visited.has(childId)) childSubTrees.push(buildSubTree(childId));
      }

      st.unions.push({ unionId, otherPartners, childSubTrees, slotWidth: 0 });
    }

    return st;
  }

  // Effective horizontal width needed for one partner column (may be wider than NODE_W
  // when the partner has an in-law parent pair that must fit above them).
  function partnerEffectiveWidth(op: OtherPartner): number {
    if (!op.inlawUnionId) return NODE_W;
    const pu = data.unions[op.inlawUnionId];
    if (!pu) return NODE_W;
    const pairW =
      pu.partners.length * NODE_W +
      Math.max(0, pu.partners.length - 1) * PARTNER_GAP +
      UNION_W + 2 * PARTNER_GAP;
    return Math.max(NODE_W, pairW + INLAW_PADDING);
  }

  function slotRowWidth(slot: UnionSlot): number {
    const partnersW =
      slot.otherPartners.reduce((s, op) => s + partnerEffectiveWidth(op), 0) +
      Math.max(0, slot.otherPartners.length - 1) * PARTNER_GAP;
    return PARTNER_GAP + UNION_W + PARTNER_GAP + (partnersW > 0 ? partnersW : 0);
  }

  function slotChildrenWidth(slot: UnionSlot): number {
    if (slot.childSubTrees.length === 0) return 0;
    return (
      slot.childSubTrees.reduce((s, c) => s + c.width, 0) +
      H_GAP * (slot.childSubTrees.length - 1)
    );
  }

  function computeWidth(st: SubTree): number {
    for (const slot of st.unions) {
      for (const child of slot.childSubTrees) computeWidth(child);
      slot.slotWidth = Math.max(slotRowWidth(slot), slotChildrenWidth(slot));
    }
    st.width = NODE_W + st.unions.reduce((s, slot) => s + slot.slotWidth, 0);
    return st.width;
  }

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

    let sectionX = startX + NODE_W;

    for (const slot of st.unions) {
      const divorced = data.unions[slot.unionId]?.status === 'divorced';

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

      // Place each partner, centered in their effective width column
      let px = unionX + UNION_W + PARTNER_GAP;

      for (const op of slot.otherPartners) {
        const effW = partnerEffectiveWidth(op);
        const partnerCenter = px + effW / 2;
        const partnerX = partnerCenter - NODE_W / 2;

        nodes.push({
          id: `person-${op.personId}`,
          type: 'person',
          personId: op.personId,
          x: partnerX,
          y,
          width: NODE_W,
          height: NODE_H,
        });

        edges.push({
          id: `e-${slot.unionId}-${op.personId}`,
          fromId: `union-${slot.unionId}`,
          toId: `person-${op.personId}`,
          type: 'partner',
          divorced,
        });

        // Render in-law parents above this partner (one generation up)
        if (op.inlawUnionId && depth > 0) {
          const pu = data.unions[op.inlawUnionId];
          const parentY = (depth - 1) * (NODE_H + V_GAP);
          const pairW =
            pu.partners.length * NODE_W +
            Math.max(0, pu.partners.length - 1) * PARTNER_GAP +
            UNION_W + 2 * PARTNER_GAP;
          let ppx = partnerCenter - pairW / 2;

          for (let i = 0; i < pu.partners.length; i++) {
            const parentId = pu.partners[i];
            nodes.push({
              id: `person-${parentId}`,
              type: 'person',
              personId: parentId,
              x: ppx,
              y: parentY,
              width: NODE_W,
              height: NODE_H,
            });
            ppx += NODE_W + PARTNER_GAP;

            if (i < pu.partners.length - 1) {
              // Place the in-law union node between parents
              if (i === 0) {
                nodes.push({
                  id: `union-${op.inlawUnionId}`,
                  type: 'union',
                  unionId: op.inlawUnionId,
                  x: ppx - PARTNER_GAP / 2,
                  y: parentY + NODE_H / 2 - UNION_H / 2,
                  width: UNION_W,
                  height: UNION_H,
                });

                edges.push({
                  id: `e-inlaw-${pu.partners[0]}-${op.inlawUnionId}`,
                  fromId: `person-${pu.partners[0]}`,
                  toId: `union-${op.inlawUnionId}`,
                  type: 'partner',
                });

                edges.push({
                  id: `e-inlaw-${op.inlawUnionId}-${pu.partners[1]}`,
                  fromId: `union-${op.inlawUnionId}`,
                  toId: `person-${pu.partners[1]}`,
                  type: 'partner',
                });

                // Parent-child line from in-law union down to the partner
                edges.push({
                  id: `e-inlaw-${op.inlawUnionId}-to-${op.personId}`,
                  fromId: `union-${op.inlawUnionId}`,
                  toId: `person-${op.personId}`,
                  type: 'parent-child',
                });

                ppx += UNION_W + PARTNER_GAP;
              }
            }
          }
        }

        px += effW + PARTNER_GAP;
      }

      // Children centered below this union node, clamped to section boundary
      if (slot.childSubTrees.length > 0) {
        const cw = slotChildrenWidth(slot);
        let cx = Math.max(sectionX, unionCenterX - cw / 2);

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

      sectionX += slot.slotWidth;
    }
  }

  const primaryRoot = findTopAncestor(data.rootPersonId);
  const rootQueue: string[] = [primaryRoot];
  for (const personId of Object.keys(data.persons)) {
    if (!allChildren.has(personId) && personId !== primaryRoot) {
      rootQueue.push(personId);
    }
  }

  const roots: SubTree[] = [];
  for (const rootId of rootQueue) {
    if (!visited.has(rootId)) roots.push(buildSubTree(rootId));
  }

  for (const root of roots) computeWidth(root);

  let startX = 0;
  for (const root of roots) {
    assignPositions(root, startX, 0);
    startX += root.width + H_GAP * 4;
  }

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
