import { Judge } from "./judge/judge.js";
import * as Auth from "./auth.js";

const judge = new Judge("judge/");
const app = document.getElementById("app");
const statusEl = document.getElementById("judgeStatus");
let problems = null;

// Линкерт өгсөн stack-ийн хэмжээ (judge/shared.js: 64MB). Санах ойн баганад үүнийг хасч харуулна.
const STACK_BYTES = 64 * 1024 * 1024;

const TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`;

// ---------- туслах ----------
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Ахиц (оноо, код) хэрэглэгч бүрт тусдаа: нэвтэрсэн бол "bg:u:<id>:best:..." түлхүүрээр хадгална.
// Нэвтрээгүй (зочин) үед хуучин шигээ "bg:best:..." түлхүүр ашиглана.
const userScope = () => {
  const u = Auth.currentUser();
  const id = u && (u.uid || u.email);
  return id ? "u:" + id + ":" : "";
};
const scoped = (k) => (/^(best|code):/.test(k) ? userScope() + k : k);
const store = {
  get(k, d = null) {
    try {
      const v = localStorage.getItem("bg:" + scoped(k));
      return v === null ? d : JSON.parse(v);
    } catch (_) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("bg:" + scoped(k), JSON.stringify(v));
    } catch (_) {}
  },
};
const textCache = new Map();
async function fetchText(url) {
  if (textCache.has(url)) return textCache.get(url);
  const p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(url + ": " + r.status);
    return r.text();
  });
  textCache.set(url, p);
  return p;
}
const clip = (s, n = 2000) =>
  s.length > n ? s.slice(0, n) + `\n… (${s.length - n} тэмдэгт таслав)` : s;
const VERDICT_MN = {
  AC: "Зөв",
  WA: "Буруу хариу",
  TLE: "Хугацаа хэтэрсэн",
  RE: "Ажиллах үеийн алдаа",
  MLE: "Санах ой хэтэрсэн",
  OLE: "Гаралт хэт их",
  CE: "Хөрвүүлэлтийн алдаа",
};

function setStatus(text, cls) {
  statusEl.textContent = "Шалгагч: " + text;
  statusEl.className = "judge-status " + (cls || "");
}

let judgeInit = null;
function ensureJudge() {
  if (!judgeInit) {
    setStatus("clang ачаалж байна (~50MB, эхний удаа)…", "loading");
    judgeInit = judge
      .init((stage) => {
        if (stage === "clang") setStatus("lld ачаалж байна…", "loading");
      })
      .then(() => setStatus("бэлэн", "ready"))
      .catch((e) => {
        judgeInit = null;
        setStatus("алдаа: " + e.message, "");
        throw e;
      });
  }
  return judgeInit;
}

async function loadProblems() {
  if (!problems)
    problems = await (
      await fetch("problems/index.json", { cache: "no-cache" })
    ).json();
  return problems;
}

// Оноо: дэд бодлоготой бол дэд бодлогын бүх тест зөв үед оноо авна, үгүй бол зөв тестийн хувь.
function computeScore(p, verdicts) {
  if (p.subtasks && p.subtasks.length) {
    let s = 0;
    const per = p.subtasks.map((st) => {
      const ok = st.tests.every((t) => verdicts[t] === "AC");
      if (ok) s += st.score;
      return ok;
    });
    return { score: s, per };
  }
  const n = p.tests.length;
  const ac = p.tests.filter((t) => verdicts[t.name] === "AC").length;
  return { score: n ? Math.round(((100 * ac) / n) * 100) / 100 : 0, per: [] };
}

// Markdown + KaTeX
function renderMarkdown(el, md) {
  const math = [];
  const safe = md.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => {
    math.push(m);
    return `@@M${math.length - 1}@@`;
  });
  el.innerHTML = (
    window.marked ? marked.parse(safe) : `<pre>${esc(safe)}</pre>`
  ).replace(/@@M(\d+)@@/g, (_, i) => esc(math[+i]));
  if (window.renderMathInElement)
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
}
const jsonCache = new Map();
async function loadJSON(url, fallback = []) {
  if (!jsonCache.has(url))
    jsonCache.set(
      url,
      fetch(url, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : fallback))
        .catch(() => fallback),
    );
  return jsonCache.get(url);
}
const fmtDate = (d) => {
  const x = new Date(d);
  if (isNaN(x)) return esc(d);
  const z = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}.${z(x.getMonth() + 1)}.${z(x.getDate())} ${z(x.getHours())}:${z(x.getMinutes())}`;
};
const best = (id) => store.get("best:" + id);

// ---------- жагсаалт ----------
const ICON_SEARCH =
  '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_REFRESH =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4"/></svg>';
const ICON_SORT =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/></svg>';
const ICON_GEAR =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const ICON_FILTER =
  '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function levelClass(l) {
  const s = (l || "").toLowerCase();
  if (/хэцүү|хүнд|hard/.test(s)) return "lv-hard";
  if (/дунд|medium/.test(s)) return "lv-mid";
  if (/хялбар|амархан|easy/.test(s)) return "lv-easy";
  return "";
}
function statusIcon(best) {
  if (best === null) return '<span class="pst"></span>';
  if (best >= 100)
    return '<span class="pst pst-ok" title="Бодсон: 100 оноо"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  return (
    '<span class="pst pst-part" title="Хэсэгчлэн: ' +
    best +
    ' оноо"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>'
  );
}

// Бодлогын мөр (жагсаалт, тэмцээн, хичээлд дахин ашиглана)
function problemRow(p, label) {
  const b = best(p.id);
  const meta = [
    p.level
      ? `<span class="${levelClass(p.level)}">${esc(p.level)}</span>`
      : "",
    ...(p.tags || []).map(esc),
  ]
    .filter(Boolean)
    .join('<span class="dot">·</span>');
  return `<a class="prow" href="#/p/${encodeURIComponent(p.id)}">
    ${statusIcon(b)}
    <span class="pmain"><span class="ptitle">${esc(p.title)} <span class="pnum">${esc(label)}</span></span>
      <span class="pmeta">${meta}</span></span>
  </a>`;
}
async function problemMap() {
  const ps = await loadProblems();
  return Object.fromEntries(ps.map((p, i) => [p.id, { ...p, num: i + 1 }]));
}

