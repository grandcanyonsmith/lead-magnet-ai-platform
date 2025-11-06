# Template Fix Instructions

The user wants to remove Stripe checkout logic and replace it with direct redirects to:
`https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20`

## Key Changes Needed:

1. **Remove Stripe JS Loading:**
   - Remove: `await loadScript('https://js.stripe.com/v3/');`
   - Remove: `loadStylesheet('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');`

2. **Remove Stripe Initialization:**
   - Remove: `let stripe = null;`
   - Remove: `if (typeof Stripe === 'function') { stripe = Stripe("pk_live_..."); }`

3. **Remove Session ID Fetching:**
   - Remove the entire block from `// Extract the ai_website_id` to the end of the catch block

4. **Replace All Redirects:**
   - Replace all instances of:
     ```javascript
     if (stripe && sessionId) {
       stripe.redirectToCheckout({ sessionId: sessionId });
     } else {
       window.location.href = fallbackUrl;
     }
     ```
   - With:
     ```javascript
     window.location.href = "https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20";
     ```

5. **Fix redirectLink variable:**
   - Change: `const redirectLink = 'https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20'`
   - To: `const redirectLink = document.createElement("a"); redirectLink.href = "https://my.coursecreator360.com/payment-link/68ca4efd219709817ce1ef20";`

Run the fix script: `python3 scripts/fix-template-stripe.py <input_file> templates/sample-template.html`






