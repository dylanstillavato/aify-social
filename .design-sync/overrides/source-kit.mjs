// forked from design-sync lib/source-kit.mjs - aify's components use
// `export default function Name(...)` / `export default class Name ...`
// (app-code convention, not a published-library one). `export * from` never
// re-exports a default, so the synth entry silently dropped every
// default-exported component from window.<globalName>. This fork adds an
// explicit `export { default as Name } from '<path>'` alias alongside the
// `export *` line whenever a file's default export name is staticly
// recoverable, so those components land on the bundle like everything else.
// Everything else is unchanged from the bundled adapter.

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { Project, Node, ts } from 'ts-morph';
import { leadingJsdoc, readText, slash, walk } from '../../.ds-sync/lib/common.mjs';
import { resolveDistEntry } from '../../.ds-sync/lib/bundle.mjs';
import { exportedNames, isComponentName } from '../../.ds-sync/lib/dts.mjs';

const NON_IMPL_RX = /\.(stories|test|spec)\./;
const SRC_IMPL_RX = /\.(tsx|jsx)$/;
const GENERIC_DIR = new Set(['components', 'component', 'src', 'lib', 'ui', 'packages', 'react']);
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';

// Recover a statically-named default export so it can be re-exported by
// name (`export * from` never carries `export default` across).
const DEFAULT_FN_OR_CLASS_RX = /export\s+default\s+(?:function|class)\s+([A-Z][A-Za-z0-9]*)\b/;
const DEFAULT_BARE_IDENT_RX = /export\s+default\s+([A-Z][A-Za-z0-9]*)\s*;?\s*$/m;
function defaultExportName(text) {
  return DEFAULT_FN_OR_CLASS_RX.exec(text)?.[1] ?? DEFAULT_BARE_IDENT_RX.exec(text)?.[1] ?? null;
}

function deriveComponentsFromSrc(srcFiles) {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true, skipLibCheck: true },
  });
  const seen = new Set();
  for (const p of srcFiles) {
    if (NON_IMPL_RX.test(p) || !SRC_IMPL_RX.test(p)) continue;
    const sf = project.addSourceFileAtPathIfExists(p);
    if (!sf) continue;
    for (const [name, decls] of sf.getExportedDeclarations()) {
      const real = name === 'default'
        ? decls.map((d) => d.getName?.()).find((n) => n && n !== 'default')
        : name;
      if (!real || !/^[A-Z][A-Za-z0-9]*$/.test(real)) continue;
      if (decls.some((d) => Node.isVariableDeclaration(d) || Node.isFunctionDeclaration(d) || Node.isClassDeclaration(d))) {
        seen.add(real);
      }
    }
  }
  return [...seen].sort().map((name) => ({ name, group: 'general' }));
}

export async function resolvePackage(ctx) {
  const { PKG_DIR, pkgJson, ENTRY_OVERRIDE, PKG, OUT, cfg } = ctx;
  const srcMap = cfg.componentSrcMap ?? {};

  const srcRoot = [cfg.srcDir, 'src', 'lib', 'components']
    .map((d) => d && resolve(PKG_DIR, d))
    .find((d) => d && existsSync(d));
  const srcFiles = srcRoot ? walk(srcRoot, (n) => /\.(tsx|jsx|mdx?)$/.test(n)) : [];

  let entry = resolveDistEntry({ pkgDir: PKG_DIR, pkgJson, override: ENTRY_OVERRIDE, pkgName: PKG, soft: true });
  let synthEntry = false;
  if (!entry) {
    if (!srcRoot) {
      console.error(`[NO_DIST] ${PKG} has no built entry and no src/ to synthesize from — run its build.`);
      process.exit(1);
    }
    const comps = srcFiles.filter((p) => SRC_IMPL_RX.test(p) && !NON_IMPL_RX.test(p));
    entry = join(OUT, '.pkg-entry.mjs');
    const lines = [];
    let defaultAliases = 0;
    for (const p of comps) {
      lines.push(`export * from ${JSON.stringify(p)};`);
      const name = defaultExportName(readText(p));
      if (name) {
        lines.push(`export { default as ${name} } from ${JSON.stringify(p)};`);
        defaultAliases++;
      }
    }
    writeFileSync(entry, lines.join('\n') + '\n');
    synthEntry = true;
    console.error(
      `[NO_DIST] no built entry — synthesizing from ${comps.length} src files (${defaultAliases} default-export alias(es) added) (run the package's build for best results)`,
    );
  }

  const exported = exportedNames(PKG_DIR, pkgJson);
  const names = new Set([...exported].filter(isComponentName));
  for (const [k, v] of Object.entries(srcMap)) {
    if (v === null) { names.delete(k); continue; }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(k)) {
      console.error(`[CONFIG] componentSrcMap: "${k}" is not a valid component name (PascalCase identifiers only)`);
      continue;
    }
    names.add(k);
  }
  let components = [...names].sort().map((name) => ({ name, group: 'general' }));
  if (!components.length && synthEntry) {
    components = deriveComponentsFromSrc(srcFiles).filter((c) => srcMap[c.name] !== null);
  }
  if (!components.length) {
    if (cfg.cssEntry || existsSync(join(PKG_DIR, 'styles.css'))) {
      console.error('[ZERO_MATCH] no component exports — treating as tokens-only DS');
      return { shape: 'package', entry, components: [], tokensOnly: true };
    }
    console.error(`[ZERO_MATCH] no PascalCase exports in ${PKG} and no styles — nothing to sync`);
    process.exit(1);
  }

  if (srcRoot) {
    for (const c of components) {
      let hit = typeof srcMap[c.name] === 'string' ? slash(resolve(PKG_DIR, srcMap[c.name])) : null;
      if (!hit) {
        const kebab = c.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
        const nameRx = new RegExp(
          `(?:^|/)(?:${c.name}/(?:index|${c.name})\\.(tsx|jsx)|(?:${c.name}|${kebab})\\.(tsx|jsx))$`,
          'i',
        );
        const hits = srcFiles
          .filter((p) => nameRx.test(p) && !NON_IMPL_RX.test(p))
          .sort(
            (a, b) =>
              (b.toLowerCase().includes(`/${c.name.toLowerCase()}/`) ? 1 : 0) -
              (a.toLowerCase().includes(`/${c.name.toLowerCase()}/`) ? 1 : 0),
          );
        const exportRx = new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${c.name}\\b`);
        hit = hits.find((p) => exportRx.test(readText(p))) ?? hits[0];
      }
      if (!hit || !existsSync(hit)) continue;
      c.srcPath = hit;
      c.doc = leadingJsdoc(readText(hit), c.name) || undefined;
      c.group = slug(
        slash(relative(srcRoot, dirname(hit)))
          .split('/')
          .filter((s) => s && s.toLowerCase() !== c.name.toLowerCase() && !GENERIC_DIR.has(s.toLowerCase()))
          .at(-1)
        || (c.doc && /@category\s+(\S+)/.exec(c.doc)?.[1])
        || 'general',
      );
    }
  }

  console.error(
    `  package: ${components.length} components` +
      (srcRoot ? ` (${components.filter((c) => c.srcPath).length} src-matched)` : ' (no src/ — dist-only)'),
  );
  return { shape: 'package', entry, components, synthEntry, exported };
}