async function renderList() {
  document.title = "Бодлогууд — Олимпиадын бэлтгэл";
  const ps = await loadProblems();
  const levels = [...new Set(ps.map((p) => p.level).filter(Boolean))];
  app.innerHTML = `
    <div class="plist-wrap">
      <h1 class="page-title">Бодлогууд</h1>
      <div class="plist-bar">
        <label class="search">${ICON_SEARCH}<input id="q" placeholder="Хайх" autocomplete="off"></label>
        <label class="filter">${ICON_FILTER}<select id="lvl"><option value="">Бүх түвшин</option>${levels.map((l) => `<option>${esc(l)}</option>`).join("")}</select></label>
        <span class="plist-tools">
          <button class="ibtn" id="tRefresh" title="Шинэчлэх">${ICON_REFRESH}</button>
          <button class="ibtn" id="tSort" title="Эрэмбэ эсрэгээр">${ICON_SORT}</button>
          <button class="ibtn" id="tSet" title="Бодсон бодлогыг нуух/харуулах">${ICON_GEAR}</button>
        </span>
      </div>
      <div class="plist" id="rows"></div>
    </div>`;
  const rows = document.getElementById("rows");
  let desc = store.get("list:desc", false),
    hideSolved = store.get("list:hideSolved", false);
  const draw = () => {
    const q = document.getElementById("q").value.trim().toLowerCase();
    const lvl = document.getElementById("lvl").value;
    const list = ps
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          (!lvl || p.level === lvl) &&
          (!hideSolved || !(store.get("best:" + p.id) >= 100)) &&
          (!q ||
            (p.title + " " + p.id + " " + p.tags.join(" "))
              .toLowerCase()
              .includes(q)),
      );
    if (desc) list.reverse();
    document.getElementById("tSort").classList.toggle("on", desc);
    document.getElementById("tSet").classList.toggle("on", hideSolved);
    rows.innerHTML =
      list.map(({ p, i }) => problemRow(p, "#" + (i + 1))).join("") ||
      `<div class="prow empty muted">Олдсонгүй</div>`;
  };
  document.getElementById("q").oninput = draw;
  document.getElementById("lvl").onchange = draw;
  document.getElementById("tSort").onclick = () => {
    desc = !desc;
    store.set("list:desc", desc);
    draw();
  };
  document.getElementById("tSet").onclick = () => {
    hideSolved = !hideSolved;
    store.set("list:hideSolved", hideSolved);
    draw();
  };
  document.getElementById("tRefresh").onclick = async () => {
    problems = null;
    await renderList();
  };
  draw();
}

