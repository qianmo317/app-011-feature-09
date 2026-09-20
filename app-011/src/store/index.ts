import { create } from 'zustand';
import type { Plan, Room, Opening, Outlet, MatSpec } from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';
import {
  DEFAULT_CIRCUIT_LIMIT_W,
  buildOverloadChecks,
  isSameCheck,
} from '../utils/circuitCalc';

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
  deleteOutlet: (planId: string, outletId: string) => void;
  setCircuitLimitW: (planId: string, limitW: number) => void;
  clearCircuitChecks: (planId: string) => void;
  updateMaterials: (planId: string, mats: MatSpec[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 点位或上限变动后重算各回路负载；
 * 对超载回路追加一条判定记录（与上次结论相同则跳过），历史可回翻。
 */
function withCircuitCheck(plan: Plan): Plan {
  const limitW = plan.circuitLimitW ?? DEFAULT_CIRCUIT_LIMIT_W;
  const incoming = buildOverloadChecks(plan.outlets, limitW, genId);
  if (incoming.length === 0) return plan;
  const history = plan.circuitChecks ?? [];
  const fresh = incoming.filter((rec) => {
    const last = [...history].reverse().find((c) => c.circuit === rec.circuit);
    return !last || !isSameCheck(last, rec);
  });
  if (fresh.length === 0) return plan;
  return { ...plan, circuitChecks: [...history, ...fresh] };
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
      circuitChecks: [],
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
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? withCircuitCheck({ ...p, outlets: [...p.outlets, outlet] }) : p
      ),
    })),

  updateOutlet: (planId, outletId, updater) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? withCircuitCheck({
              ...p,
              outlets: p.outlets.map((o) => (o.id === outletId ? updater(o) : o)),
            })
          : p
      ),
    })),

  deleteOutlet: (planId, outletId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? withCircuitCheck({ ...p, outlets: p.outlets.filter((o) => o.id !== outletId) })
          : p
      ),
    })),

  setCircuitLimitW: (planId, limitW) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? withCircuitCheck({ ...p, circuitLimitW: limitW }) : p
      ),
    })),

  clearCircuitChecks: (planId) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, circuitChecks: [] } : p)),
    })),

  updateMaterials: (planId, mats) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, materials: mats } : p)),
    })),
}));
