import { create } from 'zustand';
import type { Plan, Room, Opening, Outlet, MatSpec, CircuitOverloadRecord } from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';
import { calcCircuitLoads, DEFAULT_CIRCUIT_LIMIT_W } from '../utils/circuitCalc';

interface AppState {
  plans: Plan[];
  currentPlanId: string | null;
  scale: number;
  setScale: (s: number) => void;
  addPlan: (name: string) => string;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => Plan | undefined;
  updatePlan: (id: string, updater: (plan: Plan) => Plan) => void;
  addRoom: (planId: string, room: Room) => void;
  updateRoom: (planId: string, roomId: string, updater: (room: Room) => Room) => void;
  deleteRoom: (planId: string, roomId: string) => void;
  addOpening: (planId: string, opening: Opening) => void;
  deleteOpening: (planId: string, openingId: string) => void;
  addOutlet: (planId: string, outlet: Outlet) => void;
  updateOutlet: (planId: string, outletId: string, updater: (o: Outlet) => Outlet) => void;
  assignCircuit: (planId: string, outletIds: string[], circuit: string) => void;
  deleteOutlet: (planId: string, outletId: string) => void;
  setCircuitLimit: (planId: string, limitW: number) => void;
  updateMaterials: (planId: string, mats: MatSpec[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 点位或上限变更后重算各回路负载；
 * 回路新进入超限、或超限期间结论（成员/合计/上限）变化时，追加一条判超记录；
 * 回路恢复正常后清除其在超签名，再次超限会重新留档。
 */
function withCircuitLog(plan: Plan): Plan {
  const limitW = plan.circuitLimitW ?? DEFAULT_CIRCUIT_LIMIT_W;
  const loads = calcCircuitLoads(plan.outlets, plan.rooms, limitW);
  let log = plan.circuitLog ?? [];
  const overState: Record<string, string> = { ...(plan.circuitOverState ?? {}) };

  for (const load of loads) {
    const signature =
      load.members
        .map((m) => m.outlet.id)
        .sort()
        .join(',') +
      `|${load.totalW}|${load.limitW}`;

    if (!load.overLimit) {
      delete overState[load.circuit];
      continue;
    }
    if (overState[load.circuit] === signature) continue;
    overState[load.circuit] = signature;

    const record: CircuitOverloadRecord = {
      id: genId(),
      at: Date.now(),
      circuit: load.circuit,
      totalW: load.totalW,
      limitW: load.limitW,
      outlets: load.members.map((m) => ({
        id: m.outlet.id,
        kind: m.outlet.kind,
        label: m.label,
        powerW: m.powerW,
        frequent: m.frequent,
      })),
    };
    log = [...log, record];
  }
  return { ...plan, circuitLog: log, circuitOverState: overState };
}

/** 对 plan 应用点位变更，并统一触发回路重算 */
function mutateOutlets(state: AppState, planId: string, fn: (outlets: Outlet[]) => Outlet[]) {
  return {
    plans: state.plans.map((p) =>
      p.id === planId ? withCircuitLog({ ...p, outlets: fn(p.outlets) }) : p
    ),
  };
}

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  currentPlanId: null,
  scale: 1,

  setScale: (s) => set({ scale: s }),

  addPlan: (name) => {
    const id = genId();
    const plan: Plan = {
      id,
      name,
      createdAt: Date.now(),
      rooms: [],
      openings: [],
      outlets: [],
      materials: [...DEFAULT_MATS],
      circuitLimitW: DEFAULT_CIRCUIT_LIMIT_W,
      circuitLog: [],
    };
    set((state) => ({ plans: [...state.plans, plan], currentPlanId: id }));
    return id;
  },

  deletePlan: (id) =>
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
      currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
    })),

  getPlan: (id) => get().plans.find((p) => p.id === id),

  updatePlan: (id, updater) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === id ? updater(p) : p)),
    })),

  addRoom: (planId, room) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, rooms: [...p.rooms, room] } : p
      ),
    })),

  updateRoom: (planId, roomId, updater) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? updater(r) : r)) }
          : p
      ),
    })),

  deleteRoom: (planId, roomId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              rooms: p.rooms.filter((r) => r.id !== roomId),
              openings: p.openings.filter((o) => o.roomId !== roomId),
            }
          : p
      ),
    })),

  addOpening: (planId, opening) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, openings: [...p.openings, opening] } : p
      ),
    })),

  deleteOpening: (planId, openingId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, openings: p.openings.filter((o) => o.id !== openingId) }
          : p
      ),
    })),

  addOutlet: (planId, outlet) =>
    set((state) => mutateOutlets(state, planId, (outlets) => [...outlets, outlet])),

  updateOutlet: (planId, outletId, updater) =>
    set((state) =>
      mutateOutlets(state, planId, (outlets) =>
        outlets.map((o) => (o.id === outletId ? updater(o) : o))
      )
    ),

  assignCircuit: (planId, outletIds, circuit) =>
    set((state) =>
      mutateOutlets(state, planId, (outlets) =>
        outlets.map((o) => (outletIds.includes(o.id) ? { ...o, circuit } : o))
      )
    ),

  deleteOutlet: (planId, outletId) =>
    set((state) =>
      mutateOutlets(state, planId, (outlets) => outlets.filter((o) => o.id !== outletId))
    ),

  setCircuitLimit: (planId, limitW) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? withCircuitLog({ ...p, circuitLimitW: limitW }) : p
      ),
    })),

  updateMaterials: (planId, mats) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, materials: mats } : p)),
    })),
}));
