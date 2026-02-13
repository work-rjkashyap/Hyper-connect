// Type declarations for direct lucide-react icon imports
// This enables tree-shaking while maintaining type safety

declare module 'lucide-react/dist/esm/icons/*' {
  import { LucideIcon } from 'lucide-react';
  const icon: LucideIcon;
  export default icon;
}
