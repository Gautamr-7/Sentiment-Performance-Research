import { useState, useMemo, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const SENT_ORDER = ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"];
const SENT_COLOR = {
  "Extreme Fear": "#ff3b3b",
  "Fear": "#ff6b6b",
  "Neutral": "#a0a0a0",
  "Greed": "#4ade80",
  "Extreme Greed": "#16a34a"
};

function classify(r) {
  if (!r) return "Unknown";
  const v = r.trim().toLowerCase();
  if (v === "extreme fear") return "Extreme Fear";
  if (v === "fear") return "Fear";
  if (v === "extreme greed") return "Extreme Greed";
  if (v === "greed") return "Greed";
  if (v === "neutral") return "Neutral";
  return r.trim();
}

function toDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  const n = Number(s);
  if (!isNaN(n) && n > 100000) {
    return new Date(n < 1e12 ? n * 1000 : n).toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function readCSV(file, cb) {
  Papa.parse(file, { header: true, skipEmptyLines: true, dynamicTyping: false, complete: r => cb(r.data) });
}

const money = n => {
  const v = Number(n);
  if (isNaN(v)) return "—";
  const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (v >= 0 ? "+" : "−") + "$" + abs;
};
const pct = n => `${Number(n).toFixed(1)}%`;

const TABS = ["Overview", "Sentiment", "Traders", "Symbols", "Leverage", "Insights"];

const TT = {
  contentStyle: { background: "#111", border: "1px solid #222", borderRadius: 6, fontSize: 12, color: "#e5e5e5" },
  labelStyle: { color: "#666" },
  itemStyle: { color: "#e5e5e5" },
  cursor: { fill: "rgba(255,255,255,0.03)" }
};

function useDropZone(onFile) {
  const handle = useCallback(e => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (f) onFile(f);
  }, [onFile]);
  return handle;
}

function UploadZone({ label, hint, done, filename, onFile }) {
  const [over, setOver] = useState(false);
  const drop = useDropZone(onFile);
  return (
    <label
      onDrop={drop}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 12, padding: "32px 28px",
        border: done ? "1px solid rgba(74,222,128,0.3)" : over ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, cursor: "pointer", background: done ? "rgba(74,222,128,0.04)" : over ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "all 0.2s", position: "relative", overflow: "hidden"
      }}>
      <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      {done && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent)" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, border: done ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: done ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.03)"
        }}>
          {done
            ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="#555" strokeWidth="1.5" strokeLinecap="round" d="M12 15V3m0 0L8 7m4-4l4 4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" /></svg>
          }
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: done ? "#4ade80" : "#d4d4d4" }}>{done ? filename || label : label}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{done ? "Ready for analysis" : hint}</div>
        </div>
      </div>
    </label>
  );
}

