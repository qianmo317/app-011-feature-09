import type { CircuitCheck, Outlet, OutletKind, Room } from '../types';

/** 每回路默认安全上限：16A × 220V ≈ 3500W */
export const DEFAULT_CIRCUIT_LIMIT_W = 3500;

/** 市电电压，用于估算电流 */
export const MAINS_VOLTAGE = 220;

/** 未填功率时按类型给的估算值 */
export const DEFAULT_POWER_BY_KIND: Record<OutletKind, number> = {
  socket: 200,
  switch: 0,
  net: 0,
  light: 60,
  water: 0,
};

export const KIND_LABEL: Record<OutletKind, string> = {
  socket: '插座',
  switch: '开关',
  net: '网口',
  light: '灯位',
  water: '水口',
};

/** 常见电器功率预设，便于快速填写 */
export const POWER_PRESETS: { label: string; watts: number }[] = [
  { label: '照明 60W', watts: 60 },
  { label: '电视 150W', watts: 150 },
  { label: '冰箱 150W', watts: 150 },
  { label: '电脑 300W', watts: 300 },
  { label: '洗衣机 500W', watts: 500 },
  { label: '空调(1.5匹) 1100W', watts: 1100 },
  { label: '电热水器 2000W', watts: 2000 },
  { label: '电暖器 2000W', watts: 2000 },
  { label: '电磁炉 2100W', watts: 2100 },
];

export function outletPower(o: Outlet): number {
  return o.powerW ?? DEFAULT_POWER_BY_KIND[o.kind] ?? 0;
}

export interface CircuitGroup {
  name: string;
  outlets: Outlet[];
  /** 合计功率：全部点位同时开启的满载功率 */
  totalW: number;
  /** 其中标记为「常用」的点位功率合计 */
  frequentW: number;
  limitW: number;
  overLimit: boolean;
}

/** 把填了回路的点位按回路名归组并算出合计功率 */
export function groupOutletsByCircuit(outlets: Outlet[], limitW: number): CircuitGroup[] {
  const map = new Map<string, Outlet[]>();
  for (const o of outlets) {
    const key = (o.circuit || '').trim();
    if (!key) continue;
    const arr = map.get(key);
    if (arr) arr.push(o);
    else map.set(key, [o]);
  }
  return Array.from(map.entries())
    .map(([name, list]) => {
      const totalW = list.reduce((s, o) => s + outletPower(o), 0);
      const frequentW = list.filter((o) => o.frequent).reduce((s, o) => s + outletPower(o), 0);
      return { name, outlets: list, totalW, frequentW, limitW, overLimit: totalW > limitW };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }));
}

/** 点位的人读标签：房间·墙N·类型@位置 */
export function outletLabel(o: { wallKey: string; xMm: number; kind: OutletKind }, rooms: Room[]): string {
  const dash = o.wallKey.lastIndexOf('-');
  const roomId = dash >= 0 ? o.wallKey.slice(0, dash) : o.wallKey;
  const wallIdx = dash >= 0 ? parseInt(o.wallKey.slice(dash + 1)) : NaN;
  const room = rooms.find((r) => r.id === roomId);
  const where = room
    ? `${room.name}·墙${Number.isNaN(wallIdx) ? '?' : wallIdx + 1}`
    : o.wallKey;
  return `${where}·${KIND_LABEL[o.kind]}@${(o.xMm / 1000).toFixed(2)}m`;
}

export interface SplitSuggestion {
  /** 建议挪到新回路的点位（按功率从大到小，挪到剩余达标为止） */
  move: Outlet[];
  /** 挪走后本路剩余功率 */
  restW: number;
}

/** 拆分建议：贪心地从大到小挪点位，直到本路剩余功率不超限 */
export function suggestSplit(group: CircuitGroup): SplitSuggestion {
  const sorted = [...group.outlets].sort((a, b) => outletPower(b) - outletPower(a));
  const move: Outlet[] = [];
  let restW = group.totalW;
  for (const o of sorted) {
    if (restW <= group.limitW) break;
    move.push(o);
    restW -= outletPower(o);
  }
  return { move, restW };
}

/** 由当前点位生成超载回路的判定记录（不含去重） */
export function buildOverloadChecks(
  outlets: Outlet[],
  limitW: number,
  genId: () => string
): CircuitCheck[] {
  return groupOutletsByCircuit(outlets, limitW)
    .filter((g) => g.overLimit)
    .map((g) => ({
      id: genId(),
      at: Date.now(),
      circuit: g.name,
      totalW: g.totalW,
      limitW,
      outlets: g.outlets.map((o) => ({
        id: o.id,
        kind: o.kind,
        wallKey: o.wallKey,
        xMm: o.xMm,
        heightMm: o.heightMm,
        powerW: outletPower(o),
        frequent: !!o.frequent,
      })),
    }));
}

/** 与既有历史对比：同回路、同合计、同点位集合视为同一次结论，不重复记录 */
export function isSameCheck(a: CircuitCheck, b: CircuitCheck): boolean {
  if (a.circuit !== b.circuit || a.totalW !== b.totalW) return false;
  const idsA = a.outlets.map((o) => o.id).sort().join(',');
  const idsB = b.outlets.map((o) => o.id).sort().join(',');
  return idsA === idsB;
}
