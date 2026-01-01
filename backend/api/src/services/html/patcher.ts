import { replaceText } from './operations/replaceText';
import { injectScript } from './operations/injectScript';
import { modifyStyle } from './operations/modifyStyle';

export interface PatchOperation {
  type: 'replace_text' | 'inject_script' | 'modify_style';
  params: Record<string, any>;
}

export class HtmlPatcher {
  applyPatches(html: string, patches: PatchOperation[]): string {
    let result = html;
    
    for (const patch of patches) {
      switch (patch.type) {
        case 'replace_text':
          result = replaceText(result, patch.params.target, patch.params.replacement);
          break;
        case 'inject_script':
          result = injectScript(result, patch.params.content, patch.params.location);
          break;
        case 'modify_style':
          result = modifyStyle(result, patch.params.selector, patch.params.css);
          break;
        default:
          console.warn(`Unknown patch type: ${patch.type}`);
      }
    }
    
    return result;
  }
}

export const htmlPatcher = new HtmlPatcher();