// ---------- бодлого ----------
async function renderProblem(id) {
  const ps = await loadProblems();
  const p = ps.find((x) => x.id === id);
  if (!p) {
    app.innerHTML = `<p>Бодлого олдсонгүй. <a href="#/problems">Буцах</a></p>`;
    return;
  }
  document.title = p.title + " — Олимпиадын бэлтгэл";
  const base = `problems/${encodeURIComponent(p.id)}/`;
  const testByName = Object.fromEntries(p.tests.map((t) => [t.name, t]));

  app.innerHTML = `
  <a class="back" href="#/problems">&larr; Бодлогууд</a>
  <div class="problem">
    <div class="card statement">
      <h1>${esc(p.title)}</h1>
      <div class="limits">Хугацаа: ${p.tl} сек · Санах ой: ${p.ml} MB · Тест: ${p.tests.length}${p.subtasks.length ? " · Дэд бодлого: " + p.subtasks.length : ""}</div>
      <div id="stmt" class="muted">Ачаалж байна…</div>
      <div id="samples"></div>
    </div>
    <div class="side">
      <div class="card">
        <textarea id="code" class="code" spellcheck="false"></textarea>
        <div class="actions">
          <button class="primary" id="submit">Шалгах</button>
          <button id="runBtn">Ажиллуулах</button>
          <button id="browse" title="Кодыг файлаас оруулах (.cpp)">Browse...</button>
          <input type="file" id="codeFile" accept=".cpp,.cc,.cxx,.c,.h,.hpp,.txt,text/plain" hidden>
          <button id="reset" title="Анхны загвар руу буцаах">Шинэчлэх</button>
          <span class="muted" id="msg"></span>
        </div>
        <details class="custom" id="customBox"><summary>Өөрийн оролтоор ажиллуулах</summary>
          <textarea id="cin" placeholder="stdin"></textarea>
          <pre class="io" id="cout"></pre>
        </details>
      </div>
      <div class="card" id="result" hidden></div>
    </div>
  </div>`;

  // Өгүүлбэр
  fetchText(base + "statement.md")
    .then((md) => {
      const el = document.getElementById("stmt");
      if (!el) return;
      el.className = "";
      renderMarkdown(el, md);
    })
    .catch(() => {
      const el = document.getElementById("stmt");
      if (el) el.textContent = "statement.md олдсонгүй";
    });

  // Жишээнүүд
  Promise.all(
    p.samples
      .filter((n) => testByName[n])
      .map(async (n) => {
        const t = testByName[n];
        return [await fetchText(base + t.in), await fetchText(base + t.out)];
      }),
  ).then((list) => {
    const el = document.getElementById("samples");
    if (!el || !list.length) return;
    el.innerHTML =
      "<h2>Жишээ</h2>" +
      list
        .map(
          ([i, o], k) => `
      <div class="samples">
        <div><div class="label">Оролт ${k + 1} <span class="copy" data-k="${k}">хуулах</span></div><pre>${esc(i)}</pre></div>
        <div><div class="label">Гаралт ${k + 1}</div><pre>${esc(o)}</pre></div>
      </div>`,
        )
        .join("");
    el.querySelectorAll(".copy").forEach(
      (b) =>
        (b.onclick = () => {
          navigator.clipboard.writeText(list[+b.dataset.k][0]);
          b.textContent = "хуулсан";
          setTimeout(() => (b.textContent = "хуулах"), 1200);
        }),
    );
    const cin = document.getElementById("cin");
    if (cin && !cin.value) cin.value = list[0][0];
  });

  // Засварлагч
  const ta = document.getElementById("code");
  ta.value = store.get("code:" + p.id, TEMPLATE);
  let editor = null;
  if (window.CodeMirror) {
    editor = CodeMirror.fromTextArea(ta, {
      mode: "text/x-c++src",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      matchBrackets: true,
      autoCloseBrackets: true,
      extraKeys: { "Ctrl-Enter": () => submit(), "Cmd-Enter": () => submit() },
    });
    editor.on("change", () => store.set("code:" + p.id, editor.getValue()));
  } else {
    ta.oninput = () => store.set("code:" + p.id, ta.value);
  }
  const getCode = () => (editor ? editor.getValue() : ta.value);
  document.getElementById("reset").onclick = () => {
    if (!confirm("Кодыг анхны загвар руу буцаах уу?")) return;
    editor ? editor.setValue(TEMPLATE) : (ta.value = TEMPLATE);
  };

  // Кодыг файлаас оруулах
  const fileIn = document.getElementById("codeFile");
  document.getElementById("browse").onclick = () => fileIn.click();
  fileIn.onchange = async () => {
    const f = fileIn.files[0];
    fileIn.value = ""; // ижил файлыг дахин сонгож болохоор
    if (!f) return;
    const msg = document.getElementById("msg");
    if (f.size > 1 << 20) {
      msg.textContent = "Файл хэт том байна (1MB-аас их).";
      return;
    }
    const text = (await f.text()).replace(/\r\n?/g, "\n");
    if (editor) editor.setValue(text);
    else {
      ta.value = text;
      store.set("code:" + p.id, text);
    }
    msg.textContent = f.name + " оруулсан";
    submit(); // файлаас оруулсан кодыг шууд илгээж шалгана
  };

  ensureJudge().catch(() => {}); // хуудсанд ороход clang-ийг урьдчилан ачаалж эхэлнэ

  const msg = document.getElementById("msg");
  const btnSubmit = document.getElementById("submit");
  const btnRun = document.getElementById("runBtn");
  const busy = (b) => {
    btnSubmit.disabled = btnRun.disabled = b;
  };

  async function compileOrShow() {
    msg.textContent = "Шалгагч ачаалж байна…";
    await ensureJudge();
    msg.textContent = "Хөрвүүлж байна…";
    const c = await judge.compile(getCode(), { maxMemory: p.ml * 1024 * 1024 });
    return c;
  }

  btnRun.onclick = async () => {
    busy(true);
    const out = document.getElementById("cout");
    document.getElementById("customBox").open = true;
    try {
      const c = await compileOrShow();
      if (!c.ok) {
        out.textContent = c.log;
        msg.textContent = "Хөрвүүлэлтийн алдаа";
        return;
      }
      msg.textContent = "Ажиллаж байна…";
      const r = await judge.runCustom(
        c.wasm,
        document.getElementById("cin").value,
        Math.max(5000, p.tl * 1000 * 3),
      );
      out.textContent =
        clip(r.stdout, 20000) +
        (r.stderr ? "\n--- stderr ---\n" + clip(r.stderr) : "") +
        (r.status !== "ok"
          ? `\n--- ${r.status.toUpperCase()} ${r.message || ""}`
          : "");
      msg.textContent = `${r.ms.toFixed(0)} мс`;
    } catch (e) {
      msg.textContent = "Алдаа: " + e.message;
    } finally {
      busy(false);
    }
  };

  async function submit() {
    if (btnSubmit.disabled) return;
    busy(true);
    const res = document.getElementById("result");
    res.hidden = false;
    try {
      const c = await compileOrShow();
      if (!c.ok) {
        res.innerHTML = `<div class="summary"><span class="verdict v-CE">CE</span> ${VERDICT_MN.CE}</div><pre class="celog">${esc(c.log)}</pre>`;
        msg.textContent = "";
        return;
      }
      const verdicts = {};
      const rowsHtml = () => {
        const line = (t) => {
          const r = verdicts[t.name];
          const v = r ? r.verdict : "WAIT";
          return `<tr class="${r && r.verdict !== "AC" ? "clickable" : ""}" data-t="${esc(t.name)}">
            <td>${esc(t.name)}</td><td><span class="verdict v-${v}">${v === "WAIT" ? "…" : v}</span></td>
            <td>${r ? r.ms.toFixed(0) + " мс" : ""}</td><td>${r && r.memBytes ? Math.max(1, Math.round((r.memBytes - STACK_BYTES) / 1048576)) + " MB" : ""}</td></tr>`;
        };
        if (p.subtasks.length) {
          return p.subtasks
            .map(
              (st, k) =>
                `<tr class="st"><td colspan="4">Дэд бодлого ${k + 1}${st.name ? " — " + esc(st.name) : ""} (${st.score} оноо)</td></tr>` +
                st.tests
                  .filter((n) => testByName[n])
                  .map((n) => line(testByName[n]))
                  .join(""),
            )
            .join("");
        }
        return p.tests.map(line).join("");
      };
      const draw = (done) => {
        const vmap = Object.fromEntries(
          Object.entries(verdicts).map(([k, v]) => [k, v.verdict]),
        );
        const { score } = computeScore(p, vmap);
        const first = p.tests
          .map((t) => verdicts[t.name])
          .find((r) => r && r.verdict !== "AC");
        const head = done
          ? `<div class="summary">${score >= 100 ? '<span class="verdict v-AC">AC</span>' : `<span class="verdict v-${first ? first.verdict : "WA"}">${first ? first.verdict : "WA"}</span>`} Оноо: ${score} / 100</div>`
          : `<div class="summary">Шалгаж байна… ${Object.keys(verdicts).length} / ${p.tests.length}</div>`;
        res.innerHTML =
          head +
          `<table class="res"><thead><tr><th>Тест</th><th>Үр дүн</th><th>Хугацаа</th><th>Санах ой</th></tr></thead><tbody>${rowsHtml()}</tbody></table>
          <div id="detail"></div>`;
        res
          .querySelectorAll("tr.clickable")
          .forEach(
            (tr) => (tr.onclick = () => showDetail(verdicts[tr.dataset.t])),
          );
        return score;
      };
      draw(false);
      msg.textContent = "Шалгаж байна…";
      const tests = p.tests.map((t) => ({
        name: t.name,
        input: () => fetchText(base + t.in),
        output: () => fetchText(base + t.out),
      }));
      await judge.runTests(
        c.wasm,
        tests,
        { tlMs: p.tl * 1000, mlBytes: p.ml * 1024 * 1024, checker: p.checker },
        (_i, r) => {
          verdicts[r.name] = r;
          draw(false);
        },
      );
      const score = draw(true);
      const best = store.get("best:" + p.id);
      if (best === null || score > best) {
        store.set("best:" + p.id, score);
        updateSolved();
        Auth.saveScore(p.id, score).catch((e) => console.warn("Оноо серверт хадгалагдсангүй:", e));
      }
      msg.textContent = "";
      const firstBad = p.tests
        .map((t) => verdicts[t.name])
        .find((r) => r && r.verdict !== "AC");
      if (firstBad) showDetail(firstBad);
    } catch (e) {
      res.innerHTML = `<pre class="celog">${esc(e.stack || e.message)}</pre>`;
    } finally {
      busy(false);
    }
  }
  btnSubmit.onclick = submit;
}

