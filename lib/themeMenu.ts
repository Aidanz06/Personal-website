/**
 * Which way the theme menu opens: `left` anchors it to the glyph's left edge
 * so it extends rightward (beside the name on a desktop); `right` anchors it
 * to the glyph's right edge so it extends leftward.
 *
 * On a phone the greeting wraps and the glyph lands near the right edge,
 * where opening rightward pushed the labels off the screen and widened the
 * page. The menu is about 120px wide; the 20px is the page gutter.
 */
export const THEME_MENU_WIDTH = 120

export function menuSide(
  trigger: { left: number; right: number },
  viewportWidth: number,
): 'left' | 'right' {
  return trigger.left + THEME_MENU_WIDTH > viewportWidth - 20 ? 'right' : 'left'
}
