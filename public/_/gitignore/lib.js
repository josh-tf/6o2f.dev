// .gitignore templates (condensed from github/gitignore, CC0) and the combiner.
const T = (group, name, alias, text) => ({
  group,
  name,
  alias,
  lines: text
    .trim()
    .split('\n')
    .map((l) => l.trim()),
});
export const TEMPLATES = {
  node: T(
    'Languages',
    'Node',
    'javascript js typescript ts npm yarn pnpm bun next nuxt',
    `
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.npm/
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
.eslintcache
.stylelintcache
*.tsbuildinfo

# Framework and bundler caches
.cache/
.next/
.nuxt/
.svelte-kit/
.astro/
.parcel-cache/
.turbo/
.vite/
.vercel/`,
  ),
  python: T(
    'Languages',
    'Python',
    'py pip venv django flask jupyter poetry uv',
    `
__pycache__/
*.py[cod]
*$py.class
*.so

# Packaging
.Python
build/
dist/
*.egg-info/
.eggs/
*.egg
wheels/

# Environments
.venv/
venv/
env/
ENV/

# Tools
.tox/
.nox/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.pyre/
.ipynb_checkpoints/
htmlcov/
.coverage
.coverage.*
instance/`,
  ),
  go: T(
    'Languages',
    'Go',
    'golang',
    `
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
go.work
go.work.sum`,
  ),
  rust: T(
    'Languages',
    'Rust',
    'cargo',
    `
/target/
**/*.rs.bk
*.pdb`,
  ),
  java: T(
    'Languages',
    'Java',
    'maven gradle jvm',
    `
*.class
*.ctxt
*.jar
*.war
*.nar
*.ear
!gradle/wrapper/gradle-wrapper.jar
hs_err_pid*
replay_pid*

# Maven and Gradle
target/
.gradle/
build/
.mtj.tmp/`,
  ),
  kotlin: T(
    'Languages',
    'Kotlin',
    'gradle jvm kts',
    `
*.class
*.jar
!gradle/wrapper/gradle-wrapper.jar
.kotlin/
.gradle/
build/
out/
hs_err_pid*`,
  ),
  swift: T(
    'Languages',
    'Swift / Xcode',
    'ios macos xcode cocoapods spm objective-c',
    `
xcuserdata/
DerivedData/
build/
*.xcscmblueprint
*.xccheckout
*.moved-aside
*.pbxuser
!default.pbxuser
*.mode1v3
!default.mode1v3
*.mode2v3
!default.mode2v3
*.perspectivev3
!default.perspectivev3
*.hmap
*.ipa
*.dSYM.zip
*.dSYM
timeline.xctimeline
playground.xcworkspace

# Swift Package Manager
.build/
.swiftpm/

# fastlane
fastlane/report.xml
fastlane/Preview.html
fastlane/screenshots/**/*.png
fastlane/test_output`,
  ),
  c: T(
    'Languages',
    'C',
    'gcc clang make',
    `
# Objects and libraries
*.o
*.ko
*.obj
*.elf
*.gch
*.pch
*.lib
*.a
*.la
*.lo
*.dll
*.so
*.so.*
*.dylib

# Executables and debug files
*.exe
*.out
*.app
*.i*86
*.x86_64
*.hex
*.dSYM/
*.su
*.idb
*.pdb
*.ilk
*.map
*.exp`,
  ),
  cpp: T(
    'Languages',
    'C++',
    'cpp cxx cmake',
    `
*.d
*.slo
*.lo
*.o
*.obj
*.gch
*.pch
*.so
*.dylib
*.dll
*.mod
*.smod
*.lai
*.la
*.a
*.lib
*.exe
*.out
*.app

# CMake
CMakeLists.txt.user
CMakeCache.txt
CMakeFiles/
CMakeScripts/
cmake_install.cmake
install_manifest.txt
compile_commands.json
CTestTestfile.cmake
_deps/
cmake-build-*/`,
  ),
  dotnet: T(
    'Languages',
    'C# / .NET',
    'csharp cs dotnet visual studio nuget fsharp',
    `
[Bb]in/
[Oo]bj/
[Dd]ebug/
[Rr]elease/
x64/
x86/
artifacts/
.vs/
*.user
*.suo
*.rsuser
*.userosscache
*.sln.docstates
*.DotSettings.user
_ReSharper*/

# Tests and packages
TestResults/
[Tt]est[Rr]esult*/
BenchmarkDotNet.Artifacts/
*.nupkg
*.snupkg
**/[Pp]ackages/*
!**/[Pp]ackages/build/
project.lock.json
project.fragment.lock.json`,
  ),
  php: T(
    'Languages',
    'PHP',
    'composer laravel symfony',
    `
/vendor/
composer.phar
.phpunit.result.cache
.phpunit.cache/
.php-cs-fixer.cache
.php_cs.cache

# Laravel
/public/storage
/public/hot
/storage/*.key
/bootstrap/cache/*.php`,
  ),
  ruby: T(
    'Languages',
    'Ruby',
    'rails bundler gem rake',
    `
*.gem
*.rbc
/.config
/coverage/
/pkg/
/spec/reports/
/spec/examples.txt
/test/tmp/
/test/version_tmp/
/tmp/
.byebug_history
/.bundle/
/vendor/bundle
/.yardoc/
/_yardoc/
/doc/
/rdoc/

# Rails
/log/*
/storage/*
/public/assets
/config/master.key`,
  ),
  dart: T(
    'Languages',
    'Dart / Flutter',
    'flutter pub',
    `
.dart_tool/
.packages
.pub-cache/
.pub/
build/
doc/api/

# Flutter
.flutter-plugins
.flutter-plugins-dependencies
.fvm/flutter_sdk
**/ios/Flutter/.last_build_id
app.*.symbols
app.*.map.json
/android/app/debug
/android/app/profile
/android/app/release`,
  ),
  android: T(
    'Platforms',
    'Android',
    'gradle apk kotlin',
    `
*.apk
*.aar
*.ap_
*.aab
*.dex
*.class
bin/
gen/
out/
.gradle/
build/
local.properties
proguard/
captures/
.externalNativeBuild/
.cxx/
.navigation/
*.jks
*.keystore
lint/intermediates/
lint/generated/
lint/outputs/
lint/tmp/`,
  ),
  unity: T(
    'Platforms',
    'Unity',
    'game engine c#',
    `
/[Ll]ibrary/
/[Tt]emp/
/[Oo]bj/
/[Bb]uild/
/[Bb]uilds/
/[Ll]ogs/
/[Uu]ser[Ss]ettings/
/[Mm]emoryCaptures/
/[Rr]ecordings/
/[Aa]ssets/Plugins/Editor/JetBrains*
.consulo/
ExportedObj/

# Generated IDE and build files
*.csproj
*.unityproj
*.sln
*.suo
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db
*.pidb.meta
*.pdb.meta
*.mdb.meta
sysinfo.txt
crashlytics-build.properties

# Builds and packages
*.apk
*.aab
*.unitypackage
*.app
/[Aa]ssets/[Aa]ddressable[Aa]ssets[Dd]ata/*/*.bin*
/[Aa]ssets/[Ss]treamingAssets/aa.meta
/[Aa]ssets/[Ss]treamingAssets/aa/*`,
  ),
  godot: T(
    'Platforms',
    'Godot',
    'game engine gdscript',
    `
# Godot 4
.godot/
/android/

# Godot 3
.import/
export.cfg
export_credentials.cfg
*.translation

# Mono / C#
.mono/
data_*/
mono_crash.*.json`,
  ),
  terraform: T(
    'Tools',
    'Terraform',
    'opentofu hcl iac',
    `
**/.terraform/*
*.tfstate
*.tfstate.*
.terraform.tfstate.lock.info
crash.log
crash.*.log
# Variable files often hold secrets
*.tfvars
*.tfvars.json
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc
# Commit .terraform.lock.hcl; it pins provider versions.`,
  ),
  docker: T(
    'Tools',
    'Docker',
    'compose container',
    `
# Local compose overrides (machine-specific ports, mounts, secrets)
docker-compose.override.yml
docker-compose.override.yaml
compose.override.yml
compose.override.yaml
# What goes into images is set by .dockerignore, not this file.`,
  ),
  wrangler: T(
    'Tools',
    'Cloudflare Workers',
    'wrangler workers pages miniflare',
    `
.wrangler/
.dev.vars
.dev.vars.*
.mf/`,
  ),
  macos: T(
    'Operating systems',
    'macOS',
    'mac osx apple ds_store finder',
    `
.DS_Store
.AppleDouble
.LSOverride
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent
.AppleDB
.AppleDesktop
Network Trash Folder
Temporary Items
.apdisk`,
  ),
  windows: T(
    'Operating systems',
    'Windows',
    'win explorer thumbs',
    `
Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
*.stackdump
[Dd]esktop.ini
$RECYCLE.BIN/
*.cab
*.msi
*.msix
*.msm
*.msp
*.lnk`,
  ),
  linux: T(
    'Operating systems',
    'Linux',
    'kde gnome nfs',
    `
*~
.fuse_hidden*
.directory
.Trash-*
.nfs*`,
  ),
  jetbrains: T(
    'Editors',
    'JetBrains',
    'idea intellij pycharm webstorm goland rider clion android studio',
    `
# Ignore all IDE settings; to share run configs, commit .idea/runConfigurations/ instead.
.idea/
*.iml
*.ipr
*.iws
out/
.idea_modules/
atlassian-ide-plugin.xml
cmake-build-*/
http-client.private.env.json`,
  ),
  vscode: T(
    'Editors',
    'VS Code',
    'visual studio code vscodium cursor',
    `
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
!.vscode/*.code-snippets
.history/
*.vsix`,
  ),
  vim: T(
    'Editors',
    'Vim',
    'neovim nvim swap',
    `
[._]*.s[a-v][a-z]
!*.svg
[._]*.sw[a-p]
[._]s[a-rt-v][a-z]
[._]ss[a-gi-z]
[._]sw[a-p]
Session.vim
Sessionx.vim
.netrwhist
*~
tags
[._]*.un~`,
  ),
  emacs: T(
    'Editors',
    'Emacs',
    'elisp spacemacs doom',
    `
*~
\\#*\\#
/.emacs.desktop
/.emacs.desktop.lock
*.elc
auto-save-list
tramp
.\\#*
.org-id-locations
*_archive
*_flymake.*
/eshell/history
/eshell/lastdir
/elpa/
*.rel
/auto/
.cask/
flycheck_*.el
/server/
.projectile`,
  ),
  dotenv: T(
    'General',
    'dotenv',
    'env secrets environment variables direnv',
    `
.env
.env.*
!.env.example
!.env.sample
!.env.template
.envrc`,
  ),
  logs: T(
    'General',
    'Logs',
    'log',
    `
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*`,
  ),
  build: T(
    'General',
    'Build / dist',
    'output artifacts bundle',
    `
build/
dist/
out/
.output/`,
  ),
  coverage: T(
    'General',
    'Coverage',
    'test istanbul nyc lcov jest vitest',
    `
coverage/
*.lcov
.nyc_output/
lib-cov/
htmlcov/
.coverage
.coverage.*
coverage.xml
*.cover
*.coverprofile`,
  ),
};
export const GROUPS = ['Languages', 'Platforms', 'Tools', 'Operating systems', 'Editors', 'General'];

