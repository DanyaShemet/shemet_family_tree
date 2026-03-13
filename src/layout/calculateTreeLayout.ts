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

interface OtherPartner {
  personId: string;
  extensionUnions: UnionSlot[];
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
  isGhost: boolean;
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
  const placedPersonIds = new Set<string>();

  function collectExtensionUnions(partnerId: string): UnionSlot[] {
    const result: UnionSlot[] = [];
    for (const extUnionId of personUnions[partnerId] || []) {
      if (visitedUnions.has(extUnionId)) continue;
      visitedUnions.add(extUnionId);

      const extUnion = data.unions[extUnionId];
      const extOtherPartners: OtherPartner[] = [];
      for (const extPartnerId of extUnion.partners.filter(p => p !== partnerId)) {
        visited.add(extPartnerId);
        extOtherPartners.push({ personId: extPartnerId, extensionUnions: [] });
      }

      const extChildren: SubTree[] = [];
      for (const childId of extUnion.children) {
        extChildren.push(buildSubTree(childId));
      }

      result.push({ unionId: extUnionId, otherPartners: extOtherPartners, childSubTrees: extChildren, slotWidth: 0 });
    }
    return result;
  }

  function buildSubTree(personId: string): SubTree {
    if (visited.has(personId)) {
      return { anchorPersonId: personId, unions: [], x: 0, width: 0, isGhost: true };
    }
    visited.add(personId);

    const st: SubTree = { anchorPersonId: personId, unions: [], x: 0, width: NODE_W, isGhost: false };

    for (const unionId of personUnions[personId] || []) {
      if (visitedUnions.has(unionId)) continue;
      visitedUnions.add(unionId);

      const union = data.unions[unionId];
      const otherPartners: OtherPartner[] = [];

      for (const partnerId of union.partners.filter(p => p !== personId)) {
        visited.add(partnerId);
        const extensionUnions = collectExtensionUnions(partnerId);
        otherPartners.push({ personId: partnerId, extensionUnions });
      }

      const childSubTrees: SubTree[] = [];
      for (const childId of union.children) {
        childSubTrees.push(buildSubTree(childId));
      }

      st.unions.push({ unionId, otherPartners, childSubTrees, slotWidth: 0 });
    }

    return st;
  }

  // Row width of a partner column: NODE_W + row widths of extension unions (no children).
  function partnerEffectiveWidth(op: OtherPartner): number {
    return NODE_W + op.extensionUnions.reduce((s, ext) => s + ext.slotWidth, 0);
  }

  // Row width of a slot (union diamond + partners with their extensions).
  function slotRowWidth(slot: UnionSlot): number {
    const partnersW =
      slot.otherPartners.reduce((s, op) => s + partnerEffectiveWidth(op), 0) +
      Math.max(0, slot.otherPartners.length - 1) * PARTNER_GAP;
    return PARTNER_GAP + UNION_W + PARTNER_GAP + (partnersW > 0 ? partnersW : 0);
  }

  // Combined children width: main children + all extension children laid out sequentially.
  function allSlotChildrenWidth(slot: UnionSlot): number {
    const kids: SubTree[] = [
      ...slot.childSubTrees.filter(c => !c.isGhost),
      ...slot.otherPartners.flatMap(op =>
        op.extensionUnions.flatMap(ext => ext.childSubTrees.filter(c => !c.isGhost))
      ),
    ];
    if (kids.length === 0) return 0;
    return kids.reduce((s, c) => s + c.width, 0) + H_GAP * (kids.length - 1);
  }

  function computeWidth(st: SubTree): number {
    if (st.isGhost) return 0;
    for (const slot of st.unions) {
      for (const child of slot.childSubTrees) computeWidth(child);
      for (const op of slot.otherPartners) {
        for (const extSlot of op.extensionUnions) {
          for (const extChild of extSlot.childSubTrees) computeWidth(extChild);
          // Extension slot width = row only (children are counted at the parent slot level).
          extSlot.slotWidth = slotRowWidth(extSlot);
        }
      }
      slot.slotWidth = Math.max(slotRowWidth(slot), allSlotChildrenWidth(slot));
    }
    st.width = NODE_W + st.unions.reduce((s, slot) => s + slot.slotWidth, 0);
    return st.width;
  }