function showDetail(r) {
  const el = document.getElementById("detail");
  if (!el || !r) return;
  el.innerHTML = `<div class="detail"><b>Тест ${esc(r.name)}:</b> <span class="verdict v-${r.verdict}">${r.verdict}</span> ${esc(VERDICT_MN[r.verdict] || "")}
    ${r.message ? `<span class="muted"> (${esc(r.message)})</span>` : ""}
    <div class="grid">
      <div><div class="muted">Оролт</div><pre class="io">${esc(clip(r.input))}</pre></div>
      <div><div class="muted">Хүлээгдэж буй</div><pre class="io">${esc(clip(r.expected))}</pre></div>
      <div><div class="muted">Таны гаралт</div><pre class="io">${esc(clip(r.stdout || ""))}</pre></div>
    </div>
    ${r.stderr ? `<div class="muted">stderr</div><pre class="io">${esc(clip(r.stderr))}</pre>` : ""}</div>`;
}

// ---------- нүүр ----------
const HI = (d) =>
  `<span class="hf-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
const ICON_GRID = HI(
  '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
);
const ICON_CUP = HI(
  '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>',
);
const ICON_BARS = HI('<path d="M3 20h18M6 20v-7M12 20V5M18 20v-11"/>');
// Нүүрний гадаад холбоосууд — хаягийг энд солино
const GITHUB_URL = "https://github.com/msue-mzt/oj";
const VSCODE_URL = "https://code.visualstudio.com/";
const ICON_REPO = HI(
  '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-12 6"/>',
);
const ICON_EDITOR = HI(
  '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m10 9-2 2 2 2M14 9l2 2-2 2M8 21h8"/>',
);
const ANN_PER_PAGE = 10;
async function renderHome(page = 1) {
  document.title = "Мэдээлэл зүйн бодлого шалгах систем";
  const posts = (await loadJSON("posts/index.json"))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const pages = Math.max(1, Math.ceil(posts.length / ANN_PER_PAGE));
  page = Math.min(Math.max(1, page), pages);
  const rows =
    posts
      .slice((page - 1) * ANN_PER_PAGE, page * ANN_PER_PAGE)
      .map(
        (p) => `
    <a class="ann-row" href="#/posts/${encodeURIComponent(p.id)}">
      <span class="ann-title">${esc(p.title)}</span>
      <span class="ann-date">${esc(p.date || "")}</span>
      <span class="ann-by">${esc(p.author || "")}</span>
    </a>`,
      )
      .join("") || '<div class="ann-row muted">Зарлал алга</div>';
  const pager = Array.from(
    { length: pages },
    (_, i) =>
      `<button class="pg ${i + 1 === page ? "cur" : ""}" data-p="${i + 1}">${i + 1}</button>`,
  ).join("");
  app.innerHTML = `
    <section class="oj-hero">
      <div class="oj-hero-logo">&lt;/&gt;</div>
      <h1>Online<b>Judge</b></h1>
      <p class="oj-hero-sub"><b>"ӨРСӨЛДӨӨНТ ПРОГРАМЧЛАЛ"</b>-ЫН ТӨРЛӨӨР ӨРСӨЛДӨЦГӨӨЕ.</p>
      <div class="oj-hero-links">
        <a href="#/problems" class="f-problems">${ICON_GRID}<span>Бодлогууд</span></a>
        <a href="#/contests" class="f-contests">${ICON_CUP}<span>Тэмцээн</span></a>
        <a href="#/rating" class="f-rating">${ICON_BARS}<span>Рейтинг</span></a>
        <a href="${GITHUB_URL}" class="f-github" target="_blank" rel="noopener">${ICON_REPO}<span>GitHub</span></a>
        <a href="${VSCODE_URL}" class="f-vscode" target="_blank" rel="noopener">${ICON_EDITOR}<span>VS Code</span></a>
      </div>
    </section>
    <section class="ann">
      <div class="ann-head"><h2>Зарлал</h2><button class="ann-refresh" id="annRefresh">Шинэчлэх</button></div>
      <div class="ann-list">${rows}</div>
    </section>
    <div class="ann-pager">
      <button class="pg" data-p="${page - 1}" ${page <= 1 ? "disabled" : ""}>&lsaquo;</button>${pager}
      <button class="pg" data-p="${page + 1}" ${page >= pages ? "disabled" : ""}>&rsaquo;</button>
    </div>`;
  document.getElementById("annRefresh").onclick = () => {
    jsonCache.delete("posts/index.json");
    renderHome(page);
  };
  app
    .querySelectorAll(".ann-pager .pg")
    .forEach((b) => (b.onclick = () => renderHome(+b.dataset.p)));
}

// ---------- тэмцээн ----------
function contestState(c, now = Date.now()) {
  const st = Date.parse(c.start),
    en = Date.parse(c.end);
  if (!isNaN(st) && now < st) return { k: "soon", t: "Удахгүй" };
  if (!isNaN(en) && now > en) return { k: "done", t: "Дууссан" };
  return { k: "live", t: "Явагдаж байна" };
}
function dur(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    x = s % 60;
  return (
    (d ? d + " өдөр " : "") +
    [h, m, x].map((v) => String(v).padStart(2, "0")).join(":")
  );
}
async function renderContests() {
  document.title = "Тэмцээн — Олимпиадын бэлтгэл";
  const cs = await loadJSON("contests/index.json");
  app.innerHTML = `<div class="plist-wrap"><h1 class="page-title">Тэмцээн</h1>
    <div class="plist">${
      cs
        .map((c) => {
          const s = contestState(c);
          return `
      <a class="prow" href="#/contests/${encodeURIComponent(c.id)}">
        <span class="badge b-${s.k}">${s.t}</span>
        <span class="pmain"><span class="ptitle">${esc(c.title)}</span>
          <span class="pmeta">${c.start ? fmtDate(c.start) : ""}${c.end ? " — " + fmtDate(c.end) : ""}<span class="dot">·</span>${c.problems.length} бодлого</span></span>
      </a>`;
        })
        .join("") || '<div class="prow empty muted">Тэмцээн алга</div>'
    }</div></div>`;
}
let contestTimer = null;
async function renderContest(id) {
  const cs = await loadJSON("contests/index.json");
  const c = cs.find((x) => x.id === id);
  if (!c) {
    app.innerHTML = `<div class="plist-wrap"><p>Тэмцээн олдсонгүй. <a href="#/contests">Буцах</a></p></div>`;
    return;
  }
  document.title = c.title + " — Тэмцээн";
  const pm = await problemMap();
  const draw = () => {
    const s = contestState(c);
    const st = Date.parse(c.start),
      en = Date.parse(c.end);
    const timer =
      s.k === "soon"
        ? `Эхлэхэд: <b>${dur(st - Date.now())}</b>`
        : s.k === "live" && !isNaN(en)
          ? `Дуусахад: <b>${dur(en - Date.now())}</b>`
          : "";
    const list = c.problems
      .map((pid, i) =>
        pm[pid] ? problemRow(pm[pid], String.fromCharCode(65 + i)) : "",
      )
      .join("");
    const total = c.problems.reduce((a, pid) => a + (best(pid) || 0), 0);
    app.innerHTML = `<div class="plist-wrap">
      <a class="back" href="#/contests">&larr; Тэмцээн</a>
      <h1 class="page-title">${esc(c.title)}</h1>
      <div class="cinfo"><span class="badge b-${s.k}">${s.t}</span>
        <span class="muted">${c.start ? fmtDate(c.start) : ""}${c.end ? " — " + fmtDate(c.end) : ""}</span>
        <span class="ctimer">${timer}</span>
        ${s.k !== "soon" ? `<span class="ctotal">Нийт оноо: <b>${total}</b> / ${c.problems.length * 100}</span>` : ""}</div>
      ${c.description ? `<p class="cdesc">${esc(c.description)}</p>` : ""}
      ${
        s.k === "soon"
          ? '<div class="plist"><div class="prow empty muted">Бодлогууд тэмцээн эхлэхэд харагдана</div></div>'
          : `<div class="plist">${list}</div>`
      }</div>`;
  };
  draw();
  const s0 = contestState(c);
  if (s0.k !== "done")
    contestTimer = setInterval(() => {
      if (!location.hash.startsWith("#/contests/"))
        return clearInterval(contestTimer);
      const before = contestState(c).k;
      const t = app.querySelector(".ctimer");
      if (before !== s0.k || !t) return draw();
      const st = Date.parse(c.start),
        en = Date.parse(c.end);
      t.innerHTML =
        before === "soon"
          ? `Эхлэхэд: <b>${dur(st - Date.now())}</b>`
          : !isNaN(en)
            ? `Дуусахад: <b>${dur(en - Date.now())}</b>`
            : "";
    }, 1000);
}

// ---------- хичээл ----------
function progress(ids) {
  const n = ids.length,
    ok = ids.filter((id) => best(id) >= 100).length;
  return { n, ok, pct: n ? Math.round((100 * ok) / n) : 0 };
}
const lessonProblems = (c) => c.lessons.flatMap((l) => l.problems || []);
async function renderCourses() {
  document.title = "Хичээл — Олимпиадын бэлтгэл";
  const cs = await loadJSON("courses/index.json");
  app.innerHTML = `<div class="plist-wrap"><h1 class="page-title">Хичээл</h1>
    <div class="cgrid">${
      cs
        .map((c) => {
          const pr = progress(lessonProblems(c));
          return `
      <a class="ccard" href="#/courses/${encodeURIComponent(c.id)}">
        <span class="ctitle">${esc(c.title)}</span>
        <span class="cdesc2">${esc(c.description || "")}</span>
        <span class="pmeta">${c.lessons.length} сэдэв<span class="dot">·</span>${pr.n} бодлого</span>
        <span class="bar"><i style="width:${pr.pct}%"></i></span>
        <span class="pmeta">${pr.ok} / ${pr.n} бодсон</span>
      </a>`;
        })
        .join("") ||
      '<div class="plist"><div class="prow empty muted">Хичээл алга</div></div>'
    }</div></div>`;
}
async function renderCourse(id, li) {
  const cs = await loadJSON("courses/index.json");
  const c = cs.find((x) => x.id === id);
  if (!c) {
    app.innerHTML = `<div class="plist-wrap"><p>Хичээл олдсонгүй. <a href="#/courses">Буцах</a></p></div>`;
    return;
  }
  const pm = await problemMap();
  if (li === undefined) {
    document.title = c.title + " — Хичээл";
    const pr = progress(lessonProblems(c));
    app.innerHTML = `<div class="plist-wrap">
      <a class="back" href="#/courses">&larr; Хичээл</a>
      <h1 class="page-title">${esc(c.title)}</h1>
      ${c.description ? `<p class="cdesc">${esc(c.description)}</p>` : ""}
      <div class="cinfo"><span class="bar wide"><i style="width:${pr.pct}%"></i></span><span class="muted">${pr.ok} / ${pr.n} бодсон</span></div>
      <div class="plist">${c.lessons
        .map((l, i) => {
          const p = progress(l.problems || []);
          return `
        <a class="prow" href="#/courses/${encodeURIComponent(c.id)}/${i + 1}">
          <span class="lnum ${p.n && p.ok === p.n ? "done" : ""}">${i + 1}</span>
          <span class="pmain"><span class="ptitle">${esc(l.title)}</span>
            <span class="pmeta">${p.n} бодлого<span class="dot">·</span>${p.ok} бодсон</span></span>
        </a>`;
        })
        .join("")}</div></div>`;
    return;
  }
  const l = c.lessons[li - 1];
  if (!l) {
    location.hash = "#/courses/" + encodeURIComponent(c.id);
    return;
  }
  document.title = l.title + " — " + c.title;
  const prev =
    li > 1
      ? `<a href="#/courses/${encodeURIComponent(c.id)}/${li - 1}">&larr; ${esc(c.lessons[li - 2].title)}</a>`
      : "<span></span>";
  const next =
    li < c.lessons.length
      ? `<a href="#/courses/${encodeURIComponent(c.id)}/${li + 1}">${esc(c.lessons[li].title)} &rarr;</a>`
      : "<span></span>";
  app.innerHTML = `<div class="plist-wrap">
    <a class="back" href="#/courses/${encodeURIComponent(c.id)}">&larr; ${esc(c.title)}</a>
    <h1 class="page-title">${li}. ${esc(l.title)}</h1>
    ${l.file ? '<div class="plist article" id="lmd"><p class="muted">Ачаалж байна…</p></div>' : ""}
    ${(l.problems || []).length ? `<h2 class="sub-title">Бодлогууд</h2><div class="plist">${l.problems.map((pid) => (pm[pid] ? problemRow(pm[pid], "#" + pm[pid].num) : "")).join("")}</div>` : ""}
    <div class="pager">${prev}${next}</div></div>`;
  if (l.file)
    fetchText(`courses/${encodeURIComponent(c.id)}/${l.file}`)
      .then((md) => {
        const el = document.getElementById("lmd");
        if (el) renderMarkdown(el, md);
      })
      .catch(() => {
        const el = document.getElementById("lmd");
        if (el) el.innerHTML = '<p class="muted">Файл олдсонгүй</p>';
      });
}

// ---------- рейтинг (энэ хөтөч дээрх ахиц) ----------
async function renderRating() {
  document.title = "Рейтинг — Олимпиадын бэлтгэл";
  const ps = await loadProblems();
  const solved = ps.filter((p) => best(p.id) >= 100),
    tried = ps.filter((p) => best(p.id) !== null);
  const pts = ps.reduce((a, p) => a + (best(p.id) || 0), 0);
  const group = (key) => {
    const m = new Map();
    ps.forEach((p) =>
      (key(p) || []).forEach((k) => {
        const g = m.get(k) || { n: 0, ok: 0 };
        g.n++;
        if (best(p.id) >= 100) g.ok++;
        m.set(k, g);
      }),
    );
    return [...m]
      .map(
        ([k, g]) =>
          `<div class="statrow"><span>${esc(k)}</span><span class="bar"><i style="width:${Math.round((100 * g.ok) / g.n)}%"></i></span><span class="muted">${g.ok} / ${g.n}</span></div>`,
      )
      .join("");
  };
  // Хэрэглэгчдийн хүснэгт
  const me = userScope();
  const bestOf = (uid, pid) => {
    try {
      const v = localStorage.getItem("bg:u:" + uid + ":best:" + pid);
      return v === null ? null : JSON.parse(v);
    } catch (_) {
      return null;
    }
  };
  let remote = null;
  try {
    remote = await Auth.fetchRatings();
  } catch (e) {
    console.warn("Рейтинг серверээс ирсэнгүй:", e);
  }
  const rows = (remote || Auth.listUsers())
    .map((u) => {
      const sc = ps.map((p) =>
        remote ? (u.best[p.id] === undefined ? null : u.best[p.id]) : bestOf(u.id, p.id),
      );
      return {
        ...u,
        sc,
        ok: sc.filter((x) => x >= 100).length,
        pts: sc.reduce((a, x) => a + (x || 0), 0),
      };
    })
    .sort((a, b) => b.ok - a.ok || b.pts - a.pts || a.created - b.created);
  const cell = (x) =>
    x === null
      ? `<td class="sc"></td>`
      : `<td class="sc ${x >= 100 ? "sc-ok" : x > 0 ? "sc-part" : "sc-zero"}">${Math.round(x)}</td>`;
  let place = 0;
  const table = rows.length
    ? `<div class="rank-wrap"><table class="list rank">
      <thead><tr><th>#</th><th>Хэрэглэгч</th>${ps
        .map((p, i) => `<th class="sc" title="${esc(p.title)}"><a href="#/p/${encodeURIComponent(p.id)}">${i + 1}</a></th>`)
        .join("")}<th class="sc">Бодсон</th><th class="sc">Оноо</th></tr></thead>
      <tbody>${rows
        .map((r, i) => {
          if (!i || r.ok !== rows[i - 1].ok || r.pts !== rows[i - 1].pts) place = i + 1;
          return `<tr${"u:" + r.id + ":" === me ? ' class="me"' : ""}><td>${place}</td><td class="uname">${esc(r.name)}</td>${r.sc
            .map(cell)
            .join("")}<td class="sc"><b>${r.ok}</b></td><td class="sc">${Math.round(r.pts)}</td></tr>`;
        })
        .join("")}</tbody></table></div>
      <p class="muted note">Баганын дугаар дээр хулгана аваачвал бодлогын нэр харагдана.</p>`
    : `<p class="muted">Бүртгэлтэй хэрэглэгч алга. <a href="#/login">Бүртгүүлэх</a></p>`;

  app.innerHTML = `<div class="plist-wrap"><h1 class="page-title">Рейтинг</h1>
    ${table}
    <h2 class="sub-title">Миний ахиц</h2>
    <div class="stats">
      <div class="stat"><b>${solved.length}</b><span>Бодсон</span></div>
      <div class="stat"><b>${tried.length - solved.length}</b><span>Хэсэгчлэн</span></div>
      <div class="stat"><b>${Math.round(pts)}</b><span>Нийт оноо</span></div>
      <div class="stat"><b>${ps.length ? Math.round((100 * solved.length) / ps.length) : 0}%</b><span>Гүйцэтгэл</span></div>
    </div>
    <h2 class="sub-title">Түвшнээр</h2><div class="plist pad">${group((p) => (p.level ? [p.level] : []))}</div>
    <h2 class="sub-title">Сэдвээр</h2><div class="plist pad">${group((p) => p.tags)}</div>
    ${remote ? "" : `<p class="muted note">Түр горим: рейтинг нь зөвхөн энэ хөтөч дээр бүртгүүлсэн хэрэглэгчдийг харуулна. Бүх хэрэглэгчийг нэг рейтингт оруулахад Firebase тохиргоо шаардлагатай.</p>`}
    <button id="resetProg" class="linkbtn">Ахицыг тэглэх</button></div>`;
  document.getElementById("resetProg").onclick = () => {
    if (!confirm("Бүх оноо, хадгалсан кодыг устгах уу?")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bg:" + userScope() + "best:") || k.startsWith("bg:" + userScope() + "code:"))
      .forEach((k) => localStorage.removeItem(k));
    renderRating();
    updateSolved();
  };
}

// ---------- нийтлэл ----------
async function renderPosts() {
  document.title = "Нийтлэл — Олимпиадын бэлтгэл";
  const ps = (await loadJSON("posts/index.json"))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  app.innerHTML = `<div class="plist-wrap"><h1 class="page-title">Нийтлэл</h1>
    <div class="plist">${
      ps
        .map(
          (p) => `
      <a class="prow post" href="#/posts/${encodeURIComponent(p.id)}">
        <span class="pmain"><span class="ptitle">${esc(p.title)}</span>
          ${p.summary ? `<span class="psum">${esc(p.summary)}</span>` : ""}
          <span class="pmeta">${esc(p.date || "")}${p.author ? '<span class="dot">·</span>' + esc(p.author) : ""}</span></span>
      </a>`,
        )
        .join("") || '<div class="prow empty muted">Нийтлэл алга</div>'
    }</div></div>`;
}
async function renderPost(id) {
  const ps = await loadJSON("posts/index.json");
  const p = ps.find((x) => x.id === id);
  if (!p) {
    app.innerHTML = `<div class="plist-wrap"><p>Нийтлэл олдсонгүй. <a href="#/posts">Буцах</a></p></div>`;
    return;
  }
  document.title = p.title + " — Нийтлэл";
  app.innerHTML = `<div class="plist-wrap"><a class="back" href="#/posts">&larr; Нийтлэл</a>
    <h1 class="page-title">${esc(p.title)}</h1>
    <div class="pmeta" style="margin:-14px 0 20px">${esc(p.date || "")}${p.author ? '<span class="dot">·</span>' + esc(p.author) : ""}</div>
    <div class="plist article" id="pmd"><p class="muted">Ачаалж байна…</p></div></div>`;
  fetchText(`posts/${p.file || encodeURIComponent(p.id) + ".md"}`)
    .then((md) => renderMarkdown(document.getElementById("pmd"), md))
    .catch(() => {
      document.getElementById("pmd").innerHTML =
        '<p class="muted">Файл олдсонгүй</p>';
    });
}

// Навигацийн баруун талын бодсон тоо, идэвхтэй цэс
async function updateSolved() {
  const el = document.getElementById("solvedCount");
  if (!el) return;
  const ps = await loadProblems();
  el.textContent = ps.filter((p) => best(p.id) >= 100).length;
}
function markNav(h) {
  const sec = h.startsWith("/contests")
    ? "contests"
    : h.startsWith("/courses")
      ? "courses"
      : h.startsWith("/rating")
        ? "rating"
        : h.startsWith("/posts")
          ? "posts"
          : h.startsWith("/problems") || h.startsWith("/p/")
            ? "problems"
            : "home";
  document
    .querySelectorAll("#ojMenu a[data-route]")
    .forEach((a) => a.classList.toggle("active", a.dataset.route === sec));
}

// ---------- нэвтрэлт ----------
let loginReturn = "#/"; // нэвтэрсний дараа буцах хуудас

function renderAuthBox(u) {
  const box = document.getElementById("authBox");
  if (!box) return;
  if (!u) {
    box.innerHTML = `<a class="login-btn" href="#/login">Нэвтрэх</a>`;
    return;
  }
  const name = Auth.displayName(u);
  const avatar = u.photoURL
    ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${esc(name.slice(0, 1).toUpperCase())}</span>`;
  box.innerHTML = `
    <button class="user-btn" id="userBtn" aria-haspopup="true" aria-expanded="false" title="${esc(Auth.shownEmail(u) || name)}">
      <span class="avatar">${avatar}</span><span class="uname">${esc(name)}</span>
    </button>
    <div class="user-menu" id="userMenu" hidden>
      <div class="um-head"><b>${esc(name)}</b><span class="muted">${esc(Auth.shownEmail(u))}</span></div>
      <button id="logoutBtn">Гарах</button>
    </div>`;
  const btn = document.getElementById("userBtn");
  const menu = document.getElementById("userMenu");
  btn.onclick = (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    btn.setAttribute("aria-expanded", String(!menu.hidden));
  };
  document.getElementById("logoutBtn").onclick = async () => {
    await Auth.logout();
    menu.hidden = true;
  };
}
document.addEventListener("click", (e) => {
  const menu = document.getElementById("userMenu");
  if (menu && !menu.hidden && !menu.contains(e.target)) menu.hidden = true;
});

