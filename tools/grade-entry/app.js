"use strict";
const $ = (id) => document.getElementById(id),
  NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
let book = null,
  edits = {},
  history = [],
  selected = null,
  grade = "A",
  matches = [],
  cursor = 0,
  busy = false,
  key = "",
  db = null,
  dateKey = "927";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
const nodes = (d, n) => Array.from(d.getElementsByTagNameNS("*", n));
const col = (n) => String.fromCharCode(65 + n);
function notice(s, error = false) {
  $("notice").textContent = s;
  $("notice").className = error ? "error" : "";
}
function normDate(v) {
  let s = String(v ?? "")
    .trim()
    .replace(/[月\/.-]/g, "")
    .replace(/日$/, "");
  if (!/^\d{3,4}$/.test(s)) return null;
  let m = Number(s.slice(0, -2)),
    d = Number(s.slice(-2));
  return m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    ? `${m}${String(d).padStart(2, "0")}`
    : null;
}
function dateText(d) {
  return `${d.slice(0, -2)} 月 ${Number(d.slice(-2))} 日`;
}
function stored(k) {
  return Object.hasOwn(edits, k) ? edits[k] : undefined;
}
function value(sheet, ref) {
  const k = sheet.path + "!" + ref;
  return stored(k) ?? sheet.cells[ref] ?? "";
}
function columnFor(g, d) {
  for (let c = 4; c < 16; c++)
    if (normDate(value(g.sheet, col(c) + g.header)) === d) return c;
  for (let c = 4; c < 16; c++)
    if (
      value(g.sheet, col(c) + g.header) === "" &&
      !book.students.some(
        (s) => s.group === g && value(g.sheet, col(c) + s.row) !== "",
      )
    )
      return c;
  return -1;
}
function current(s) {
  const c = columnFor(s.group, dateKey);
  return c < 0 ? "" : String(value(s.group.sheet, col(c) + s.row));
}
async function parse(bytes, name) {
  const zip = await JSZip.loadAsync(bytes);
  let shared = [];
  if (zip.file("xl/sharedStrings.xml"))
    shared = nodes(
      xml(await zip.file("xl/sharedStrings.xml").async("string")),
      "si",
    ).map((n) =>
      nodes(n, "t")
        .map((t) => t.textContent)
        .join(""),
    );
  const wb = xml(await zip.file("xl/workbook.xml").async("string")),
    rels = nodes(
      xml(await zip.file("xl/_rels/workbook.xml.rels").async("string")),
      "Relationship",
    );
  const students = [],
    groups = [],
    sheets = [];
  for (const sh of nodes(wb, "sheet")) {
    const rel = rels.find(
      (r) => r.getAttribute("Id") === sh.getAttribute("r:id"),
    );
    if (!rel) continue;
    const target = rel.getAttribute("Target");
    const path = target.startsWith("/")
      ? target.slice(1)
      : "xl/" + target.replace(/^\.\//, "");
    if (!zip.file(path)) continue;
    const raw = await zip.file(path).async("string"),
      doc = xml(raw),
      cells = {};
    for (const c of nodes(doc, "c")) {
      const t = c.getAttribute("t"),
        v = nodes(c, "v")[0]?.textContent ?? "";
      cells[c.getAttribute("r")] =
        t === "s"
          ? (shared[Number(v)] ?? "")
          : t === "inlineStr"
            ? nodes(c, "t")
                .map((x) => x.textContent)
                .join("")
            : v;
    }
    const sheet = { name: sh.getAttribute("name"), path, raw, cells };
    sheets.push(sheet);
    let group = null;
    for (const row of nodes(doc, "row")) {
      const r = Number(row.getAttribute("r"));
      if (cells["B" + r] === "学号" && cells["C" + r] === "姓名") {
        group = { sheet, header: r + 1 };
        groups.push(group);
      } else if (
        group &&
        /^\d{6,}$/.test(cells["B" + r] ?? "") &&
        cells["C" + r]
      )
        students.push({
          id: String(cells["B" + r]),
          name: cells["C" + r],
          className: cells["D" + r] ?? "",
          row: r,
          group,
        });
    }
  }
  if (!students.length)
    throw Error(
      "没有识别到学生名单，请使用含“学号、姓名”表头的原格式 .xlsx 文件。",
    );
  if (new Set(students.map((s) => s.id)).size !== students.length)
    throw Error("发现重复学号，请先检查登记表，避免成绩对应错误。");
  return { zip, bytes, name, students, groups, sheets };
}
function openDB() {
  return new Promise((resolve, reject) => {
    let r = indexedDB.open("grade-entry-local-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function dbPut(v, k) {
  return new Promise((resolve, reject) => {
    const t = db.transaction("files", "readwrite");
    t.objectStore("files").put(v, k);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
function dbGet(k) {
  return new Promise((resolve, reject) => {
    const r = db.transaction("files").objectStore("files").get(k);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function persist() {
  if (!db) throw Error("本机保存不可用，请允许浏览器存储后重新打开。");
  await dbPut(
    { bytes: book.bytes, name: book.name, edits, history, date: dateKey },
    "active",
  );
  $("saved").textContent =
    "已保存到本机 · " +
    new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
}
function refreshDates() {
  const dates = new Set();
  for (const g of book.groups)
    for (let c = 4; c < 16; c++) {
      const d = normDate(value(g.sheet, col(c) + g.header));
      if (d) dates.add(d);
    }
  $("dates").innerHTML = [...dates]
    .sort((a, b) => Number(a) - Number(b))
    .map((d) => `<option value="${d}">${dateText(d)}</option>`)
    .join("");
}
function render() {
  if (!book) return;
  let done = 0,
    a = 0,
    b = 0;
  for (const s of book.students) {
    let v = current(s);
    if (v) done++;
    if (v === "A") a++;
    if (v === "B") b++;
  }
  $("done").textContent = done;
  $("total").textContent = book.students.length;
  $("countA").textContent = a;
  $("countB").textContent = b;
  $("remaining").textContent = book.students.length - done;
  $("bar").style.width = (100 * done) / book.students.length + "%";
  $("dateLabel").textContent = dateText(dateKey);
  $("rosterCount").textContent = book.students.length + " 人";
  $("rows").innerHTML =
    book.students
      .filter((s) => !$("onlyMissing").checked || !current(s))
      .map(
        (s) =>
          `<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(s.className)}</td><td>${current(s) ? `<span class="badge">${esc(current(s))}</span>` : '<span class="blank">未录入</span>'}</td><td><button class="edit" data-id="${esc(s.id)}">录入</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" class="placeholder">本次已全部录入</td></tr>';
  $("undo").disabled = !history.length || busy;
  refreshDates();
}
function setGrade(g) {
  grade = g;
  document.querySelectorAll("[data-grade]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.grade === grade);
    b.setAttribute("aria-pressed", String(b.dataset.grade === grade));
  });
}
function pick(s) {
  selected = s;
  setGrade(current(s) || "A");
  $("matches").innerHTML = "";
  $("student").className = "student";
  $("student").innerHTML =
    `<h3>${esc(s.name)}</h3><div class="id">${esc(s.id)}</div><p>${esc(s.className)}${current(s) ? " · 已有成绩：" + esc(current(s)) + "（保存将覆盖）" : " · 本次尚未录入"}</p>`;
  $("save").disabled = busy || !normDate($("date").value);
}
function clear() {
  selected = null;
  matches = [];
  cursor = 0;
  setGrade("A");
  $("search").value = "";
  $("matches").innerHTML = "";
  $("student").className = "student empty";
  $("student").innerHTML =
    '<div class="empty-symbol">⌨</div><h3>下一份作业，准备好了</h3><p>输入尾号，唯一匹配后直接回车登记 A</p>';
  $("save").disabled = true;
  $("search").focus();
}
function drawMatches() {
  $("matches").innerHTML = matches
    .map(
      (s, i) =>
        `<button class="candidate ${i === cursor ? "active" : ""}" role="option" aria-selected="${i === cursor}" data-index="${i}"><span>${esc(s.name)} · ${esc(s.className)}</span><span>${esc(s.id)}</span></button>`,
    )
    .join("");
  $("matches").querySelector(".active")?.scrollIntoView({ block: "nearest" });
}
function search() {
  if (!book) return;
  selected = null;
  $("save").disabled = true;
  setGrade("A");
  const q = $("search").value.trim();
  matches = q
    ? book.students.filter((s) =>
        /^\d+$/.test(q) ? s.id.endsWith(q) : s.name.includes(q),
      )
    : [];
  cursor = 0;
  if (matches.length === 1) pick(matches[0]);
  else {
    $("student").className = "student empty";
    $("student").innerHTML = q
      ? `<div class="empty-symbol">⌕</div><h3>${matches.length ? "请选择对应学生" : "没有找到学生"}</h3><p>${matches.length ? "上下键选择，回车确认，或继续补全学号" : "试试更多学号位数或完整姓名"}</p>`
      : '<div class="empty-symbol">⌨</div><h3>下一份作业，准备好了</h3>';
    drawMatches();
  }
}
async function save() {
  if (!selected || busy || !book) return;
  const valid = normDate($("date").value);
  if (!valid || valid !== dateKey) {
    notice("请先确认有效的登记日期。", true);
    return;
  }
  const s = selected,
    g = s.group,
    c = columnFor(g, dateKey);
  if (c < 0) {
    notice("该学生所在页的 12 个日期栏已满，请先在原表中整理日期栏。", true);
    return;
  }
  busy = true;
  $("save").disabled = true;
  const before = { ...edits },
    changes = [];
  function change(ref, v) {
    const k = g.sheet.path + "!" + ref;
    changes.push({ key: k, had: Object.hasOwn(edits, k), old: edits[k] });
    edits[k] = v;
  }
  if (!normDate(value(g.sheet, col(c) + g.header)))
    change(col(c) + g.header, dateKey);
  change(col(c) + s.row, grade);
  history.push({ changes, id: s.id, name: s.name, grade, date: dateKey });
  try {
    await persist();
    $("last").textContent =
      `已保存：${s.name} · ${grade} · ${dateText(dateKey)}`;
    notice(`${s.name} 的成绩已保存，可以输入下一份作业的学号。`);
    clear();
  } catch (e) {
    edits = before;
    history.pop();
    notice("保存失败，未登记：" + e.message, true);
  } finally {
    busy = false;
    if (selected) $("save").disabled = false;
    render();
  }
}
async function undo() {
  if (!history.length || busy) return;
  busy = true;
  const h = history.pop(),
    before = { ...edits };
  for (const c of [...h.changes].reverse()) {
    if (c.had) edits[c.key] = c.old;
    else delete edits[c.key];
  }
  try {
    await persist();
    notice(`已撤销 ${h.name} 在 ${dateText(h.date)} 的上一次修改。`);
    $("last").textContent = "已撤销：" + h.name;
    clear();
  } catch (e) {
    edits = before;
    history.push(h);
    notice("撤销失败：" + e.message, true);
  } finally {
    busy = false;
    render();
  }
}
function patchCell(raw, ref, v) {
  const re = new RegExp(
    '<c\\b(?=[^>]*\\br="' + ref + '")[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)',
  );
  const old = raw.match(re)?.[0];
  const style = old?.match(/\bs="([^"]+)"/)?.[1];
  const cell = `<c r="${ref}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  if (old) return raw.replace(re, () => cell);
  const row = ref.match(/\d+$/)[0],
    rowRE = new RegExp(
      '(<row\\b(?=[^>]*\\br="' + row + '")[^>]*>)([\\s\\S]*?)(<\\/row>)',
    );
  if (!rowRE.test(raw)) throw Error("未找到原表行 " + row);
  return raw.replace(rowRE, (_, start, body, end) => {
    const target = ref.match(/^[A-Z]+/)[0];
    let inserted = false;
    body = body.replace(
      /<c\b[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,
      (all, c) => {
        if (
          !inserted &&
          (c.length > target.length ||
            (c.length === target.length && c > target))
        ) {
          inserted = true;
          return cell + all;
        }
        return all;
      },
    );
    return start + body + (inserted ? "" : cell) + end;
  });
}
async function exportBook() {
  if (!book || busy) return;
  busy = true;
  $("export").disabled = true;
  try {
    const zip = await JSZip.loadAsync(book.bytes);
    for (const s of book.sheets) {
      let raw = s.raw;
      for (const [k, v] of Object.entries(edits))
        if (k.startsWith(s.path + "!"))
          raw = patchCell(raw, k.slice(s.path.length + 1), v);
      if (raw !== s.raw) zip.file(s.path, raw);
    }
    const blob = await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = book.name.replace(/\.xlsx$/i, "") + "_已登记.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    notice("已导出成绩表，原始文件保持不变。");
  } catch (e) {
    notice("导出失败：" + e.message, true);
  } finally {
    busy = false;
    $("export").disabled = false;
  }
}
async function activate(b, cache) {
  book = b;
  edits = cache?.edits ?? {};
  history = cache?.history ?? [];
  dateKey = normDate(cache?.date) || "927";
  $("date").value = dateKey;
  $("fileName").textContent = b.name + " · " + b.students.length + " 位学生";
  $("search").disabled = false;
  $("export").disabled = false;
  clear();
  render();
}
$("file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (busy) return;
  busy = true;
  try {
    const bytes = await f.arrayBuffer(),
      b = await parse(bytes, f.name);
    if (
      book &&
      Object.keys(edits).length &&
      !confirm("重新导入会替换本机当前进度。请确认已导出需要保留的成绩。")
    )
      return;
    if (!db) throw Error("本机存储不可用，请允许浏览器存储后重试。");
    await dbPut(
      { bytes, name: f.name, edits: {}, history: [], date: "927" },
      "active",
    );
    await activate(b);
    notice(
      "已导入 " +
        b.students.length +
        " 位学生；按各页实际日期定位，原有不同日期保持不变。",
    );
    $("saved").textContent = "已保存到本机";
  } catch (err) {
    notice(err.message, true);
  } finally {
    busy = false;
    e.target.value = "";
    render();
  }
});
$("search").addEventListener("input", search);
$("search").addEventListener("keydown", (e) => {
  if (e.isComposing || busy) return;
  if (e.key === "Escape") {
    clear();
    return;
  }
  if (selected && /^[abc]$/i.test(e.key)) {
    e.preventDefault();
    setGrade(e.key.toUpperCase());
    return;
  }
  if (
    !selected &&
    matches.length > 1 &&
    ["ArrowDown", "ArrowUp"].includes(e.key)
  ) {
    e.preventDefault();
    cursor =
      (cursor + (e.key === "ArrowDown" ? 1 : -1) + matches.length) %
      matches.length;
    drawMatches();
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (selected) save();
    else if (matches.length) pick(matches[cursor]);
  }
});
$("matches").addEventListener("click", (e) => {
  const b = e.target.closest("[data-index]");
  if (b) {
    pick(matches[Number(b.dataset.index)]);
    $("search").focus();
  }
});
$("grades").addEventListener("click", (e) => {
  const b = e.target.closest("[data-grade]");
  if (b && selected && !busy) {
    setGrade(b.dataset.grade);
    $("search").focus();
  }
});
$("rows").addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  if (b && !busy) {
    const s = book.students.find((s) => s.id === b.dataset.id);
    $("search").value = s.id;
    pick(s);
    $("search").focus();
    $("search").scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
$("date").addEventListener("input", () => {
  const d = normDate($("date").value);
  $("save").disabled = true;
  $("dateHint").textContent = d
    ? "切换日期后继续录入"
    : "请输入有效月日，例如 927 或 1008";
});
$("date").addEventListener("change", async () => {
  const d = normDate($("date").value);
  if (!d) {
    notice("日期无效，请填写月日，例如 927。", true);
    return;
  }
  dateKey = d;
  $("date").value = d;
  clear();
  if (book) {
    render();
    try {
      await persist();
    } catch (e) {
      notice(e.message, true);
    }
  }
  $("dateHint").textContent = "各页按日期匹配，新增日期使用空白栏";
});
$("save").onclick = save;
$("undo").onclick = undo;
$("export").onclick = exportBook;
$("onlyMissing").onchange = render;
(async () => {
  try {
    db = await openDB();
    const cache = await dbGet("active");
    if (cache) {
      await activate(await parse(cache.bytes, cache.name), cache);
      $("saved").textContent = "已恢复本机进度";
      notice("已恢复上次登记，继续输入学号即可。");
    }
  } catch (e) {
    notice("本机进度无法恢复：" + e.message, true);
  }
})();
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "search_grade_roster",
        description: "按学号尾号或姓名查询当前导入名单，不登记成绩。",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (typeof input?.query !== "string" || !input.query.trim())
            throw Error("请输入非空查询");
          if (!book) throw Error("请先导入 Excel");
          const q = input.query.trim();
          return book.students
            .filter((s) =>
              /^\d+$/.test(q) ? s.id.endsWith(q) : s.name.includes(q),
            )
            .map((s) => ({
              id: s.id,
              name: s.name,
              className: s.className,
              grade: current(s),
              date: dateKey,
            }));
        },
      }),
    ).catch(() => {});
  } catch {}
}
