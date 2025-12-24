
export function applyDiff(original: string, diff: string): string {
  if (!diff) return original;
  
  const lines = original.split('\n');
  const diffLines = diff.split('\n');
  
  const result: string[] = [];
  let currentOriginalLine = 0;
  let i = 0;

  // Skip header lines (like "--- a/file", "+++ b/file")
  while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
    i++;
  }

  // If no hunks found, return original
  if (i >= diffLines.length) {
    return original;
  }

  while (i < diffLines.length) {
    const header = diffLines[i];
    if (!header.startsWith('@@')) {
      i++;
      continue;
    }

    // Parse header: @@ -oldStart,oldLen +newStart,newLen @@
    const match = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!match) {
        // Skip malformed hunk
        i++;
        continue;
    }
    
    const oldStart = parseInt(match[1], 10) - 1; // 0-based
    
    // Copy lines from original up to oldStart
    // Note: This relies on the diff being accurate about line numbers relative to our current position.
    // Ideally we should fuzzy match context, but strict line numbers is safer if diff is generated correctly against this version.
    while (currentOriginalLine < oldStart && currentOriginalLine < lines.length) {
        result.push(lines[currentOriginalLine]);
        currentOriginalLine++;
    }
    
    i++; // Move past header
    
    while (i < diffLines.length) {
        const line = diffLines[i];
        if (line.startsWith('@@')) break; // Next hunk
        
        const type = line[0];
        const content = line.substring(1);
        
        if (type === ' ') {
            // Context
            if (currentOriginalLine < lines.length) {
                // We could verify content matches lines[currentOriginalLine] here
                result.push(lines[currentOriginalLine]);
                currentOriginalLine++;
            }
        } else if (type === '-') {
            // Deletion
             currentOriginalLine++;
        } else if (type === '+') {
            // Insertion
            result.push(content);
        } else if (type === '\\') {
            // \ No newline at end of file - ignore
        } else {
             // Treat as context or ignore
        }
        i++;
    }
  }
  
  // Append remaining original lines
  while (currentOriginalLine < lines.length) {
      result.push(lines[currentOriginalLine]);
      currentOriginalLine++;
  }
  
  return result.join('\n');
}
