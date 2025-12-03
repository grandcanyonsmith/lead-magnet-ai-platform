const fs = require('fs/promises')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'artifacts', 'context-bundle.md')

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readFileIfExists(relativePath) {
  const absolute = path.join(ROOT, relativePath)
  if (!(await fileExists(absolute))) {
    return null
  }
  const data = await fs.readFile(absolute, 'utf8')
  return data.trimEnd()
}

async function gatherPlanFiles() {
  const planDirs = ['plans', '.cursor/plans']
  const files = []

  for (const dir of planDirs) {
    const absoluteDir = path.join(ROOT, dir)
    if (!(await fileExists(absoluteDir))) continue

    const dirents = await fs.readdir(absoluteDir, { withFileTypes: true })
    for (const dirent of dirents) {
      if (dirent.isFile() && dirent.name.endsWith('.plan.md')) {
        files.push(path.join(absoluteDir, dirent.name))
      }
    }
  }

  const entries = await Promise.all(
    files.map(async (file) => {
      const stat = await fs.stat(file)
      return { file, mtimeMs: stat.mtimeMs }
    })
  )

  return entries.sort((a, b) => b.mtimeMs - a.mtimeMs).map((entry) => entry.file)
}

async function gatherContextPackSections() {
  const baseDir = path.join(ROOT, 'docs', 'context-packs')
  if (!(await fileExists(baseDir))) {
    return []
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  const sections = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const contextPath = path.join(baseDir, entry.name, 'CONTEXT.md')
    if (!(await fileExists(contextPath))) continue
    const content = await fs.readFile(contextPath, 'utf8')
    sections.push({
      title: `Context Pack - ${entry.name}`,
      content: content.trimEnd(),
    })
  }

  return sections
}

async function main() {
  const sections = []

  const repoMap = await readFileIfExists('docs/repo-map.md')
  if (repoMap) {
    sections.push({ title: 'Repo Map', content: repoMap })
  }

  const contracts = await readFileIfExists('docs/contracts/README.md')
  if (contracts) {
    sections.push({ title: 'API Contracts', content: contracts })
  }

  const testingIndex = await readFileIfExists('docs/testing/README.md')
  if (testingIndex) {
    sections.push({ title: 'Testing Index', content: testingIndex })
  }

  const planFiles = await gatherPlanFiles()
  for (const file of planFiles) {
    const content = await fs.readFile(file, 'utf8')
    sections.push({
      title: `Plan - ${path.basename(file)}`,
      content: content.trimEnd(),
    })
  }

  const contextPacks = await gatherContextPackSections()
  sections.push(...contextPacks)

  if (sections.length === 0) {
    throw new Error('No sections found to build context bundle.')
  }

  const outputParts = [
    '# Repository Context Bundle',
    `_Generated: ${new Date().toISOString()}_`,
  ]

  for (const section of sections) {
    outputParts.push(`## ${section.title}`, section.content)
  }

  const output = outputParts.join('\n\n') + '\n'
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true })
  await fs.writeFile(OUTPUT, output, 'utf8')
  console.log(`Context bundle written to ${path.relative(ROOT, OUTPUT)}`)
}

main().catch((error) => {
  console.error('[build-context] Failed:', error)
  process.exit(1)
})
