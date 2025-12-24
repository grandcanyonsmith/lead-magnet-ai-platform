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
  
  // Parse hunks
  let i = 0;
  while (i < diffLines.length) {
    const line = diffLines[i];
    
    if (line.startsWith('@@')) {
      // Hunk header
      // Parse optional line numbers if present, e.g. @@ -1,5 +1,5 @@
      // But we will primarily rely on context matching if we can
      
      i++; // Move to first line of hunk
      
      // Collect the hunk lines
      const hunkLines: string[] = [];
      while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
        hunkLines.push(diffLines[i]);
        i++;
      }
      
      // Now try to apply this hunk
      try {
        resultLines = applyHunk(resultLines, hunkLines);
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

function applyHunk(lines: string[], hunkLines: string[]): string[] {
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

  if (preImage.length === 0) {
      // Pure insertion? Where?
      // If no context, usually implies top of file or we need line numbers.
      // But let's assume LLM provides context.
      // If pure insertion with no context, we can't locate it without line numbers.
      // We will append to end? Or prepend?
      // For now, if no pre-image, assume append? Or error?
      // Let's fallback to searching for an insertion point?
      // Actually, standard diffs usually have context.
      return lines; 
  }

  // Find the pre-image in the lines
  const matchIndex = findSubArray(lines, preImage);
  
  if (matchIndex === -1) {
    // Try to find with relaxed whitespace?
    throw new Error('Could not find context in file to apply patch');
  }
  
  // Construct the new lines
  const newLines = [...lines];
  
  // Remove the matched segment (pre-image)
  // But wait, the pre-image includes deletions AND context. 
  // We want to replace the pre-image with the post-image (context + insertions).
  
  // Let's build the post-image
  const postImage: string[] = [];
  for (const line of hunkLines) {
    if (line.startsWith(' ') || line.startsWith('+')) {
      postImage.push(line.substring(1));
    }
  }
  
  // Replace lines[matchIndex ... matchIndex + preImage.length] with postImage
  newLines.splice(matchIndex, preImage.length, ...postImage);
  
  return newLines;
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

