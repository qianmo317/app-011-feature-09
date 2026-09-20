import type { Outlet, OutletKind, Room } from '../types';
import { formatMm } from './geometry';

/** 默认回路安全上限：220V × 16A × 0.85 裕量 ≈ 3000W */
export const DEFAULT_CIRCUIT_LIMIT_W = 3000;

export const KIND_LABELS: Record<OutletKind, string> = {
  socket: '插座',
  switch: '开关',
  net: '网口',
  light: '灯位',
  water: '水口',
};

export const KIND_COLORS: Record<OutletKind, string> = {
  socket: '#e74c3c',
  switch: '#3498db',
  net: '#9b59b6',
  light: '#f39c12',
  water: '#1abc9c',
};

/** 添加点位时各类型带的默认功率（瓦） */
export const KIND_DEFAULT_POWER_W: Record<OutletKind, number> = {
  socket: 0,
  switch: 0,
  net: 0,
  light: 60,
  water: 0,
};

export interface CircuitMember {
  outlet: Outlet;
  label: string;
  powerW: number;
  frequent: boolean;
}

export interface CircuitLoad {
  circuit: string;
  members: CircuitMember[];
  /** 全部点位合计功率 */
  totalW: number;
  /** 其中常用点位的合计功率 */
  frequentW: number;
  limitW: number;
  overLimit: boolean;
  excessW: number;
}

/** 点位的可读位置描述，如「客厅·墙2 @1.50m 高0.30m」 */
export function describeOutlet(rooms: Room[], o: Outlet): string {
  const dash = o.wallKey.lastIndexOf('-');
  const roomId = o.wallKey.slice(0, dash);
  const wallIndex = parseInt(o.wallKey.slice(dash + 1), 10);
  const room = rooms.find((r) => r.id === roomId);
  const where = room ? `${room.name}·墙${wallIndex + 1}` : o.wallKey;
  return `${where} @${formatMm(o.xMm)} 高${formatMm(o.heightMm)}`;
}

/** 按回路归组并计算负载；未填回路的点位不参与 */
export function calcCircuitLoads(
  outlets: Outlet[],
  rooms: Room[],
  limitW: number
): CircuitLoad[] {
  const groups = new Map<string, Outlet[]>();
  for (const o of outlets) {
    const circuit = (o.circuit || '').trim();
    if (!circuit) continue;
    const list = groups.get(circuit) || [];
    list.push(o);
    groups.set(circuit, list);
  }

  const loads: CircuitLoad[] = [];
  for (const [circuit, members] of groups) {
    const ms: CircuitMember[] = members.map((outlet) => ({
      outlet,
      label: describeOutlet(rooms, outlet),
      powerW: outlet.powerW || 0,
      frequent: !!outlet.frequent,
    }));
    ms.sort((a, b) => b.powerW - a.powerW);
    const totalW = ms.reduce((s, m) => s + m.powerW, 0);
    const frequentW = ms.filter((m) => m.frequent).reduce((s, m) => s + m.powerW, 0);
    loads.push({
      circuit,
      members: ms,
      totalW,
      frequentW,
      limitW,
      overLimit: totalW > limitW,
      excessW: Math.max(0, totalW - limitW),
    });
  }
  loads.sort((a, b) => a.circuit.localeCompare(b.circuit, 'zh-CN'));
  return loads;
}

export interface SplitSuggestion {
  /** 留在原回路的点位 */
  keep: CircuitMember[];
  /** 建议挪到新回路的点位 */
  move: CircuitMember[];
  keepW: number;
  moveW: number;
  /** 拆成两路后是否都能回到上限内 */
  feasible: boolean;
}

/** 建议一：拆两路。按功率降序贪心，把装不下的点位挪去新回路 */
export function suggestSplit(members: CircuitMember[], limitW: number): SplitSuggestion {
  const sorted = [...members].sort((a, b) => b.powerW - a.powerW);
  const keep: CircuitMember[] = [];
  const move: CircuitMember[] = [];
  let keepW = 0;
  let moveW = 0;
  for (const m of sorted) {
    if (keepW + m.powerW <= limitW) {
      keep.push(m);
      keepW += m.powerW;
    } else {
      move.push(m);
      moveW += m.powerW;
    }
  }
  return { keep, move, keepW, moveW, feasible: moveW <= limitW };
}

/** 建议二：换低功率设备。返回若干条可执行的降功率建议 */
export function suggestLowerPower(members: CircuitMember[], limitW: number): string[] {
  const totalW = members.reduce((s, m) => s + m.powerW, 0);
  let excess = totalW - limitW;
  if (excess <= 0) return [];

  const tips: string[] = [];
  const sorted = [...members].sort((a, b) => b.powerW - a.powerW);
  for (const m of sorted) {
    if (excess <= 0) break;
    if (m.powerW <= 0) continue;
    const target = m.powerW - excess;
    if (target > 0) {
      tips.push(
        `将「${KIND_LABELS[m.outlet.kind]} ${m.label}」从 ${m.powerW}W 换成 ≤${target}W 的设备，即可回落到上限内`
      );
      return tips;
    }
    tips.push(
      `「${KIND_LABELS[m.outlet.kind]} ${m.label}」(${m.powerW}W) 单独降功率已不够，建议移除或改接其他回路`
    );
    excess -= m.powerW;
  }
  if (excess > 0) {
    tips.push(`以上调整后仍超 ${excess}W，请继续减少大功率设备或拆分回路`);
  }
  return tips;
}
