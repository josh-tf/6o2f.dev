import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { parse, parseTree, render, toPaths, detect, count } from '../../../public/_/tree/lib.js';

const PATHS = 'src/index.ts\nsrc/lib/util.ts   # helpers\nREADME.md\nsrc/lib/\ndocs/\n./package.json';

test('detects input kinds', () => {
  assert.equal(detect(PATHS), 'paths');
  assert.equal(detect('src\n  index.ts'), 'indent');
  assert.equal(detect('.:\nsrc\n\n./src:\na.ts'), 'lsr');
  assert.equal(detect('.\n├── a\n└── b'), 'tree');
  assert.equal(detect('.\n|-- a\n`-- b'), 'tree');
});

test('paths → unicode tree, keeping input order', () => {
  const { root } = parse(PATHS);
  assert.equal(render(root), ['├── src', '│   ├── index.ts', '│   └── lib', '│       └── util.ts', '├── README.md', '├── docs', '└── package.json'].join('\n'));
  assert.deepEqual(count(root), { dirs: 3, files: 4 });
});

test('options: dirs first, sort, slash, comments, root, ascii, markdown', () => {
  const { root } = parse(PATHS);
  assert.equal(
    render(root, { dirsFirst: true, sort: true, slash: true, comments: true, root: 'app/' }),
    ['app/', '├── docs/', '├── src/', '│   ├── lib/', '│   │   └── util.ts  # helpers', '│   └── index.ts', '├── package.json', '└── README.md'].join('\n'),
  );
  assert.equal(render(parse('a/b\nc').root, { style: 'ascii' }), '|-- a\n|   `-- b\n`-- c');
  assert.equal(render(parse('a/b\nc').root, { style: 'markdown', slash: true }), '- a/\n  - b\n- c');
  assert.equal(render(parse('a/b').root, { style: 'markdown', root: '.' }), '- .\n  - a\n    - b');
});

test('indented list with bullets, tabs and ragged indentation', () => {
  const { root } = parse('project/\n  - src/\n      main.go   # entry\n     util.go\n  README.md\n  LICENSE\nnotes');
  assert.equal(
    render(root, { slash: true }),
    ['├── project/', '│   ├── src/', '│   │   ├── main.go', '│   │   └── util.go', '│   ├── README.md', '│   └── LICENSE', '└── notes'].join('\n'),
  );
  assert.equal(root.children[0].children[0].children[0].comment, 'entry');
  assert.deepEqual(toPaths(parse('a\n\tb\n\t\tc\n\td').root), ['a/', 'a/b/', 'a/b/c', 'a/d']);
});

test('find, tar -t, windows paths and ls -R', () => {
  assert.deepEqual(toPaths(parse('.\n./a\n./a/b.txt\n./c').root), ['a/', 'a/b.txt', 'c']);
  assert.deepEqual(toPaths(parse('pkg/\npkg/bin/\npkg/bin/tool\npkg/README').root), ['pkg/', 'pkg/bin/', 'pkg/bin/tool', 'pkg/README']);
  assert.deepEqual(toPaths(parse('C:\\proj\\a.txt'.replace('C:', '')).root), ['proj/', 'proj/a.txt']);
  const ls = '.:\nREADME.md  src\n\n./src:\nlib  main.c\n\n./src/lib:\nutil.c';
  assert.deepEqual(toPaths(parse(ls).root), ['README.md', 'src/', 'src/lib/', 'src/lib/util.c', 'src/main.c']);
});

test('reverse: unicode tree → paths, with root and comments', () => {
  const t = 'my-app/\n├── src/\n│   ├── index.ts      # entry\n│   └── lib\n│       └── a.ts\n├── package.json\n└── README.md\n\n3 directories, 4 files';
  const { root, rootLabel } = parseTree(t);
  assert.equal(rootLabel, 'my-app/');
  assert.deepEqual(toPaths(root), ['src/', 'src/index.ts', 'src/lib/', 'src/lib/a.ts', 'package.json', 'README.md']);
  assert.deepEqual(toPaths(root, { filesOnly: true, prefix: 'my-app' }), [
    'my-app/src/index.ts',
    'my-app/src/lib/a.ts',
    'my-app/package.json',
    'my-app/README.md',
  ]);
  assert.deepEqual(toPaths(root, { comments: true })[1], 'src/index.ts  # entry');
});

test('reverse: ascii, windows tree /A and short connectors', () => {
  assert.deepEqual(toPaths(parseTree('.\n|-- a\n|   |-- b\n|   `-- c\n`-- d').root), ['a/', 'a/b', 'a/c', 'd']);
  assert.deepEqual(toPaths(parseTree('C:.\n+---src\n|   \\---main\n\\---docs').root), ['src/', 'src/main', 'docs']);
  assert.deepEqual(toPaths(parseTree('├─ a\n│  └─ b\n└─ c').root), ['a/', 'a/b', 'c']);
});

test('round trip: render then parse gives the same paths', () => {
  const src = 'a/b/c.txt\na/d\ne/f/g/h.md\ni';
  const { root } = parse(src);
  for (const style of ['unicode', 'ascii']) assert.deepEqual(toPaths(parseTree(render(root, { style })).root), toPaths(root));
  assert.deepEqual(toPaths(parse(render(root, { style: 'markdown' })).root), toPaths(root));
});

test('review fix: Windows tree /F /A header lines are skipped', () => {
  const r = parseTree('Folder PATH listing for volume OS\nVolume serial number is 1234-ABCD\nC:.\n|   a.txt\n|\n\\---src\n        b.ts\n');
  assert.deepEqual(toPaths(r.root), ['a.txt', 'src/', 'src/b.ts']);
  assert.equal(r.rootLabel, 'C:.');
});
