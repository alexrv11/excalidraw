// Allow CSS custom properties (--var-name) in React inline styles.
// @types/react@19 removed the index signature from CSSProperties; this restores it.
import "react";
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
