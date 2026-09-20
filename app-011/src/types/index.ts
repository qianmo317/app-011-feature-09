export interface Pt {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  polygon: Pt[];
  heightMm: number;
  floorMat: string;
  wallMat: string;
}

export type OpeningType = 'door' | 'window' | 'arch' | 'sliding';

export interface Opening {
  id: string;
  roomId: string;
  wallIndex: number;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  type: OpeningType;
}

export type OutletKind = 'socket' | 'switch' | 'net' | 'light' | 'water';

export interface Outlet {
  id: string;
  wallKey: string;
  xMm: number;
  heightMm: number;
  kind: OutletKind;
  circuit?: string;
  /** 设备功率（瓦），未填按 0 计 */
  powerW?: number;
  /** 是否常用（日常同时使用的设备） */
  frequent?: boolean;
}

/** 一次回路判超的留档：结论 + 当时的点位快照 */
export interface CircuitOverloadRecord {
  id: string;
  at: number;
  circuit: string;
  totalW: number;
  limitW: number;
  outlets: CircuitOutletSnapshot[];
}

export interface CircuitOutletSnapshot {
  id: string;
  kind: OutletKind;
  label: string;
  powerW: number;
  frequent: boolean;
}

export type Unit = 'm2' | 'm' | 'kg' | 'roll' | 'pcs';

export interface MatSpec {
  id: string;
  name: string;
  unit: Unit;
  coverage?: number;
  lossRate: number;
  price: number;
}

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  rooms: Room[];
  openings: Opening[];
  outlets: Outlet[];
  materials: MatSpec[];
  /** 回路安全上限（瓦），缺省用 DEFAULT_CIRCUIT_LIMIT_W */
  circuitLimitW?: number;
  /** 判超历史，每次判超结论变化时追加 */
  circuitLog?: CircuitOverloadRecord[];
  /** 各回路当前在超状态签名（circuit -> signature），用于判超去重，恢复正常后清除 */
  circuitOverState?: Record<string, string>;
}

export interface WallSegment {
  roomId: string;
  index: number;
  p1: Pt;
  p2: Pt;
  lengthMm: number;
  angle: number;
}

export interface MaterialResult {
  matId: string;
  name: string;
  unit: Unit;
  quantity: number;
  totalPrice: number;
  details: string;
}
