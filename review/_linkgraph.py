#!/usr/bin/env python3
"""GeoScore 全站内链图分析（只读 dist/，不修改任何文件）。

用法: python review/_linkgraph.py
输出: 控制台 + review/_linkgraph.json
"""
import json
import os
import re
import sys
from collections import defaultdict, Counter
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
HOST = "geoscore.help"


# ---------- 路径归一化 ----------
def file_to_url(rel):
    p = rel.replace(os.sep, "/")
    if p.endswith("/index.html"):
        p = p[: -len("index.html")]          # a/b/index.html -> a/b/
    elif p == "index.html":
        p = ""                                # index.html -> ""
    return "/" + p


def normalize_href(href, page_url):
    if not href:
        return None
    h = href.strip()
    if h.startswith(("mailto:", "tel:", "javascript:", "#", "data:")):
        return None
    # 外部链接
    m = re.match(r"^https?://([^/]+)(/.*)?$", h)
    if m:
        if m.group(1).lower().replace("www.", "") != HOST:
            return ("EXTERNAL", h)
        h = m.group(2) or "/"
    if h.startswith("//"):
        return ("EXTERNAL", href)
    if not h.startswith("/"):
        # 相对链接：极少见，按当前目录解析
        base = page_url if page_url.endswith("/") else page_url.rsplit("/", 1)[0] + "/"
        h = os.path.normpath(base + h).replace(os.sep, "/")
    h = h.split("#")[0].split("?")[0]
    if h.endswith("/index.html"):
        h = h[: -len("index.html")]
    if h == "/index.html":
        h = "/"
    if not h.endswith("/") and "." not in h.rsplit("/", 1)[-1]:
        h += "/"                              # /pricing -> /pricing/
    return ("INTERNAL", h)


