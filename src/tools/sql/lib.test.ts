import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { format, minify, tokenize, statements } from '../../../public/_/sql/lib.js';

test('keywords inside strings and quoted names are untouched', () => {
  const f = format(`select 'select from where', "order" from t where x = 'a -- b' and y = 'it''s /* no */'`);
  assert.match(f, /'select from where'/);
  assert.match(f, /"order"/);
  assert.match(f, /'a -- b'/);
  assert.match(f, /'it''s \/\* no \*\/'/);
  assert.equal(minify(`select  'a   b' ,  "x  y"  from t`), `select 'a   b',"x  y" from t`);
});

test('clauses on their own lines, AND/OR broken, BETWEEN kept together', () => {
  assert.equal(
    format('select a, b from t where x = 1 and y between 2 and 3 or z is null order by a desc limit 5'),
    'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  x = 1\n  AND y BETWEEN 2 AND 3\n  OR z IS NULL\nORDER BY\n  a DESC\nLIMIT 5',
  );
});

test('joins and ON', () => {
  assert.equal(
    format('select * from a left outer join b on a.id = b.id and b.x > 0 join c on c.id = a.c'),
    'SELECT\n  *\nFROM\n  a\n  LEFT OUTER JOIN b\n    ON a.id = b.id\n    AND b.x > 0\n  JOIN c\n    ON c.id = a.c',
  );
});

test('nested subqueries are indented, function parens stay inline', () => {
  assert.equal(
    format('select count(*), coalesce(a, 1) from (select a from (select a from t) x) y where a in (1, 2)'),
    'SELECT\n  count(*),\n  coalesce(a, 1)\nFROM\n  (\n    SELECT\n      a\n    FROM\n      (\n        SELECT\n          a\n        FROM\n          t\n      ) x\n  ) y\nWHERE\n  a IN (1, 2)',
  );
});

test('CASE and CTE', () => {
  const f = format("with x as (select 1 as n), y as (select 2) select case when n > 1 then 'a' else 'b' end as k from x");
  assert.equal(
    f,
    "WITH\n  x AS (\n    SELECT\n      1 AS n\n  ),\n  y AS (\n    SELECT\n      2\n  )\nSELECT\n  CASE\n    WHEN n > 1 THEN 'a'\n    ELSE 'b'\n  END AS k\nFROM\n  x",
  );
});

test('comments: line comments end their line, minify strips them but keeps hints', () => {
  const src = 'select a, -- first\n b /* second */ from t /*+ INDEX(t i) */';
  assert.equal(format(src), 'SELECT\n  a, -- first\n  b /* second */\nFROM\n  t /*+ INDEX(t i) */');
  assert.equal(minify(src), 'select a,b from t /*+ INDEX(t i) */');
});

test('semicolon-separated statements', () => {
  assert.equal(format('select 1; select 2;'), 'SELECT\n  1;\n\nSELECT\n  2;');
  assert.equal(statements("select ';'; ; select 2"), 2);
});

test('options: lower case, comma first, tabs, dialect quoting', () => {
  assert.equal(format('SELECT a, b FROM t', { keywordCase: 'lower', commaFirst: true, indent: '\t' }), 'select\n\ta\n\t, b\nfrom\n\tt');
  assert.equal(format('select "a""b", `c` from t', { dialect: 'postgres' }), 'SELECT\n  "a""b",\n  "c"\nFROM\n  t');
  assert.equal(minify('select `a`, [b] from t', { dialect: 'sqlite' }), 'select "a","b" from t');
  assert.equal(minify('select "a" from t', { dialect: 'mysql' }), 'select "a" from t'); // a string in MySQL, untouched
});

test('postgres specifics: casts, dollar quotes, E strings, operators', () => {
  assert.equal(minify("select x::int, $$ a ; b $$, E'it\\'s', j->>'k' from t", { dialect: 'postgres' }), "select x::int,$$ a ; b $$,E'it\\'s',j->>'k' from t");
  assert.equal(format('select -1, a - -2, x::text'), 'SELECT\n  -1,\n  a - -2,\n  x::TEXT');
});

test('insert, update and unions', () => {
  assert.equal(format("insert into t (a, b) values (1, 'x'), (2, 'y')"), "INSERT INTO t (a, b)\nVALUES\n  (1, 'x'),\n  (2, 'y')");
  assert.equal(format('update t set a = 1, b = 2 where id = 3'), 'UPDATE t\nSET\n  a = 1,\n  b = 2\nWHERE\n  id = 3');
  assert.equal(format('select 1 union all select 2'), 'SELECT\n  1\nUNION ALL\nSELECT\n  2');
});

test('errors carry a location', () => {
  assert.throws(() => tokenize("select 'oops"), /Unterminated string at line 1, column 8/);
  assert.throws(() => tokenize('select 1 /* never closed'), /comment at line 1/);
});

test('review fixes: FOR UPDATE, ON after a joined subquery, adjacent literals', () => {
  assert.match(format('select * from t for update'), /\n {2}t\nFOR UPDATE$/);
  assert.match(format('select a from (select x from t) s join (select y from u) u2 on u2.y = s.x'), /\) u2\n {4}ON u2\.y = s\.x/);
  // PostgreSQL only concatenates adjacent string constants across a newline, so the newline must survive
  assert.equal(minify("select 'a'\n'b'"), "select 'a'\n'b'");
  assert.match(format("select 'a'\n'b'"), /'a'\n {2}'b'/);
  assert.equal(minify("select 'a' 'b'"), "select 'a' 'b'");
});