  function assignPositions(st: SubTree, startX: number, depth: number) {
    if (st.isGhost) return;

    const y = depth * (NODE_H + V_GAP);

    if (!placedPersonIds.has(st.anchorPersonId)) {
      placedPersonIds.add(st.anchorPersonId);
      nodes.push({
        id: `person-${st.anchorPersonId}`,
        type: 'person',
        personId: st.anchorPersonId,
        x: startX,
        y,
        width: NODE_W,
        height: NODE_H,
      });
    }

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
        unionId: slot.unionId,
        divorced,
      });

      // --- Phase 1: place the row (partners + extension unions/partners) ---
      let px = unionX + UNION_W + PARTNER_GAP;

      for (const op of slot.otherPartners) {
        const effW = partnerEffectiveWidth(op);
        const partnerX = px; // left-align within the column (no centering)

        if (!placedPersonIds.has(op.personId)) {
          placedPersonIds.add(op.personId);
          nodes.push({
            id: `person-${op.personId}`,
            type: 'person',
            personId: op.personId,
            x: partnerX,
            y,
            width: NODE_W,
            height: NODE_H,
          });
        }
        edges.push({
          id: `e-${slot.unionId}-${op.personId}`,
          fromId: `union-${slot.unionId}`,
          toId: `person-${op.personId}`,
          type: 'partner',
          unionId: slot.unionId,
          divorced,
        });

        let extSectionX = partnerX + NODE_W;
        for (const extSlot of op.extensionUnions) {
          const extDivorced = data.unions[extSlot.unionId]?.status === 'divorced';
          const extUnionX = extSectionX + PARTNER_GAP;
          const extUnionY = y + NODE_H / 2 - UNION_H / 2;

          nodes.push({
            id: `union-${extSlot.unionId}`,
            type: 'union',
            unionId: extSlot.unionId,
            x: extUnionX,
            y: extUnionY,
            width: UNION_W,
            height: UNION_H,
          });
          edges.push({
            id: `e-${op.personId}-${extSlot.unionId}`,
            fromId: `person-${op.personId}`,
            toId: `union-${extSlot.unionId}`,
            type: 'partner',
            unionId: extSlot.unionId,
            divorced: extDivorced,
          });

          let extPx = extUnionX + UNION_W + PARTNER_GAP;
          for (const extOp of extSlot.otherPartners) {
            const extPartnerX = extPx;
            if (!placedPersonIds.has(extOp.personId)) {
              placedPersonIds.add(extOp.personId);
              nodes.push({
                id: `person-${extOp.personId}`,
                type: 'person',
                personId: extOp.personId,
                x: extPartnerX,
                y,
                width: NODE_W,
                height: NODE_H,
              });
            }
            edges.push({
              id: `e-${extSlot.unionId}-${extOp.personId}`,
              fromId: `union-${extSlot.unionId}`,
              toId: `person-${extOp.personId}`,
              type: 'partner',
              unionId: extSlot.unionId,
              divorced: extDivorced,
            });
            extPx += NODE_W + PARTNER_GAP;
          }

          extSectionX += extSlot.slotWidth;
        }

        px += effW + PARTNER_GAP;
      }

      // --- Phase 2: place all children sequentially (main then extension) ---
      const combinedCw = allSlotChildrenWidth(slot);
      let cx = Math.max(sectionX, unionCenterX - combinedCw / 2);

      for (const child of slot.childSubTrees) {
        if (!child.isGhost) {
          assignPositions(child, cx, depth + 1);
          cx += child.width + H_GAP;
        }
        edges.push({
          id: `e-${slot.unionId}-to-${child.anchorPersonId}`,
          fromId: `union-${slot.unionId}`,
          toId: `person-${child.anchorPersonId}`,
          type: 'parent-child',
          unionId: slot.unionId,
        });
      }

      for (const op of slot.otherPartners) {
        for (const extSlot of op.extensionUnions) {
          for (const extChild of extSlot.childSubTrees) {
            if (!extChild.isGhost) {
              assignPositions(extChild, cx, depth + 1);
              cx += extChild.width + H_GAP;
            }
            edges.push({
              id: `e-${extSlot.unionId}-to-${extChild.anchorPersonId}`,
              fromId: `union-${extSlot.unionId}`,
              toId: `person-${extChild.anchorPersonId}`,
              type: 'parent-child',
              unionId: extSlot.unionId,
            });
          }
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
