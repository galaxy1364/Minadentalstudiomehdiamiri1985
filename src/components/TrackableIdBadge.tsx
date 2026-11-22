import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Fingerprint } from 'lucide-react';
import {
  AuditModuleKey,
  formatOfficialTrackingId,
  auditTracker
} from '../utils/auditTracker';
import { triggerHaptic } from '../utils/haptics';

interface TrackableIdBadgeProps {
  recordId?: string;
  moduleKey: AuditModuleKey;
  customLabel?: string;
  className?: string;
  variant?: 'light' | 'dark' | 'emerald' | 'purple';
  showInspectHint?: boolean;
}

export const TrackableIdBadge: React.FC<TrackableIdBadgeProps> = () => {
  // ID tracking is maintained strictly inside the project /memory/ registry
  // and never clutters the clinical user interface.
  return null;
};