/** Ids whose name, id or aliases contain every word of `q`, best first: an exact id/name/alias word, then a word prefix, then a substring
 * (so "java" ranks Java above Node, whose alias "javascript" merely contains it). */
export function search(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (id) => {
    const t = TEMPLATES[id],
      toks = `${id} ${t.name} ${t.alias}`
        .toLowerCase()
        .split(/[\s/]+/)
        .filter(Boolean),
      hay = toks.join(' ');
    let s = 0;
    for (const w of words) {
      if (!hay.includes(w)) return -1;
      s += toks.includes(w) ? 2 : toks.some((x) => x.startsWith(w)) ? 1 : 0;
    }
    return s + (id === words.join(' ') || t.name.toLowerCase() === words.join(' ') ? 10 : 0);
  };
  return Object.keys(TEMPLATES)
    .map((id) => [id, score(id)])
    .filter((x) => x[1] >= 0)
    .sort((a, b) => b[1] - a[1])
    .map((x) => x[0]);
}

/**
 * Combine templates: a `### Name ###` header per template, each pattern only the first time it appears,
 * a comment dropped when every pattern it introduces was a duplicate.
 * ponytail: first-occurrence de-dup can in theory reorder a pattern relative to a later template's negation (!x); none of these templates do that.
 */
export function combine(ids) {
  const seen = new Set(),
    out = [];
  for (const id of ids) {
    const t = TEMPLATES[id];
    if (!t) throw new Error(`Unknown template "${id}".`);
    const body = [];
    let comments = [],
      kept = 0;
    for (const l of t.lines) {
      if (!l) {
        comments = [];
        if (body.length && body.at(-1) !== '') body.push('');
        continue;
      }
      if (l.startsWith('#') && !l.startsWith('\\#')) {
        comments.push(l);
        continue;
      }
      if (seen.has(l)) continue;
      seen.add(l);
      body.push(...comments, l);
      comments = [];
      kept++;
    }
    if (comments.length && kept) body.push(...comments); // trailing advice comments
    while (body.at(-1) === '') body.pop();
    out.push(`### ${t.name} ###`, ...(kept ? body : ['# (every pattern is already listed above)']), '');
  }
  return out.join('\n');
}