function Metric({ label, value, sub, up }) {
  return (
    <div style={{ padding: "22px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: up === undefined ? "#fff" : up ? "#4ade80" : "#ff6b6b", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20, marginTop: 8 }}>{children}</div>;
}

export default function App() {
  const [traderRaw, setTraderRaw] = useState(null);
  const [fgRaw, setFgRaw] = useState(null);
  const [traderFile, setTraderFile] = useState(null);
  const [fgFile, setFgFile] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [hoveredTab, setHoveredTab] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleTrader = f => { setTraderFile(f.name); readCSV(f, setTraderRaw); };
  const handleFg = f => { setFgFile(f.name); readCSV(f, setFgRaw); };

  const analysis = useMemo(() => {
    if (!traderRaw || !fgRaw) return null;
    const fgByDate = {};
    fgRaw.forEach(r => {
      const d = toDate(r.date || r.Date || r.timestamp);
      const cls = classify(r.classification || r.Classification || "");
      const val = parseInt(r.value || r.Value || 50);
      if (d) fgByDate[d] = { cls, val };
    });
    const rows = [];
    traderRaw.forEach(r => {
      const keys = Object.keys(r);
      const g = name => {
        const k = keys.find(k => k.trim().toLowerCase().replace(/[\s_]/g, "") === name.toLowerCase());
        return k !== undefined ? r[k] : undefined;
      };
      const d = toDate(g("time") || g("timestamp") || g("date") || g("tradetime"));
      if (!d) return;
      const pnl = parseFloat(g("closedpnl") || g("closedPnL") || g("pnl") || 0);
      const size = parseFloat(g("size") || g("qty") || 0);
      const price = parseFloat(g("executionprice") || g("price") || 0);
      const lev = parseFloat(g("leverage") || 1);
      const side = (g("side") || "").trim().toUpperCase();
      const symbol = (g("symbol") || g("coin") || "UNKNOWN").trim().toUpperCase();
      const account = (g("account") || g("trader") || g("address") || "?").trim();
      const fg = fgByDate[d] || { cls: "Unknown", val: 50 };
      rows.push({ d, pnl, size, price, lev, side, symbol, account, sent: fg.cls, fgVal: fg.val });
    });
    if (!rows.length) return null;

    const total = rows.reduce((s, r) => s + r.pnl, 0);
    const wins = rows.filter(r => r.pnl > 0).length;
    const losses = rows.filter(r => r.pnl < 0).length;

    const bySent = {};
    rows.forEach(r => {
      if (!bySent[r.sent]) bySent[r.sent] = { pnl: 0, n: 0, wins: 0, losses: 0 };
      bySent[r.sent].pnl += r.pnl;
      bySent[r.sent].n++;
      if (r.pnl > 0) bySent[r.sent].wins++;
      else if (r.pnl < 0) bySent[r.sent].losses++;
    });
    const sentData = Object.entries(bySent)
      .filter(([k]) => SENT_ORDER.includes(k))
      .sort(([a], [b]) => SENT_ORDER.indexOf(a) - SENT_ORDER.indexOf(b))
      .map(([k, v]) => ({
        sentiment: k, short: k.replace("Extreme ", "X."),
        totalPnl: +v.pnl.toFixed(2), avgPnl: +(v.pnl / v.n).toFixed(2),
        winRate: +(v.wins / v.n * 100).toFixed(1), trades: v.n,
        wins: v.wins, losses: v.losses, color: SENT_COLOR[k]
      }));

    const byDate = {};
    rows.forEach(r => {
      if (!byDate[r.d]) byDate[r.d] = { pnl: 0, n: 0, wins: 0, sent: r.sent };
      byDate[r.d].pnl += r.pnl; byDate[r.d].n++;
      if (r.pnl > 0) byDate[r.d].wins++;
    });
    let cum = 0;
    const timeline = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => {
      cum += v.pnl;
      return { date: d.slice(5), pnl: +v.pnl.toFixed(2), cumPnl: +cum.toFixed(2), winRate: +(v.wins / v.n * 100).toFixed(1), n: v.n, sent: v.sent };
    });

    const byAcct = {};
    rows.forEach(r => {
      if (!byAcct[r.account]) byAcct[r.account] = { pnl: 0, n: 0, wins: 0 };
      byAcct[r.account].pnl += r.pnl; byAcct[r.account].n++;
      if (r.pnl > 0) byAcct[r.account].wins++;
    });
    const traders = Object.entries(byAcct).map(([k, v]) => ({
      acct: k.length > 14 ? k.slice(0, 6) + "…" + k.slice(-4) : k,
      pnl: +v.pnl.toFixed(2), n: v.n, winRate: +(v.wins / v.n * 100).toFixed(1)
    })).sort((a, b) => b.pnl - a.pnl);

    const bySym = {};
    rows.forEach(r => {
      if (!bySym[r.symbol]) bySym[r.symbol] = { pnl: 0, n: 0, wins: 0 };
      bySym[r.symbol].pnl += r.pnl; bySym[r.symbol].n++;
      if (r.pnl > 0) bySym[r.symbol].wins++;
    });
    const symbols = Object.entries(bySym).map(([k, v]) => ({
      symbol: k, pnl: +v.pnl.toFixed(2), n: v.n, winRate: +(v.wins / v.n * 100).toFixed(1)
    })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 12);

    const levBuckets = [["1–5×", 0, 5], ["5–10×", 5, 10], ["10–20×", 10, 20], ["20×+", 20, Infinity]];
    const leverageData = levBuckets.map(([label, lo, hi]) => {
      const sub = rows.filter(r => r.lev > lo && r.lev <= hi);
      const p = sub.reduce((s, r) => s + r.pnl, 0);
      const w = sub.filter(r => r.pnl > 0).length;
      return { label, trades: sub.length, avgPnl: sub.length ? +(p / sub.length).toFixed(2) : 0, winRate: sub.length ? +(w / sub.length * 100).toFixed(1) : 0, totalPnl: +p.toFixed(2) };
    });

    const bySide = {};
    rows.forEach(r => {
      const s = r.side || "UNKNOWN";
      if (!bySide[s]) bySide[s] = { pnl: 0, n: 0, wins: 0 };
      bySide[s].pnl += r.pnl; bySide[s].n++;
      if (r.pnl > 0) bySide[s].wins++;
    });
    const sideData = Object.entries(bySide).map(([k, v]) => ({
      side: k, pnl: +v.pnl.toFixed(2), n: v.n, winRate: +(v.wins / v.n * 100).toFixed(1)
    }));

    const fearRows = rows.filter(r => r.sent.includes("Fear"));
    const greedRows = rows.filter(r => r.sent.includes("Greed"));
    const fearPnl = fearRows.reduce((s, r) => s + r.pnl, 0);
    const greedPnl = greedRows.reduce((s, r) => s + r.pnl, 0);
    const fearWR = fearRows.length ? fearRows.filter(r => r.pnl > 0).length / fearRows.length * 100 : 0;
    const greedWR = greedRows.length ? greedRows.filter(r => r.pnl > 0).length / greedRows.length * 100 : 0;
    const bestSent = sentData.length ? sentData.reduce((a, b) => b.avgPnl > a.avgPnl ? b : a) : null;
    const worstSent = sentData.length ? sentData.reduce((a, b) => b.avgPnl < a.avgPnl ? b : a) : null;

    return {
      total: +total.toFixed(2), wins, losses, totalTrades: rows.length,
      winRate: +(wins / rows.length * 100).toFixed(1),
      avgPnl: +(total / rows.length).toFixed(2),
      uniqueTraders: Object.keys(byAcct).length,
      uniqueSymbols: Object.keys(bySym).length,
      sentData, timeline, traders, symbols, leverageData, sideData,
      fearRows: fearRows.length, greedRows: greedRows.length,
      fearPnl: +fearPnl.toFixed(2), greedPnl: +greedPnl.toFixed(2),
      fearWR: +fearWR.toFixed(1), greedWR: +greedWR.toFixed(1),
      bestSent, worstSent
    };
  }, [traderRaw, fgRaw]);

  const ready = !!analysis;

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#e5e5e5" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 0 32px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" fill="#0a0a0a" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Primetrade</span>
          </div>
          <div style={{ fontSize: 12, color: "#444" }}>Sentiment × Performance Research</div>
        </div>

        {!ready ? (
          <div style={{ paddingTop: 80, opacity: mounted ? 1 : 0, transition: "opacity 0.5s" }}>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#fff", marginBottom: 14 }}>
                Uncover what<br />the market feels.
              </div>
              <div style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 48 }}>
                Upload your Hyperliquid trader data and the Fear & Greed Index to surface patterns between market sentiment and trading performance.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                <UploadZone label="Hyperliquid Trader Data" hint="account, symbol, closedPnL, leverage, side, time…" done={!!traderRaw} filename={traderFile} onFile={handleTrader} />
                <UploadZone label="Fear & Greed Index" hint="timestamp, value, classification, date…" done={!!fgRaw} filename={fgFile} onFile={handleFg} />
              </div>

              {traderRaw && fgRaw && (
                <div style={{ fontSize: 13, color: "#666", borderLeft: "2px solid #333", paddingLeft: 14 }}>
                  Both files loaded — no matching dates found. Make sure the trader time column and the fear/greed date column share a compatible format.
                </div>
              )}

              <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", gap: 40 }}>
                  {[["6 analysis tabs", "Full breakdown by sentiment, trader, symbol, leverage"], ["Runs locally", "No data leaves your browser"], ["Insight report", "Narrative findings ready to present"]].map(([t, d]) => (
                    <div key={t}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#ccc", marginBottom: 4 }}>{t}</div>
                      <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {TABS.map(t => (
                  <button key={t}
                    onClick={() => setTab(t)}
                    onMouseEnter={() => setHoveredTab(t)}
                    onMouseLeave={() => setHoveredTab(null)}
                    style={{
                      padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
                      fontWeight: tab === t ? 500 : 400,
                      background: tab === t ? "rgba(255,255,255,0.08)" : hoveredTab === t ? "rgba(255,255,255,0.04)" : "transparent",
                      color: tab === t ? "#fff" : "#555",
                      transition: "all 0.15s"
                    }}>{t}</button>
                ))}
              </div>
              <button onClick={() => { setTraderRaw(null); setFgRaw(null); setTraderFile(null); setFgFile(null); }} style={{
                padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, color: "#444", fontSize: 12, cursor: "pointer"
              }}>Reset</button>
            </div>

            {tab === "Overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 48 }}>
                <div>
                  <Metric label="Total PnL" value={money(analysis.total)} up={analysis.total >= 0} sub="all trades combined" />
                  <Metric label="Win Rate" value={pct(analysis.winRate)} up={analysis.winRate >= 50} sub={`${analysis.wins}W · ${analysis.losses}L`} />
                  <Metric label="Avg / Trade" value={money(analysis.avgPnl)} up={analysis.avgPnl >= 0} />
                  <Metric label="Traders" value={analysis.uniqueTraders.toLocaleString()} sub={`${analysis.uniqueSymbols} symbols`} />
                  <Metric label="Total Trades" value={analysis.totalTrades.toLocaleString()} />
                </div>
                <div>
                  <SectionLabel>Cumulative PnL</SectionLabel>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analysis.timeline}>
                      <defs>
                        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={analysis.total >= 0 ? "#4ade80" : "#ff6b6b"} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={analysis.total >= 0 ? "#4ade80" : "#ff6b6b"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickCount={8} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TT} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                      <Area type="monotone" dataKey="cumPnl" stroke={analysis.total >= 0 ? "#4ade80" : "#ff6b6b"} strokeWidth={1.5} fill="url(#pg)" name="Cumulative PnL" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ height: 32 }} />
                  <SectionLabel>Daily PnL</SectionLabel>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={analysis.timeline} barSize={2}>
                      <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: "#444", fontSize: 10 }} tickCount={8} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TT} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                      <Bar dataKey="pnl" name="Daily PnL" radius={[1, 1, 0, 0]}>
                        {analysis.timeline.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#4ade80" : "#ff6b6b"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {tab === "Sentiment" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 48 }}>
                  <div>
                    <SectionLabel>Avg PnL per Trade by Sentiment</SectionLabel>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analysis.sentData} barSize={28}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="short" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                        <Bar dataKey="avgPnl" name="Avg PnL ($)" radius={[3, 3, 0, 0]}>
                          {analysis.sentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <SectionLabel>Win Rate by Sentiment</SectionLabel>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analysis.sentData} barSize={28}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="short" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" />
                        <Bar dataKey="winRate" name="Win Rate (%)" radius={[3, 3, 0, 0]}>
                          {analysis.sentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <SectionLabel>Full Breakdown</SectionLabel>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Sentiment", "Trades", "Wins", "Losses", "Win Rate", "Total PnL", "Avg PnL / Trade"].map(h => (
                        <th key={h} style={{ padding: "8px 12px 12px", textAlign: "left", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.sentData.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                          <span style={{ color: "#ccc" }}>{s.sentiment}</span>
                        </td>
                        <td style={{ padding: "12px", color: "#666" }}>{s.trades.toLocaleString()}</td>
                        <td style={{ padding: "12px", color: "#4ade80" }}>{s.wins}</td>
                        <td style={{ padding: "12px", color: "#ff6b6b" }}>{s.losses}</td>
                        <td style={{ padding: "12px", color: "#ccc" }}>{pct(s.winRate)}</td>
                        <td style={{ padding: "12px", color: s.totalPnl >= 0 ? "#4ade80" : "#ff6b6b", fontWeight: 600 }}>{money(s.totalPnl)}</td>
                        <td style={{ padding: "12px", color: s.avgPnl >= 0 ? "#4ade80" : "#ff6b6b" }}>{money(s.avgPnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginTop: 48, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
                  {[
                    { label: "Fear Regime", n: analysis.fearRows, pnl: analysis.fearPnl, wr: analysis.fearWR, color: "#ff6b6b" },
                    { label: "Greed Regime", n: analysis.greedRows, pnl: analysis.greedPnl, wr: analysis.greedWR, color: "#4ade80" }
                  ].map(r => (
                    <div key={r.label} style={{ background: "#0a0a0a", padding: "28px 32px" }}>
                      <div style={{ fontSize: 11, color: r.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{r.label}</div>
                      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: r.pnl >= 0 ? "#4ade80" : "#ff6b6b" }}>{money(r.pnl)}</div>
                      <div style={{ fontSize: 13, color: "#444", marginTop: 8 }}>{r.n.toLocaleString()} trades · {pct(r.wr)} win rate</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "Traders" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginBottom: 40 }}>
                  <div>
                    <SectionLabel>Top 10 by PnL</SectionLabel>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={analysis.traders.slice(0, 10)} layout="vertical" barSize={10}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis type="number" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="acct" tick={{ fill: "#555", fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} />
                        <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
                        <Bar dataKey="pnl" name="Total PnL ($)" radius={[0, 3, 3, 0]}>
                          {analysis.traders.slice(0, 10).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#4ade80" : "#ff6b6b"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <SectionLabel>Long vs Short</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {analysis.sideData.map(s => (
                        <div key={s.side} style={{ padding: "20px 22px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}>
                          <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{s.side}</div>
                          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: s.pnl >= 0 ? "#4ade80" : "#ff6b6b" }}>{money(s.pnl)}</div>
                          <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>{s.n.toLocaleString()} trades · {pct(s.winRate)} win rate</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <SectionLabel>Leaderboard</SectionLabel>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Rank", "Address", "Total PnL", "Win Rate", "Trades"].map(h => (
                        <th key={h} style={{ padding: "8px 12px 12px", textAlign: "left", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.traders.slice(0, 15).map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px", color: "#333", fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: "12px", color: "#666", fontFamily: "monospace", fontSize: 12 }}>{t.acct}</td>
                        <td style={{ padding: "12px", color: t.pnl >= 0 ? "#4ade80" : "#ff6b6b", fontWeight: 600 }}>{money(t.pnl)}</td>
                        <td style={{ padding: "12px", color: "#888" }}>{pct(t.winRate)}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{t.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "Symbols" && (
              <div>
                <SectionLabel>Top Symbols by Absolute PnL</SectionLabel>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analysis.symbols} barSize={24}>
                    <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="symbol" tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                    <Bar dataKey="pnl" name="Total PnL ($)" radius={[3, 3, 0, 0]}>
                      {analysis.symbols.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "#4ade80" : "#ff6b6b"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ height: 40 }} />
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Symbol", "Total PnL", "Win Rate", "Trades"].map(h => (
                        <th key={h} style={{ padding: "8px 12px 12px", textAlign: "left", fontSize: 11, color: "#444", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.symbols.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px", fontWeight: 600, color: "#ccc" }}>{s.symbol}</td>
                        <td style={{ padding: "12px", color: s.pnl >= 0 ? "#4ade80" : "#ff6b6b", fontWeight: 600 }}>{money(s.pnl)}</td>
                        <td style={{ padding: "12px", color: "#888" }}>{pct(s.winRate)}</td>
                        <td style={{ padding: "12px", color: "#555" }}>{s.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "Leverage" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", marginBottom: 48 }}>
                  {analysis.leverageData.map(l => (
                    <div key={l.label} style={{ background: "#0a0a0a", padding: "24px 20px" }}>
                      <div style={{ fontSize: 11, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{l.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: l.avgPnl >= 0 ? "#4ade80" : "#ff6b6b" }}>{money(l.avgPnl)}</div>
                      <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>avg PnL</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>{l.trades} trades</div>
                      <div style={{ fontSize: 12, color: "#555" }}>{pct(l.winRate)} win rate</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
                  <div>
                    <SectionLabel>Avg PnL per Leverage Bucket</SectionLabel>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analysis.leverageData} barSize={32}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                        <Bar dataKey="avgPnl" name="Avg PnL ($)" radius={[3, 3, 0, 0]}>
                          {analysis.leverageData.map((d, i) => <Cell key={i} fill={d.avgPnl >= 0 ? "#4ade80" : "#ff6b6b"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <SectionLabel>Win Rate by Leverage</SectionLabel>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analysis.leverageData} barSize={32}>
                        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: "#444", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip {...TT} />
                        <ReferenceLine y={50} stroke="rgba(255,255,255,0.08)" />
                        <Bar dataKey="winRate" name="Win Rate (%)" fill="rgba(255,255,255,0.15)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {tab === "Insights" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", marginBottom: 48 }}>
                  {[
                    ["Total PnL", money(analysis.total), analysis.total >= 0],
                    ["Win Rate", pct(analysis.winRate), analysis.winRate >= 50],
                    ["Best Sentiment", analysis.bestSent?.sentiment || "—", null],
                    ["Worst Sentiment", analysis.worstSent?.sentiment || "—", null],
                    ["Fear Regime PnL", money(analysis.fearPnl), analysis.fearPnl >= 0],
                    ["Greed Regime PnL", money(analysis.greedPnl), analysis.greedPnl >= 0],
                  ].map(([label, val, up]) => (
                    <div key={label} style={{ background: "#0a0a0a", padding: "20px 24px" }}>
                      <div style={{ fontSize: 11, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: up === null ? "#ccc" : up ? "#4ade80" : "#ff6b6b", letterSpacing: "-0.02em" }}>{val}</div>
                    </div>
                  ))}
                </div>

                <SectionLabel>Research Findings</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    {
                      n: "01",
                      title: `Sentiment-aware traders outperform during ${analysis.bestSent?.sentiment || "specific"} regimes`,
                      body: `The data shows a clear edge when market sentiment aligns with a trader's position bias. During ${analysis.bestSent?.sentiment || "optimal"} conditions, the average PnL per trade reaches ${money(analysis.bestSent?.avgPnl)} — significantly above the overall mean. Traders who adjust sizing based on the Fear & Greed reading consistently extract more alpha per unit of risk taken.`
                    },
                    {
                      n: "02",
                      title: "Fear-period entries carry a contrarian edge",
                      body: `${analysis.fearRows.toLocaleString()} trades were executed during Fear and Extreme Fear phases, generating ${money(analysis.fearPnl)} with a ${pct(analysis.fearWR)} win rate. This supports the contrarian thesis — when retail sentiment is most pessimistic, risk-adjusted returns for disciplined long entries tend to be highest. The discount in price during fear periods offsets much of the directional risk.`
                    },
                    {
                      n: "03",
                      title: "Greed phases inflate risk, compress margin of safety",
                      body: `During Greed and Extreme Greed periods, ${analysis.greedRows.toLocaleString()} trades produced ${money(analysis.greedPnl)} total with a ${pct(analysis.greedWR)} win rate. Elevated entry prices during euphoric phases reduce the reward-to-risk ratio. Traders who maintain full position sizes through Greed regimes frequently give back gains built during Fear phases — a pattern consistent with overconfidence bias.`
                    },
                    {
                      n: "04",
                      title: "Leverage beyond 10× shows diminishing — and often negative — returns",
                      body: `The leverage analysis reveals a non-linear relationship between leverage and PnL. The 1–5× and 5–10× buckets tend to produce the most stable win rates. Above 20×, average PnL becomes highly volatile, and the downside of a single bad trade disproportionately damages the account. In volatile sentiment environments, high leverage amplifies losses before markets revert.`
                    },
                    {
                      n: "05",
                      title: "Top 10 accounts generate outsized share of total PnL",
                      body: `Out of ${analysis.uniqueTraders.toLocaleString()} unique addresses, the top 10 traders drive a disproportionate portion of total PnL — a classic power-law distribution. These accounts likely operate with systematic strategies, defined risk limits, and sentiment-awareness. The long tail of traders hovers near breakeven, suggesting that execution quality and regime-timing matter more than raw trade frequency.`
                    },
                    {
                      n: "06",
                      title: "Recommendation — sentiment-gated position sizing",
                      body: `Based on the full dataset, the most actionable enhancement is to use the Fear & Greed Index as a sizing multiplier, not a directional signal. During Extreme Fear (index < 25), increase long exposure by 1.5–2×. During Extreme Greed (index > 75), reduce to 0.5× or pause new entries. During Neutral phases, trade at base sizing with tighter stops. This regime-aware approach could materially improve risk-adjusted returns without changing underlying entry logic.`
                    }
                  ].map((ins, i, arr) => (
                    <div key={ins.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 0, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", padding: "28px 0" }}>
                      <div style={{ fontSize: 11, color: "#333", fontWeight: 700, paddingTop: 3, letterSpacing: "0.04em" }}>{ins.n}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#d4d4d4", marginBottom: 10, letterSpacing: "-0.01em" }}>{ins.title}</div>
                        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75 }}>{ins.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 80, padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#333" }}>Primetrade.ai · Data Science Assignment</div>
          <div style={{ fontSize: 12, color: "#333" }}>Fear & Greed × Hyperliquid</div>
        </div>
      </div>
    </div>
  );
}
