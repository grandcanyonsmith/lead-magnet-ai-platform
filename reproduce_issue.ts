
import { applyDiff } from './backend/api/src/utils/patchUtils';

const original = "Line 1\nLine 2\nLine 3";
const diff = `@@ -1,3 +1,4 @@
+Inserted Line
 Line 1
 Line 2
 Line 3`;

// Case 1: Standard context (should work)
try {
    console.log("--- Case 1: Standard context ---");
    const result = applyDiff(original, diff);
    console.log("Result:");
    console.log(result);
} catch (e) {
    console.error(e);
}

// Case 2: Pure insertion without context (the bug)
// Note: Valid unified diffs usually have context, but LLMs might produce this.
// Or if creating a new file.
const diffNoContext = `@@ -1,0 +1,1 @@
+Inserted Line Without Context`;

try {
    console.log("\n--- Case 2: Pure insertion without context ---");
    const result = applyDiff(original, diffNoContext);
    console.log("Result (should be original lines if bug exists):");
    console.log(result);
    if (result === original) {
        console.log("BUG CONFIRMED: Returned original string unchanged.");
    } else {
        console.log("Fixed? Result changed.");
    }
} catch (e) {
    console.error(e);
}

// Case 3: Empty original file
const emptyOriginal = "";
const diffEmpty = `@@ -0,0 +1,1 @@
+First Line`;

try {
    console.log("\n--- Case 3: Empty original file ---");
    const result = applyDiff(emptyOriginal, diffEmpty);
    console.log("Result:");
    console.log(result);
     if (result === emptyOriginal) {
        console.log("BUG CONFIRMED: Returned empty string unchanged.");
    }
} catch (e) {
    console.error(e);
}