# ---------- HTML 解析：区分模板链接与正文链接 ----------
class LinkParser(HTMLParser):
    TEMPLATE_TAGS = {"header", "footer", "nav"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []           # (tag, is_template_block)
        self.tmpl_depth = 0
        self.links = []           # dict(href, text, zone)
        self.cur = None
        self.text_buf = []
        self.h1 = []
        self._in_h1 = 0
        self.div_stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        is_tmpl = tag in self.TEMPLATE_TAGS
        if tag == "div":
            cls = a.get("class", "") or ""
            aid = a.get("id", "") or ""
            if "consent-banner" in cls or aid == "geoscore-consent-banner":
                is_tmpl = True
        if is_tmpl:
            self.tmpl_depth += 1
        self.stack.append((tag, is_tmpl))
        if tag == "h1":
            self._in_h1 += 1
            self.h1.append("")
        if tag == "a":
            self.cur = {"href": a.get("href"), "zone": "template" if self.tmpl_depth > 0 else "content",
                        "class": a.get("class", ""), "aria": a.get("aria-label", "")}
            self.text_buf = []

    def handle_endtag(self, tag):
        if tag == "a" and self.cur is not None:
            self.cur["text"] = re.sub(r"\s+", " ", " ".join(self.text_buf)).strip()
            self.links.append(self.cur)
            self.cur = None
            self.text_buf = []
        if tag == "h1":
            self._in_h1 = max(0, self._in_h1 - 1)
        # 出栈到匹配的 tag
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for _, is_tmpl in self.stack[i:]:
                    if is_tmpl:
                        self.tmpl_depth = max(0, self.tmpl_depth - 1)
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        if self.cur is not None:
            self.text_buf.append(data)
        if self._in_h1 and self.h1:
            self.h1[-1] += data


def parse_page(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        html = f.read()
    p = LinkParser()
    p.feed(html)
    return p


def main():
    rels = []
    for dirpath, _, files in os.walk(DIST):
        for fn in files:
            if fn.endswith(".html"):
                rels.append(os.path.relpath(os.path.join(dirpath, fn), DIST))
    rels.sort()
    pages = {file_to_url(r): r for r in rels}

    pages_set = set(pages)
    edges = []           # (src, dst, text, zone)
    unresolved = Counter()
    external = Counter()

    for url, rel in pages.items():
        p = parse_page(os.path.join(DIST, rel))
        for l in p.links:
            n = normalize_href(l["href"], url)
            if n is None:
                continue
            kind, val = n
            if kind == "EXTERNAL":
                external[val] += 1
                continue
            if val not in pages_set:
                unresolved[val] += 1
                continue
            edges.append({"src": url, "dst": val, "text": l["text"], "zone": l["zone"],
                          "class": l.get("class", "")})

    # ---- 入链统计 ----
    inb_all = Counter()
    inb_content = Counter()
    srcs_all = defaultdict(set)
    srcs_content = defaultdict(set)
    for e in edges:
        inb_all[e["dst"]] += 1
        srcs_all[e["dst"]].add(e["src"])
        if e["zone"] == "content":
            inb_content[e["dst"]] += 1
            srcs_content[e["dst"]].add(e["src"])

    # 自链接单独统计（页内锚点/同页链接）
    self_links = Counter(e["src"] for e in edges if e["src"] == e["dst"])

    # ---- 主题聚类 ----
    def cluster(u):
        if u.startswith("/blog/"):
            return "blog"
        if u.startswith("/tools/") or u.startswith("/report/"):
            return "tool"
        if u in ("/", "/methodology/", "/pricing/"):
            return "core"
        if u.startswith("/zh/"):
            return "zh"
        return "legal"

    matrix = defaultdict(lambda: Counter())     # src_cluster -> dst_cluster -> 边数(content)
    matrix_all = defaultdict(lambda: Counter())
    for e in edges:
        matrix_all[cluster(e["src"])][cluster(e["dst"])] += 1
        if e["zone"] == "content":
            matrix[cluster(e["src"])][cluster(e["dst"])] += 1

    # ---- 锚文本质量 ----
    GENERIC = {"learn more", "read more", "read more →", "click here", "here", "more",
               "see more", "details", "view", "link", "this page", "→", ">>",
               "learn more →", "view all", "read the guide", "check it out"}
    def is_generic(t, cls="", aria=""):
        s = (t or "").strip().lower().rstrip("→›>» .").strip()
        if not s:
            return True                      # icon-only / empty
        return s in GENERIC

    anchor_stats = {"content_total": 0, "content_generic": 0, "template_total": 0, "template_generic": 0}
    generic_examples = []
    content_anchors = Counter()
    for e in edges:
        g = is_generic(e["text"])
        k = "content" if e["zone"] == "content" else "template"
        anchor_stats[k + "_total"] += 1
        if g:
            anchor_stats[k + "_generic"] += 1
            if e["zone"] == "content" and len(generic_examples) < 40:
                generic_examples.append((e["src"], e["dst"], e["text"] or "<空>"))
        if e["zone"] == "content":
            content_anchors[(e["src"], e["dst"], e["text"])] += 1

    out = {
        "pages": sorted(pages_set),
        "page_count": len(pages_set),
        "edge_count": len(edges),
        "edges": edges,
        "inbound_all": dict(inb_all),
        "inbound_content": dict(inb_content),
        "srcs_content": {k: sorted(v) for k, v in srcs_content.items()},
        "srcs_all": {k: sorted(v) for k, v in srcs_all.items()},
        "self_links": dict(self_links),
        "unresolved": dict(unresolved),
        "external_unique": len(external),
        "cluster_matrix_content": {k: dict(v) for k, v in matrix.items()},
        "cluster_matrix_all": {k: dict(v) for k, v in matrix_all.items()},
        "anchor_stats": anchor_stats,
        "generic_examples": generic_examples,
    }
    with open(os.path.join(ROOT, "review", "_linkgraph.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print("页面数:", len(pages_set), " 内链边数:", len(edges))
    print("未解析为已知页面的内部目标:", dict(unresolved.most_common(15)))
    print("自链接:", dict(self_links))
    print("\n=== 入链排行 (总入链 / 正文入链 / 独立来源数) ===")
    for u in sorted(pages_set, key=lambda x: (-inb_all[x], -inb_content[x])):
        print(f"{inb_all[u]:4d} {inb_content[u]:4d} {len(srcs_all[u]):3d}  {u}")
    print("\n=== 孤岛候选（总入链=0） ===")
    print([u for u in sorted(pages_set) if inb_all[u] == 0])
    print("\n=== 仅模板链接（正文入链=0 但总入链>0） ===")
    print([u for u in sorted(pages_set) if inb_all[u] > 0 and inb_content[u] == 0])
    print("\n=== content 聚类矩阵 ===")
    for k in matrix:
        print(k, dict(matrix[k]))
    print("\n锚文本:", anchor_stats)
    print("泛化锚文本示例:", generic_examples[:25])


if __name__ == "__main__":
    main()
