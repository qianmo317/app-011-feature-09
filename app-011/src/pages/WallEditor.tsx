import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import type { Outlet, Plan } from '../types';
import { getWallSegments, formatMm } from '../utils/geometry';
import {
  calcCircuitLoads,
  suggestSplit,
  suggestLowerPower,
  describeOutlet,
  DEFAULT_CIRCUIT_LIMIT_W,
  KIND_LABELS,
  KIND_COLORS,
  KIND_DEFAULT_POWER_W,
  type CircuitLoad,
} from '../utils/circuitCalc';

export default function WallEditor() {
  const { id } = useParams<{ id: string }>();
  const { getPlan, addOutlet } = useStore();
  const plan = getPlan(id!);

  const [roomId, setRoomId] = useState('');
  const [wallIndex, setWallIndex] = useState('0');
  const [xMm, setXMm] = useState('0');
  const [heightMm, setHeightMm] = useState('300');
  const [kind, setKind] = useState<Outlet['kind']>('socket');
  const [circuit, setCircuit] = useState('');
  const [powerW, setPowerW] = useState('0');
  const [frequent, setFrequent] = useState(false);

  const selectedRoom = plan?.rooms.find((r) => r.id === roomId);
  const wallSegs = selectedRoom ? getWallSegments(selectedRoom) : [];
  const wallKey = selectedRoom ? `${selectedRoom.id}-${wallIndex}` : '';

  const handleKindChange = (k: Outlet['kind']) => {
    setKind(k);
    setPowerW(String(KIND_DEFAULT_POWER_W[k]));
  };

  const handleAdd = () => {
    if (!plan || !wallKey) return;
    const outlet: Outlet = {
      id: Math.random().toString(36).slice(2),
      wallKey,
      xMm: parseInt(xMm) || 0,
      heightMm: parseInt(heightMm) || 0,
      kind,
      circuit: circuit.trim() || undefined,
      powerW: Math.max(0, parseInt(powerW) || 0),
      frequent,
    };
    addOutlet(plan.id, outlet);
  };

  const wallOutlets = plan?.outlets.filter((o) => o.wallKey === wallKey) || [];
  const allOutlets = plan?.outlets || [];

  const outletCounts = {
    socket: allOutlets.filter((o) => o.kind === 'socket').length,
    switch: allOutlets.filter((o) => o.kind === 'switch').length,
    net: allOutlets.filter((o) => o.kind === 'net').length,
    light: allOutlets.filter((o) => o.kind === 'light').length,
    water: allOutlets.filter((o) => o.kind === 'water').length,
  };

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  const limitW = plan.circuitLimitW ?? DEFAULT_CIRCUIT_LIMIT_W;
  const loads = calcCircuitLoads(plan.outlets, plan.rooms, limitW);
  const overCount = loads.filter((l) => l.overLimit).length;

  return (
    <div>
      <h2 className="page-title">{plan.name} - 墙面展开与点位标注</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab active">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab">
          材料清单
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">
          导出打印
        </Link>
      </div>

      <div className="info-bar">
        <span>插座: <strong>{outletCounts.socket}</strong></span>
        <span>开关: <strong>{outletCounts.switch}</strong></span>
        <span>网口: <strong>{outletCounts.net}</strong></span>
        <span>灯位: <strong>{outletCounts.light}</strong></span>
        <span>水口: <strong>{outletCounts.water}</strong></span>
        <span>合计: <strong>{allOutlets.length}</strong></span>
        <span>回路: <strong>{loads.length}</strong></span>
        {overCount > 0 && (
          <span className="warn-text">⚠ 超限回路: {overCount} 个</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 340, flexShrink: 0 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>添加点位</h3>
            <div className="form-group">
              <label>房间</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">选择房间</option>
                {plan.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoom && (
              <>
                <div className="form-group">
                  <label>墙面</label>
                  <select value={wallIndex} onChange={(e) => setWallIndex(e.target.value)}>
                    {wallSegs.map((s, i) => (
                      <option key={i} value={i}>
                        墙{i + 1} ({formatMm(s.lengthMm)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>类型</label>
                  <select value={kind} onChange={(e) => handleKindChange(e.target.value as Outlet['kind'])}>
                    <option value="socket">插座</option>
                    <option value="switch">开关</option>
                    <option value="net">网口</option>
                    <option value="light">灯位</option>
                    <option value="water">水口</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>距墙左端 (mm)</label>
                  <input value={xMm} onChange={(e) => setXMm(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>距地高度 (mm)</label>
                  <input value={heightMm} onChange={(e) => setHeightMm(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>回路 (可选)</label>
                  <input value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="如: L1" />
                </div>
                <div className="form-group">
                  <label>设备功率 (W)</label>
                  <input
                    value={powerW}
                    onChange={(e) => setPowerW(e.target.value)}
                    placeholder="如: 2000"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={frequent}
                      onChange={(e) => setFrequent(e.target.checked)}
                    />
                    常用设备（日常同时使用）
                  </label>
                </div>

                <button className="btn btn-primary" onClick={handleAdd} style={{ width: '100%' }}>
                  添加点位
                </button>
              </>
            )}
          </div>

          {wallOutlets.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>当前墙面点位</h4>
              {wallOutlets.map((o) => (
                <OutletRow key={o.id} plan={plan} outlet={o} />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>墙面展开图</h3>
            <WallDiagram plan={plan} />
          </div>

          <CircuitPanel plan={plan} loads={loads} limitW={limitW} />
          <CircuitLogPanel plan={plan} />
        </div>
      </div>
    </div>
  );
}

/** 单个点位行：类型/回路/功率/常用即改即存，位置与高度失焦提交 */
function OutletRow({ plan, outlet }: { plan: Plan; outlet: Outlet }) {
  const { updateOutlet, deleteOutlet } = useStore();
  const [draft, setDraft] = useState({
    circuit: outlet.circuit || '',
    powerW: String(outlet.powerW ?? 0),
    xMm: String(outlet.xMm),
    heightMm: String(outlet.heightMm),
  });

  useEffect(() => {
    setDraft({
      circuit: outlet.circuit || '',
      powerW: String(outlet.powerW ?? 0),
      xMm: String(outlet.xMm),
      heightMm: String(outlet.heightMm),
    });
  }, [outlet.circuit, outlet.powerW, outlet.xMm, outlet.heightMm]);

  const commit = (patch: Partial<Outlet>) => updateOutlet(plan.id, outlet.id, (o) => ({ ...o, ...patch }));
  const commitInt = (key: 'powerW' | 'xMm' | 'heightMm', raw: string) => {
    const v = Math.max(0, parseInt(raw) || 0);
    if (v !== (outlet[key] ?? 0)) commit({ [key]: v });
  };

  const inputStyle: React.CSSProperties = {
    width: 64,
    padding: '3px 6px',
    fontSize: 12,
    border: '1px solid #ddd',
    borderRadius: 4,
  };

  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #ecf0f1',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <select
          value={outlet.kind}
          onChange={(e) => commit({ kind: e.target.value as Outlet['kind'] })}
          style={{ ...inputStyle, width: 64, color: KIND_COLORS[outlet.kind], fontWeight: 600 }}
        >
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <span style={{ color: '#999', fontSize: 12 }}>{describeOutlet(plan.rooms, outlet)}</span>
        <button
          className="btn btn-danger"
          style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: 12 }}
          onClick={() => deleteOutlet(plan.id, outlet.id)}
        >
          删除
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap', fontSize: 12, color: '#666' }}>
        <label>
          回路{' '}
          <input
            style={{ ...inputStyle, width: 56 }}
            value={draft.circuit}
            placeholder="无"
            onChange={(e) => setDraft({ ...draft, circuit: e.target.value })}
            onBlur={() => {
              const v = draft.circuit.trim();
              if (v !== (outlet.circuit || '')) commit({ circuit: v || undefined });
            }}
          />
        </label>
        <label>
          功率{' '}
          <input
            style={inputStyle}
            value={draft.powerW}
            onChange={(e) => setDraft({ ...draft, powerW: e.target.value })}
            onBlur={() => commitInt('powerW', draft.powerW)}
          />
          W
        </label>
        <label>
          位置{' '}
          <input
            style={{ ...inputStyle, width: 56 }}
            value={draft.xMm}
            onChange={(e) => setDraft({ ...draft, xMm: e.target.value })}
            onBlur={() => commitInt('xMm', draft.xMm)}
          />
        </label>
        <label>
          高度{' '}
          <input
            style={{ ...inputStyle, width: 56 }}
            value={draft.heightMm}
            onChange={(e) => setDraft({ ...draft, heightMm: e.target.value })}
            onBlur={() => commitInt('heightMm', draft.heightMm)}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={!!outlet.frequent}
            onChange={(e) => commit({ frequent: e.target.checked })}
          />
          常用
        </label>
      </div>
    </div>
  );
}

/** 回路负载面板：按回路归组、合计功率、超限警示与整改建议 */
function CircuitPanel({ plan, loads, limitW }: { plan: Plan; loads: CircuitLoad[]; limitW: number }) {
  const { setCircuitLimit, assignCircuit } = useStore();
  const [limitDraft, setLimitDraft] = useState(String(limitW));

  useEffect(() => {
    setLimitDraft(String(limitW));
  }, [limitW]);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 16 }}>回路负载</h3>
        <label style={{ fontSize: 13, color: '#666' }}>
          安全上限{' '}
          <input
            style={{ width: 80, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
            value={limitDraft}
            onChange={(e) => setLimitDraft(e.target.value)}
            onBlur={() => {
              const v = parseInt(limitDraft);
              if (v > 0 && v !== limitW) setCircuitLimit(plan.id, v);
              else setLimitDraft(String(limitW));
            }}
          />{' '}
          W
        </label>
        <span style={{ fontSize: 12, color: '#999' }}>同回路点位功率自动累加，超限即报警</span>
      </div>

      {loads.length === 0 && (
        <div style={{ fontSize: 13, color: '#999' }}>还没有点位填写回路。给点位填上回路名（如 L1）后，这里会自动汇总每一路的功率。</div>
      )}

      {loads.map((load) => (
        <CircuitCard key={load.circuit} plan={plan} load={load} onSplit={(ids, name) => assignCircuit(plan.id, ids, name)} />
      ))}
    </div>
  );
}

function CircuitCard({
  plan,
  load,
  onSplit,
}: {
  plan: Plan;
  load: CircuitLoad;
  onSplit: (outletIds: string[], newCircuit: string) => void;
}) {
  const pct = load.limitW > 0 ? Math.min(100, (load.totalW / load.limitW) * 100) : 0;
  const split = load.overLimit ? suggestSplit(load.members, load.limitW) : null;
  const lowerTips = load.overLimit ? suggestLowerPower(load.members, load.limitW) : [];
  const existingCircuits = plan.outlets.map((o) => o.circuit || '');
  const newCircuitName = split ? nextCircuitName(load.circuit, existingCircuits) : '';

  return (
    <div className={`circuit-card${load.overLimit ? ' over' : ''}`}>
      <div className="circuit-head">
        <span className="circuit-name">{load.circuit}</span>
        <span className={`badge ${load.overLimit ? 'badge-over' : 'badge-ok'}`}>
          {load.overLimit ? '超限' : '正常'}
        </span>
        <div className="load-bar">
          <div
            className={`load-bar-fill${load.overLimit ? ' over' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="circuit-nums">
          合计 <strong className={load.overLimit ? 'over-num' : ''}>{load.totalW}W</strong> / 上限{' '}
          {load.limitW}W · 常用 {load.frequentW}W · {load.members.length} 个点位
        </span>
      </div>

      <div className="circuit-members">
        {load.members.map((m) => (
          <span key={m.outlet.id} className={`member-tag${m.frequent ? ' frequent' : ''}`}>
            {m.frequent && <span className="freq-star">★ </span>}
            {KIND_LABELS[m.outlet.kind]} {m.label}
            {m.powerW > 0 ? ` ${m.powerW}W` : ''}
          </span>
        ))}
      </div>

      {load.overLimit && split && (
        <div className="overload-box">
          <div className="overload-title">
            ⚠ 超出安全上限 {load.excessW}W —— 由以下 {load.members.length} 个点位叠加：
          </div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
            {load.members
              .filter((m) => m.powerW > 0)
              .map((m) => `${KIND_LABELS[m.outlet.kind]} ${m.label}（${m.powerW}W）`)
              .join(' + ')}
            {' = '}
            <strong className="warn-text">{load.totalW}W</strong>
          </div>

          <div className="suggestion">
            <h5>建议一：拆成两路</h5>
            {split.move.length > 0 ? (
              <>
                <div>
                  将 {split.move.map((m) => `「${KIND_LABELS[m.outlet.kind]} ${m.label} ${m.powerW}W」`).join('、')}{' '}
                  移到新回路 <strong>{newCircuitName}</strong>：
                </div>
                <div style={{ marginTop: 4 }}>
                  {load.circuit} 余 {split.keepW}W，{newCircuitName} 为 {split.moveW}W
                  {split.feasible ? '，两路均回到上限内。' : `，但 ${newCircuitName} 仍超上限，需再拆分或换低功率设备。`}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 6, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => onSplit(split.move.map((m) => m.outlet.id), newCircuitName)}
                >
                  一键拆分（把 {split.move.length} 个点位改到 {newCircuitName}）
                </button>
              </>
            ) : (
              <div>单个点位功率已超过上限，拆分无效，请换低功率设备或单独拉专线。</div>
            )}
          </div>

          {lowerTips.length > 0 && (
            <div className="suggestion">
              <h5>建议二：换低功率设备</h5>
              {lowerTips.map((tip, i) => (
                <div key={i}>· {tip}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 判超历史：每次判超的结论与当时点位快照，可展开回翻 */
function CircuitLogPanel({ plan }: { plan: Plan }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const log = [...(plan.circuitLog ?? [])].reverse();

  if (log.length === 0) return null;

  const toggle = (rid: string) => {
    const next = new Set(openIds);
    if (next.has(rid)) next.delete(rid);
    else next.add(rid);
    setOpenIds(next);
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 8, fontSize: 16 }}>判超记录（{log.length}）</h3>
      {log.map((r) => (
        <div key={r.id} className="log-record">
          <div className="log-record-head" onClick={() => toggle(r.id)}>
            <span>
              <strong className="warn-text">{r.circuit}</strong> 合计 {r.totalW}W / 上限 {r.limitW}W（超{' '}
              {r.totalW - r.limitW}W，{r.outlets.length} 个点位）
            </span>
            <span style={{ color: '#999', fontSize: 12 }}>
              {new Date(r.at).toLocaleString()} {openIds.has(r.id) ? '▲' : '▼'}
            </span>
          </div>
          {openIds.has(r.id) && (
            <div className="log-record-body">
              当时点位：
              {r.outlets.map((o) => (
                <div key={o.id}>
                  · {KIND_LABELS[o.kind]} {o.label}
                  {o.powerW > 0 ? ` ${o.powerW}W` : ' 0W'}
                  {o.frequent ? '（常用）' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function nextCircuitName(base: string, existing: string[]): string {
  let name = `${base}-B`;
  let i = 2;
  while (existing.includes(name)) {
    name = `${base}-B${i}`;
    i += 1;
  }
  return name;
}

function WallDiagram({ plan }: { plan: Plan }) {
  const wallHeight = 120;
  const wallGap = 20;
  let y = 20;

  return (
    <svg width="100%" height={plan.rooms.length * (wallHeight + wallGap) + 40}>
      {plan.rooms.map((room) => {
        const segs = getWallSegments(room);
        const maxLen = Math.max(...segs.map((s) => s.lengthMm), 1);
        const scale = 600 / maxLen;
        let x = 20;
        const roomY = y;
        y += wallHeight + wallGap;

        return (
          <g key={room.id}>
            <text x={20} y={roomY - 4} fontSize="12" fill="#2c3e50" fontWeight="500">
              {room.name}
            </text>
            {segs.map((seg, i) => {
              const w = seg.lengthMm * scale;
              const wallKey = `${room.id}-${i}`;
              const outlets = plan.outlets.filter((o) => o.wallKey === wallKey);

              return (
                <g key={i}>
                  <rect x={x} y={roomY} width={w} height={wallHeight} fill="#f8f9fa" stroke="#7f8c8d" strokeWidth={1} />
                  <text x={x + w / 2} y={roomY + wallHeight / 2 + 4} fontSize="10" fill="#999" textAnchor="middle">
                    墙{i + 1}
                  </text>
                  {outlets.map((o) => {
                    const ox = x + o.xMm * scale;
                    const oy = roomY + wallHeight - (o.heightMm / room.heightMm) * wallHeight;
                    const color = KIND_COLORS[o.kind];
                    return (
                      <g key={o.id}>
                        <circle cx={ox} cy={oy} r={5} fill={color} stroke="white" strokeWidth={1} />
                        <text x={ox} y={oy - 8} fontSize="8" fill={color} textAnchor="middle">
                          {KIND_LABELS[o.kind][0]}
                          {o.circuit ? ` ${o.circuit}` : ''}
                          {o.powerW ? ` ${o.powerW}W` : ''}
                        </text>
                      </g>
                    );
                  })}
                  <text x={x + w / 2} y={roomY + wallHeight + 12} fontSize="9" fill="#666" textAnchor="middle">
                    {formatMm(seg.lengthMm)}
                  </text>
                  {x += w + 4}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
