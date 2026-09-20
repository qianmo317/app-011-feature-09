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
  /** 预计功率 (W) */
  powerW?: number;
  /** 是否常用（长期/高频使用） */
  frequent?: boolean;
}

/** 判超记录中保留的点位快照 */
export interface CircuitCheckOutlet {
  id: string;
  kind: OutletKind;
  wallKey: string;
  xMm: number;
  heightMm: number;
  powerW: number;
  frequent: boolean;
}

/** 一次回路超载判定的留存结论 */
export interface CircuitCheck {
  id: string;
  at: number;
  circuit: string;
  totalW: number;
  limitW: number;
  outlets: CircuitCheckOutlet[];
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
  /** 每回路安全上限 (W)，缺省用 DEFAULT_CIRCUIT_LIMIT_W */
  circuitLimitW?: number;
  /** 回路超载判定历史（新记录追加在末尾） */
  circuitChecks?: CircuitCheck[];
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
