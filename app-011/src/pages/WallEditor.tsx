import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import type { Outlet, Plan } from '../types';
import { getWallSegments, formatMm } from '../utils/geometry';
import {
  DEFAULT_CIRCUIT_LIMIT_W,
  DEFAULT_POWER_BY_KIND,
  KIND_LABEL,
  MAINS_VOLTAGE,
  POWER_PRESETS,
  groupOutletsByCircuit,
  outletLabel,
  outletPower,
  suggestSplit,
} from '../utils/circuitCalc';

const KIND_CHAR: Record<Outlet['kind'], string> = {
  socket: '插',
  switch: '开',
  net: '网',
  light: '灯',
  water: '水',
};

export default function WallEditor() {
  const { id } = useParams<{ id: string }>();
  const {
    getPlan,
    addOutlet,
    updateOutlet,
    deleteOutlet,
    setCircuitLimitW,
    clearCircuitChecks,
  } = useStore();
  const plan = getPlan(id!);

  const [roomId, setRoomId] = useState('');
  const [wallIndex, setWallIndex] = useState('0');
  const [xMm, setXMm] = useState('0');
  const [heightMm, setHeightMm] = useState('300');
  const [kind, setKind] = useState<Outlet['kind']>('socket');
  const [circuit, setCircuit] = useState('');
  const [powerW, setPowerW] = useState(String(DEFAULT_POWER_BY_KIND.socket));
  const [frequent, setFrequent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const [expandedCircuit, setExpandedCircuit] = useState<string | null>(null);

  const selectedRoom = plan?.rooms.find((r) => r.id === roomId);
  const wallSegs = selectedRoom ? getWallSegments(selectedRoom) : [];
  const wallKey = selectedRoom ? `${selectedRoom.id}-${wallIndex}` : '';

  const resetForm = () => {
    setEditingId(null);
    setXMm('0');
    setHeightMm('300');
    setCircuit('');
    setPowerW(String(DEFAULT_POWER_BY_KIND[kind]));
    setFrequent(false);
  };

  const handleSubmit = () => {
    if (!plan || !wallKey) return;
    const fields = {
      wallKey,
      xMm: parseInt(xMm) || 0,
      heightMm: parseInt(heightMm) || 0,
      kind,
      circuit: circuit.trim() || undefined,
      powerW: Math.max(0, parseInt(powerW) || 0),
      frequent,
    };
    if (editingId) {
      updateOutlet(plan.id, editingId, (o) => ({ ...o, ...fields }));
      setEditingId(null);
    } else {
      addOutlet(plan.id, { id: Math.random().toString(36).slice(2), ...fields });
    }
  };

  const startEdit = (o: Outlet) => {
    const dash = o.wallKey.lastIndexOf('-');
    setRoomId(dash >= 0 ? o.wallKey.slice(0, dash) : '');
    setWallIndex(dash >= 0 ? o.wallKey.slice(dash + 1) : '0');
    setXMm(String(o.xMm));
    setHeightMm(String(o.heightMm));
    setKind(o.kind);
    setCircuit(o.circuit || '');
    setPowerW(String(outletPower(o)));
    setFrequent(!!o.frequent);
    setEditingId(o.id);
  };

  const handleDelete = (outletId: string) => {
    if (!plan) return;
    if (editingId === outletId) setEditingId(null);
    deleteOutlet(plan.id, outletId);
  };

  const commitLimit = () => {
    if (!plan || limitDraft === null) return;
    const v = parseInt(limitDraft);
    if (!Number.isNaN(v) && v > 0) setCircuitLimitW(plan.id, v);
    setLimitDraft(null);
  };

  const wallOutlets = plan?.outlets.filter((o) => o.wallKey === wallKey) || [];
  const allOutlets = plan?.outlets || [];
  const limitW = plan?.circuitLimitW ?? DEFAULT_CIRCUIT_LIMIT_W;
  const circuitGroups = plan ? groupOutletsByCircuit(plan.outlets, limitW) : [];
  const overloadedGroups = circuitGroups.filter((g) => g.overLimit);
  const unassignedCount = allOutlets.filter((o) => !(o.circuit || '').trim()).length;
  const checks = plan?.circuitChecks ?? [];

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
        <span>回路: <strong>{circuitGroups.length}</strong></span>
        <span>
          超载回路:{' '}
          <strong style={overloadedGroups.length > 0 ? { color: '#e74c3c' } : undefined}>
            {overloadedGroups.length}
          </strong>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 320, flexShrink: 0 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>
              {editingId ? '编辑点位' : '添加点位'}
            </h3>
            <div className="form-group">
              <label>房间</label>
              <select
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setWallIndex('0');
                }}
              >
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
                  <select
                    value={kind}
                    onChange={(e) => {
                      const k = e.target.value as Outlet['kind'];
                      setKind(k);
                      setPowerW(String(DEFAULT_POWER_BY_KIND[k]));
                    }}
                  >
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
                  <label>预计功率 (W)</label>
                  <input
                    type="number"
                    min="0"
                    value={powerW}
                    onChange={(e) => setPowerW(e.target.value)}
                  />
                  <select
                    value=""
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!Number.isNaN(v)) setPowerW(String(v));
                    }}
                    style={{ marginTop: 4 }}
                  >
                    <option value="">按常见电器快速填…</option>
                    {POWER_PRESETS.map((p) => (
                      <option key={p.label} value={p.watts}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2c3e50' }}>
                    <input
                      type="checkbox"
                      checked={frequent}
                      onChange={(e) => setFrequent(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    常用点位（长期/高频使用）
                  </label>
                </div>

                <button className="btn btn-primary" onClick={handleSubmit} style={{ width: '100%' }}>
                  {editingId ? '保存修改' : '添加点位'}
                </button>
                {editingId && (
                  <button
                    className="btn btn-secondary"
                    onClick={resetForm}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    取消编辑
                  </button>
                )}
              </>
            )}
          </div>

          {wallOutlets.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>当前墙面点位</h4>
              {wallOutlets.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid #ecf0f1',
                    fontSize: 13,
                  }}
                >
                  <span>
                    {KIND_LABEL[o.kind]} @{formatMm(o.xMm)} 高{formatMm(o.heightMm)}
                    {o.circuit ? ` (${o.circuit})` : ''}
                    {` ${outletPower(o)}W`}
                    {o.frequent && (
                      <em
                        style={{
                          fontStyle: 'normal',
                          fontSize: 11,
                          color: '#fff',
                          background: '#16a085',
                          borderRadius: 3,
                          padding: '1px 4px',
                          marginLeft: 4,
                        }}
                      >
                        常用
                      </em>
                    )}
                  </span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary" onClick={() => startEdit(o)}>
                      编辑
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(o.id)}>
                      删除
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>墙面展开图</h3>
            <WallDiagram plan={plan} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontSize: 16 }}>回路负载核算</h3>
              <label style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                安全上限
                <input
                  type="number"
                  min="1"
                  value={limitDraft ?? String(limitW)}
                  onChange={(e) => setLimitDraft(e.target.value)}
                  onBlur={commitLimit}
                  onKeyDown={(e) => e.key === 'Enter' && commitLimit()}
                  style={{ width: 90, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }}
                />
                W/回路 ≈ {(limitW / MAINS_VOLTAGE).toFixed(1)}A
              </label>
            </div>

            {overloadedGroups.length > 0 && (
              <div
                style={{
                  background: '#fdedec',
                  border: '1px solid #e74c3c',
                  color: '#c0392b',
                  borderRadius: 4,
                  padding: '10px 12px',
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                ⚠ 回路 {overloadedGroups.map((g) => g.name).join('、')} 超出安全上限，请拆分回路或降低设备功率
              </div>
            )}

            {circuitGroups.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13 }}>
                还没有点位填写回路。给点位填上回路（如 L1）和功率后，这里会自动按回路汇总负载。
              </p>
            ) : (
              circuitGroups.map((g) => {
                const pct = Math.round((g.totalW / g.limitW) * 100);
                const expanded = expandedCircuit === g.name;
                return (
                  <div
                    key={g.name}
                    style={{
                      border: g.overLimit ? '2px solid #e74c3c' : '1px solid #ecf0f1',
                      background: g.overLimit ? '#fdedec' : '#fff',
                      borderRadius: 6,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>
                        <strong>{g.name}</strong>{' '}
                        {g.overLimit && (
                          <em
                            style={{
                              fontStyle: 'normal',
                              fontSize: 12,
                              color: '#fff',
                              background: '#e74c3c',
                              borderRadius: 3,
                              padding: '1px 6px',
                            }}
                          >
                            ⚠ 超载
                          </em>
                        )}{' '}
                        <span style={{ color: g.overLimit ? '#c0392b' : '#2c3e50' }}>
                          合计 <strong>{g.totalW}W</strong> / 上限 {g.limitW}W（{pct}%）
                        </span>{' '}
                        <span style={{ color: '#888', fontSize: 13 }}>
                          常用 {g.frequentW}W · ≈{(g.totalW / MAINS_VOLTAGE).toFixed(1)}A ·{' '}
                          {g.outlets.length} 个点位
                        </span>
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setExpandedCircuit(expanded ? null : g.name)}
                      >
                        {expanded ? '收起' : '点位明细'}
                      </button>
                    </div>

                    <div
                      style={{
                        height: 6,
                        background: '#ecf0f1',
                        borderRadius: 3,
                        marginTop: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          height: '100%',
                          background: g.overLimit ? '#e74c3c' : pct >= 80 ? '#f39c12' : '#27ae60',
                        }}
                      />
                    </div>

                    {expanded && (
                      <div style={{ marginTop: 10 }}>
                        {g.outlets.map((o) => (
                          <div
                            key={o.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 13,
                              padding: '4px 0',
                              borderBottom: '1px dashed #ecf0f1',
                            }}
                          >
                            <span>
                              {outletLabel(o, plan.rooms)} 高{formatMm(o.heightMm)}
                              {o.frequent && (
                                <em
                                  style={{
                                    fontStyle: 'normal',
                                    fontSize: 11,
                                    color: '#fff',
                                    background: '#16a085',
                                    borderRadius: 3,
                                    padding: '1px 4px',
                                    marginLeft: 4,
                                  }}
                                >
                                  常用
                                </em>
                              )}
                            </span>
                            <span>{outletPower(o)}W</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {g.overLimit && <OverloadAdvice group={g} rooms={plan.rooms} />}
                  </div>
                );
              })
            )}

            {unassignedCount > 0 && (
              <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                另有 {unassignedCount} 个点位未设回路，不参与负载核算。
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontSize: 16 }}>超载判定记录（{checks.length}）</h3>
              {checks.length > 0 && (
                <button className="btn btn-secondary" onClick={() => clearCircuitChecks(plan.id)}>
                  清空记录
                </button>
              )}
            </div>
            {checks.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13 }}>
                暂无记录。每次判定出回路超载时，会把结论和当时的点位明细留在这里，便于回翻。
              </p>
            ) : (
              [...checks].reverse().map((c) => (
                <div
                  key={c.id}
                  style={{
                    borderLeft: '3px solid #e74c3c',
                    background: '#fdf6f5',
                    padding: '8px 12px',
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <strong>{new Date(c.at).toLocaleString()}</strong> · 回路{' '}
                    <strong>{c.circuit}</strong> 判定超载：合计{' '}
                    <strong style={{ color: '#c0392b' }}>{c.totalW}W</strong> / 上限 {c.limitW}W
                  </div>
                  <div style={{ color: '#666' }}>
                    当时点位（{c.outlets.length}）：
                    {c.outlets.map((o) => (
                      <span
                        key={o.id}
                        style={{
                          display: 'inline-block',
                          background: '#fff',
                          border: '1px solid #f0c4bd',
                          borderRadius: 3,
                          padding: '1px 6px',
                          margin: '2px 4px 2px 0',
                          fontSize: 12,
                        }}
                      >
                        {KIND_LABEL[o.kind]} {o.powerW}W{o.frequent ? '·常用' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverloadAdvice({ group, rooms }: { group: ReturnType<typeof groupOutletsByCircuit>[number]; rooms: Plan['rooms'] }) {
  const excess = group.totalW - group.limitW;
  const split = suggestSplit(group);
  const newCircuit = `${group.name}-2`;
  const top = [...group.outlets].sort((a, b) => outletPower(b) - outletPower(a)).slice(0, 3);
  const loneOverload = split.move.some((o) => outletPower(o) > group.limitW);

  return (
    <div
      style={{
        marginTop: 10,
        background: '#fff',
        border: '1px solid #f0c4bd',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
        color: '#7b241c',
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 4 }}>超出 {excess}W，处理建议：</div>
      <div>
        ① 拆成两路：把{' '}
        {split.move.map((o) => `${outletLabel(o, rooms)}（${outletPower(o)}W）`).join('、')}
        {' '}挪到新回路 {newCircuit}，本路剩余 {split.restW}W 即达标。
        {loneOverload && ' 注意：被挪走的点位中有的单点功率已超过上限，需单独拉专线并换用低功率设备。'}
      </div>
      <div>
        ② 换低功率设备：本路至少需降 {excess}W；功率最大的是{' '}
        {top.map((o) => `${outletLabel(o, rooms)}（${outletPower(o)}W）`).join('、')}
        ，优先更换或错开使用。
      </div>
      {group.frequentW <= group.limitW && (
        <div style={{ color: '#888', marginTop: 4 }}>
          注：常用点位合计 {group.frequentW}W 未超限，若非常用设备不会同时开启，可与电工确认按同时使用系数折减；按满载核算仍建议处理。
        </div>
      )}
    </div>
  );
}

function WallDiagram({ plan }: { plan: Plan }) {
  const wallHeight = 120;
  const wallGap = 20;
  let y = 20;

  const limitW = plan.circuitLimitW ?? DEFAULT_CIRCUIT_LIMIT_W;
  const overloaded = new Set(
    groupOutletsByCircuit(plan.outlets, limitW)
      .filter((g) => g.overLimit)
      .map((g) => g.name)
  );

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
                    const color =
                      o.kind === 'socket'
                        ? '#e74c3c'
                        : o.kind === 'switch'
                        ? '#3498db'
                        : o.kind === 'net'
                        ? '#9b59b6'
                        : o.kind === 'light'
                        ? '#f39c12'
                        : '#1abc9c';
                    const pw = outletPower(o);
                    const isOver = !!o.circuit && overloaded.has(o.circuit.trim());
                    return (
                      <g key={o.id}>
                        <title>
                          {`${KIND_LABEL[o.kind]} ${pw}W${o.circuit ? ` 回路${o.circuit}` : ''}${o.frequent ? ' 常用' : ''}${isOver ? ' ⚠回路超载' : ''}`}
                        </title>
                        <circle cx={ox} cy={oy} r={5} fill={color} stroke="white" strokeWidth={1} />
                        {isOver && (
                          <text x={ox} y={oy - 16} fontSize="9" fill="#e74c3c" textAnchor="middle">
                            ⚠
                          </text>
                        )}
                        <text x={ox} y={oy - 8} fontSize="8" fill={color} textAnchor="middle">
                          {KIND_CHAR[o.kind]}
                          {pw > 0 ? `${pw}W` : ''}
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
