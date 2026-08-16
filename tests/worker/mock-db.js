/**
 * Minimal in-memory D1 mock covering the SQL patterns used by worker/pro.js.
 * Supports: SELECT/INSERT/UPDATE/DELETE, WHERE k=? / k='lit' / k>? / k<?,
 * COUNT(*) AS c, ORDER BY col ASC|DESC, LIMIT n, AND conditions.
 * UPDATE parameters are consumed in SQL text order (SET placeholders first,
 * then WHERE placeholders).
 */
export function createMockDb(seed = {}) {
  const tables = { sites: [], audits: [], subscriptions: [], users: [], verify_codes: [], webhook_events: [] };
  for (const [name, rows] of Object.entries(seed)) {
    if (!tables[name]) tables[name] = [];
    tables[name].push(...rows.map(r => ({ ...r })));
  }

  function tableName(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function whereClause(sql) {
    const idx = sql.toUpperCase().indexOf('WHERE');
    if (idx < 0) return '';
    return sql
      .slice(idx + 5)
      .replace(/\s+ORDER BY\s+[\s\S]*$/i, '')
      .replace(/\s+LIMIT\s+[\s\S]*$/i, '')
      .trim();
  }

  function buildPredicate(clause, params) {
    if (!clause) return () => true;
    const conds = [];
    for (const part of clause.split(/\s+AND\s+/i)) {
      const m = part.match(/^\s*([a-z_]+)\s*(=|>|<|>=|<=)\s*(\?|'[^']*')\s*$/i);
      if (!m) continue;
      const [, col, op, val] = m;
      let value = val;
      if (val === '?') value = params.length ? params.shift() : undefined;
      else value = val.replace(/^'|'$/g, '');
      conds.push([col, op, value]);
    }
    return row => conds.every(([col, op, value]) => {
      const rv = row[col];
      if (op === '=') return rv === value;
      if (op === '>') return rv > value;
      if (op === '<') return rv < value;
      if (op === '>=') return rv >= value;
      if (op === '<=') return rv <= value;
      return false;
    });
  }

  function orderLimit(sql, rows) {
    let result = rows;
    const orderMatch = sql.match(/ORDER BY\s+([a-z_]+)\s+(ASC|DESC)/i);
    if (orderMatch) {
      const [, col, dir] = orderMatch;
      result = [...result].sort((a, b) => {
        const av = a[col] == null ? -1 : a[col];
        const bv = b[col] == null ? -1 : b[col];
        return dir.toUpperCase() === 'DESC' ? (bv > av ? 1 : bv < av ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0);
      });
    }
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) result = result.slice(0, parseInt(limitMatch[1], 10));
    return result;
  }

  function countPlaceholders(str) {
    return (str.match(/\?/g) || []).length;
  }

  function literalValue(v) {
    if (v === 'null') return null;
    if (/^\d+$/.test(v)) return Number(v);
    return v.replace(/^'|'$/g, '');
  }
  function prepare(sql) {
    const stmt = params => ({
        async first() {
          const t = tables[tableName(sql)];
          if (!t) return null;
          const rows = orderLimit(sql, t.filter(buildPredicate(whereClause(sql), params)));
          if (/COUNT\(/i.test(sql)) {
            const m = sql.match(/AS\s+([a-z_]+)/i);
            const alias = m ? m[1] : 'c';
            return { [alias]: rows.length };
          }
          return rows[0] || null;
        },
        async all() {
          const t = tables[tableName(sql)];
          if (!t) return { results: [] };
          const rows = orderLimit(sql, t.filter(buildPredicate(whereClause(sql), params)));
          return { results: rows };
        },
        async run() {
          const t = tableName(sql);
          const rows = tables[t] || [];
          if (/^INSERT/i.test(sql.trim())) {
            const colMatch = sql.match(/INSERT INTO\s+[a-z_]+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
            if (colMatch) {
              const cols = colMatch[1].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
              const vals = colMatch[2].split(',').map(v => v.trim());
              const row = {};
              let pi = 0;
              cols.forEach((col, i) => {
                const v = vals[i];
                row[col] = v === '?' ? params[pi++] : literalValue(v);
              });
              const conflict = sql.match(/ON CONFLICT\(([a-z_]+)\)\s+DO NOTHING/i);
              if (conflict && rows.some(r => r[conflict[1]] === row[conflict[1]])) {
                return { meta: { changes: 0 } };
              }
              rows.push(row);
            }
            return { meta: { changes: 1 } };
          }
          if (/^UPDATE/i.test(sql.trim())) {
            const setMatch = sql.match(/SET\s+([\s\S]+?)(?:\s+WHERE\b|$)/i);
            const setClause = setMatch ? setMatch[1] : '';
            const setParams = params.splice(0, countPlaceholders(setClause));
            const pred = buildPredicate(whereClause(sql), params);
            const matched = rows.filter(pred);
            for (const row of matched) {
              for (const set of setClause.split(',').map(s => s.trim())) {
                const sm = set.match(/^([a-z_]+)\s*=\s*(\?|'[^']*'|null|\d+)/i);
                if (!sm) continue;
                const [, col, val] = sm;
                if (val === '?') row[col] = setParams.shift();
                else row[col] = literalValue(val);
              }
            }
            return { meta: { changes: matched.length } };
          }
          if (/^DELETE/i.test(sql.trim())) {
            const pred = buildPredicate(whereClause(sql), params);
            const matched = rows.filter(pred);
            rows.splice(0, rows.length, ...rows.filter(r => !pred(r)));
            return { meta: { changes: matched.length } };
          }
          return { meta: { changes: 0 } };
        },
    });
    return {
      bind: (...args) => stmt([...args]),
      first: () => stmt([]).first(),
      all: () => stmt([]).all(),
      run: () => stmt([]).run(),
    };
  }

  return {
    prepare,
    async batch(statements) {
      for (const stmt of statements) await stmt.run();
      return [];
    },
    _tables: tables,
  };
}



