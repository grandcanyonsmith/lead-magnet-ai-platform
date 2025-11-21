#!/usr/bin/env node

/**
 * Script to open workflow edit pages in browser
 * Usage: node scripts/admin/open-workflow-edit-pages.js <workflow-id-1> [workflow-id-2] ...
 */

const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://lead-magnet-ai-platform-frontend.vercel.app'
const LOCAL_URL = 'http://localhost:3000'

async function openWorkflowEditPage(workflowId, useLocal = false) {
  const baseUrl = useLocal ? LOCAL_URL : FRONTEND_URL
  const url = `${baseUrl}/dashboard/workflows/${workflowId}/edit`
  
  console.log(`Opening: ${url}`)
  
  try {
    // Try to open in default browser
    const platform = process.platform
    let command
    
    if (platform === 'darwin') {
      command = `open "${url}"`
    } else if (platform === 'win32') {
      command = `start "${url}"`
    } else {
      command = `xdg-open "${url}"`
    }
    
    await execAsync(command)
    console.log(`✅ Opened: ${workflowId}`)
  } catch (error) {
    console.log(`⚠️  Could not auto-open browser. Please visit: ${url}`)
  }
  
  return url
}

async function main() {
  const workflowIds = process.argv.slice(2)
  const useLocal = process.argv.includes('--local')
  
  if (workflowIds.length === 0) {
    // Default to the three workflows we just published
    workflowIds.push(
      'wf_01KAK2CFE46J5ZY6Z22VRG204H', // Passion Profit Engine
      'wf_01KAK1NDN2DPR4SVV6D8TSWX4Q', // Passion-to-Profit Mapper
      'wf_01KAJZT08R4FC8EG8DCM09700B'  // Creator Intel Map
    )
  }
  
  console.log(`🚀 Opening ${workflowIds.length} workflow edit page(s)...\n`)
  
  const urls = []
  for (const workflowId of workflowIds) {
    const url = await openWorkflowEditPage(workflowId, useLocal)
    urls.push(url)
    // Small delay between opens to avoid overwhelming the browser
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('\n📋 All URLs:')
  urls.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`)
  })
  console.log('\n✅ Done!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