async function renderLogin() {
  document.title = "Нэвтрэх — Олимпиадын бэлтгэл";
  const isLocal = Auth.authMode === "local";
  app.innerHTML = `<div class="card auth-card"><p class="muted">Ачаалж байна…</p></div>`;
  try {
    await Auth.initAuth();
  } catch (e) {
    app.innerHTML = `<div class="card auth-card"><h1>Нэвтрэх</h1><p class="err">Firebase ачаалж чадсангүй: ${esc(e.message)}</p></div>`;
    return;
  }
  const u = Auth.currentUser();
  if (u) {
    app.innerHTML = `<div class="card auth-card"><h1>Нэвтэрсэн байна</h1>
      <p><b>${esc(Auth.displayName(u))}</b> <span class="muted">${esc(Auth.shownEmail(u))}</span></p>
      <div class="actions"><a class="btn-link primary" href="#/problems">Бодлогууд руу</a><button id="lo">Гарах</button></div></div>`;
    document.getElementById("lo").onclick = async () => {
      await Auth.logout();
      route();
    };
    return;
  }

  let mode = "login"; // login | register
  const draw = () => {
    const reg = mode === "register";
    app.innerHTML = `<div class="card auth-card">
      <h1>${reg ? "Бүртгүүлэх" : "Нэвтрэх"}</h1>
      ${isLocal ? "" : `<button class="google-btn" id="gBtn" type="button">
        <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Google-ээр ${reg ? "бүртгүүлэх" : "нэвтрэх"}</button>
      <div class="or"><span>эсвэл</span></div>`}
      <form id="authForm" novalidate>
        <label>Хэрэглэгчийн нэр<input id="fUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="user01" required></label>
        <label>Нууц үг<input id="fPass" type="password" autocomplete="${reg ? "new-password" : "current-password"}" minlength="6" required></label>
        ${reg ? `<label>Нууц үг давтах<input id="fPass2" type="password" autocomplete="new-password" minlength="6" required></label>` : ""}
        <p class="auth-msg" id="aMsg" role="status"></p>
        <button class="primary" type="submit">${reg ? "Бүртгүүлэх" : "Нэвтрэх"}</button>
      </form>
      <div class="auth-links">
        ${mode === "login"
          ? `<span>Бүртгэлгүй юу? <a href="#" data-m="register">Бүртгүүлэх</a></span>`
          : `<span>Бүртгэлтэй юу? <a href="#" data-m="login">Нэвтрэх</a></span>`}
      </div>
      ${isLocal ? `<p class="auth-note">Түр горим: бүртгэл зөвхөн энэ хөтөч дээр хадгалагдана.</p>` : ""}
    </div>`;
    const msg = document.getElementById("aMsg");
    const say = (t, ok) => ((msg.textContent = t), msg.classList.toggle("ok", !!ok));
    const done = () => (location.hash = loginReturn);
    app.querySelectorAll("[data-m]").forEach(
      (a) => (a.onclick = (e) => (e.preventDefault(), (mode = a.dataset.m), draw())),
    );
    const g = document.getElementById("gBtn");
    if (g)
      g.onclick = async () => {
        try {
          await Auth.loginGoogle();
          done();
        } catch (e) {
          say(Auth.authError(e));
        }
      };
    document.getElementById("authForm").onsubmit = async (e) => {
      e.preventDefault();
      const user = document.getElementById("fUser").value;
      const pass = document.getElementById("fPass").value;
      const sub = e.target.querySelector("button[type=submit]");
      sub.disabled = true;
      say("");
      try {
        if (reg) {
          if (pass !== document.getElementById("fPass2").value)
            throw { message: "Нууц үг таарахгүй байна." };
          await Auth.registerUser(user, pass);
        } else {
          await Auth.loginUser(user, pass);
        }
        done();
      } catch (err) {
        say(Auth.authError(err));
      } finally {
        sub.disabled = false;
      }
    };
  };
  draw();
}

