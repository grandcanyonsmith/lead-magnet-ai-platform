/**
 * Applies a unified diff to a string.
 * Supports standard unified diff format with or without line numbers in headers.
 * 
 * @param original The original file content
 * @param diff The unified diff string
 * @returns The patched content
 * @throws Error if the patch cannot be applied
 */
export function applyDiff(original: string, diff: string): string {
  // Normalize line endings to LF
  const lines = original.split(/\r?\n/);
  const diffLines = diff.split(/\r?\n/);
  
  let resultLines = [...lines];
  let runningOffset = 0;
  
  // Parse hunks
  let i = 0;
  while (i < diffLines.length) {
    const line = diffLines[i];
    
    if (line.startsWith('@@')) {
      // Hunk header
      // Parse line numbers: @@ -oldStart,oldLength +newStart,newLength @@
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      let oldStart = 0;
      let oldLength = 1; // Default to 1 if omitted (standard diff behavior)
      
      if (match) {
        oldStart = parseInt(match[1]);
        oldLength = match[2] ? parseInt(match[2]) : 1;
      }
      
      i++; // Move to first line of hunk
      
      // Collect the hunk lines
      const hunkLines: string[] = [];
      while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
        hunkLines.push(diffLines[i]);
        i++;
      }
      
      // Now try to apply this hunk
      try {
        const { newLines, delta } = applyHunk(resultLines, hunkLines, oldStart, oldLength, runningOffset);
        resultLines = newLines;
        runningOffset += delta;
      } catch (err) {
         // Re-throw with more context
         throw new Error(`Failed to apply hunk starting at diff line ${i - hunkLines.length}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
        // Skip preamble or empty lines
        i++;
    }
  }
  
  return resultLines.join('\n');
}

function applyHunk(
  lines: string[], 
  hunkLines: string[], 
  oldStart: number, 
  _oldLength: number, 
  offset: number
): { newLines: string[], delta: number } {
  // Extract context (lines starting with ' ') and deletions (lines starting with '-')
  // to find the match in the original file.
  
  // We need to match the "pre-image" of the hunk.
  // The pre-image consists of context lines and deleted lines.
  const preImage: string[] = [];
  
  for (const line of hunkLines) {
    if (line.startsWith(' ') || line.startsWith('-')) {
      preImage.push(line.substring(1));
    } else if (line.startsWith('+')) {
      // Insertions are not part of pre-image matching
    } else if (line === '') {
        // sometimes empty lines in diff might match empty lines in file, 
        // but typically unified diffs use ' ' for empty context lines. 
        // If it's truly empty, treat as context?
        // Let's assume strict unified diff: context starts with space.
    } else if (line.startsWith('\\ No newline at end of file')) {
        // Ignore
    } else {
        // Unknown prefix, treat as context if it matches? 
        // Or strict error?
        // For robustness with LLM output, maybe treat as context if it matches?
        // But better to be strict on -/+ and lenient on space.
    }
  }

  // Construct post-image (what we want to insert/keep)
  const postImage: string[] = [];
  for (const line of hunkLines) {
    if (line.startsWith(' ') || line.startsWith('+')) {
      postImage.push(line.substring(1));
    }
  }

  if (preImage.length === 0) {
      // Pure insertion (no context).
      // We must rely on line numbers from the header.
      
      // Calculate insertion index
      // If oldLength == 0, oldStart is the line number *before* the insertion point.
      // e.g. @@ -0,0 ... @@ -> Insert at 0
      // e.g. @@ -1,0 ... @@ -> Insert at 1 (after line 1)
      // Unified diffs are 1-indexed, so we subtract 1.
      // Special case: oldStart=0 (start of file) -> -1, clamped to 0.
      
      let insertionIndex = Math.max(0, oldStart - 1 + offset);
      
      // Handle bounds safely
      if (insertionIndex > lines.length) insertionIndex = lines.length;
      
      const newLines = [...lines];
      newLines.splice(insertionIndex, 0, ...postImage);
      
      return { newLines, delta: postImage.length };
  }

  // Find the pre-image in the lines using context matching
  const matchIndex = findSubArray(lines, preImage);
  
  if (matchIndex === -1) {
    // Try to find with relaxed whitespace?
    throw new Error('Could not find context in file to apply patch');
  }
  
  // Construct the new lines
  const newLines = [...lines];
  
  // Replace lines[matchIndex ... matchIndex + preImage.length] with postImage
  newLines.splice(matchIndex, preImage.length, ...postImage);
  
  const delta = postImage.length - preImage.length;
  
  return { newLines, delta };
}

function findSubArray(haystack: string[], needle: string[]): number {
  if (needle.length === 0) return -1;
  
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  
  return -1;
}