// Нэвтэрсний дараа серверийн оноог локалтай нэгтгэнэ (их нь үлдэнэ)
async function syncScores() {
  try {
    await Auth.touchUser();
    const remote = await Auth.loadMyScores();
    if (!remote) return;
    const ps = await loadProblems();
    let changed = false;
    for (const p of ps) {
      const l = store.get("best:" + p.id), r = remote[p.id];
      if (r !== undefined && (l === null || r > l)) store.set("best:" + p.id, r), (changed = true);
      else if (l !== null && (r === undefined || l > r)) await Auth.saveScore(p.id, l);
    }
    if (changed) {
      updateSolved();
      if (location.hash !== "#/login") route();
    }
  } catch (e) {
    console.warn("Оноо нэгтгэж чадсангүй:", e);
  }
}

renderAuthBox(null);
let lastScope = userScope();
if (Auth.authEnabled) {
  Auth.onUserChange((u) => {
    renderAuthBox(u);
    // хэрэглэгч солигдвол тухайн хүний ахицаар хуудсыг дахин зурна
    if (userScope() !== lastScope) {
      lastScope = userScope();
      if (u) syncScores();
      if (location.hash !== "#/login") route();
      else updateSolved();
    }
  });
  Auth.initAuth().catch((e) => console.warn("Firebase:", e));
}
window.addEventListener("hashchange", (e) => {
  const prev = (e.oldURL.split("#")[1] || "/");
  if (location.hash === "#/login" && prev !== "/login") loginReturn = "#" + prev;
});

// ---------- чиглүүлэгч ----------
async function route() {
  const h = location.hash.replace(/^#/, "") || "/";
  if (contestTimer) {
    clearInterval(contestTimer);
    contestTimer = null;
  }
  app.classList.toggle("plain", h !== "/" && h !== "");
  app.classList.toggle("home", h === "/" || h === "");
  markNav(h);
  updateSolved();
  let m;
  try {
    if ((m = h.match(/^\/p\/(.+)$/)))
      await renderProblem(decodeURIComponent(m[1]));
    else if ((m = h.match(/^\/contests\/([^/]+)$/)))
      await renderContest(decodeURIComponent(m[1]));
    else if (h === "/contests") await renderContests();
    else if ((m = h.match(/^\/courses\/([^/]+)(?:\/(\d+))?$/)))
      await renderCourse(decodeURIComponent(m[1]), m[2] ? +m[2] : undefined);
    else if (h === "/courses") await renderCourses();
    else if (h === "/rating") await renderRating();
    else if ((m = h.match(/^\/posts\/([^/]+)$/)))
      await renderPost(decodeURIComponent(m[1]));
    else if (h === "/posts") await renderPosts();
    else if (h === "/problems") await renderList();
    else if (h === "/login") await renderLogin();
    else await renderHome();
  } catch (e) {
    app.innerHTML = `<pre class="celog">${esc(e.stack || e.message)}</pre>`;
  }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
// defer скриптүүд (marked, CodeMirror) ачаалагдсаны дараа эхэлнэ
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", route);
else route();
