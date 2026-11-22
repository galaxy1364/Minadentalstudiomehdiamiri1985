import { useState, useEffect, useCallback } from 'react';
import { triggerHaptic } from './haptics';
import { auditTracker, AuditModuleKey } from './auditTracker';

export type VerificationStatus = 'verified' | 'conflict' | 'error' | 'warning';

export interface ActionVerificationEvent {
  id: string;
  trackingId?: string;
  auditSignature?: string;
  status: VerificationStatus;
  title: string;
  subtitle?: string;
  diffBefore?: string;
  diffAfter?: string;
  targetRecordId?: string;
  persistenceVerified?: boolean;
  canUndo?: boolean;
  timestamp: number;
  resolutionAction?: {
    label: string;
    onClick: () => void;
  };
}

export interface MutatedRecordHighlight {
  recordId: string;
  trackingId?: string;
  badgeText: string;
  type: 'success' | 'conflict' | 'error';
  diffBefore?: string;
  diffAfter?: string;
  timestamp: number;
}

type FeedbackListener = (
  activeEvent: ActionVerificationEvent | null,
  mutatedMap: Map<string, MutatedRecordHighlight>,
  safetyLockEnabled: boolean
) => void;

class ActionFeedbackManager {
  private activeEvent: ActionVerificationEvent | null = null;
  private mutatedMap: Map<string, MutatedRecordHighlight> = new Map();
  private listeners: Set<FeedbackListener> = new Set();
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyLockEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('minadental_accidental_click_guard');
      if (saved !== null) {
        this.safetyLockEnabled = saved === 'true';
      }
    }
  }

  public isSafetyLockEnabled(): boolean {
    return this.safetyLockEnabled;
  }

  public setSafetyLockEnabled(enabled: boolean) {
    this.safetyLockEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('minadental_accidental_click_guard', String(enabled));
    }
    this.notify();
  }

  public recordSuccess(params: {
    title: string;
    subtitle?: string;
    diffBefore?: string;
    diffAfter?: string;
    targetRecordId?: string;
    moduleKey?: AuditModuleKey;
    badgeText?: string;
    canUndo?: boolean;
  }) {
    triggerHaptic('success');
    const now = Date.now();

    const auditRec = auditTracker.registerMutationRecord({
      internalId: params.targetRecordId || `act-${now}`,
      moduleKey: params.moduleKey,
      title: params.title,
      subtitle: params.subtitle || params.diffAfter,
      statusLabel: params.diffAfter || 'تایید و ثبت قطعی ✓',
      metadata: {
        وضعیت_قبل: params.diffBefore || 'ثبت اولیه',
        وضعیت_جدید: params.diffAfter || 'اعمال شده'
      }
    });

    const event: ActionVerificationEvent = {
      id: `ver-${now}-${Math.random().toString(36).slice(2, 6)}`,
      trackingId: auditRec.trackingId,
      auditSignature: auditRec.sha256Signature.slice(0, 12),
      status: 'verified',
      title: params.title,
      subtitle: params.subtitle,
      diffBefore: params.diffBefore,
      diffAfter: params.diffAfter,
      targetRecordId: params.targetRecordId,
      persistenceVerified: true,
      canUndo: params.canUndo ?? true,
      timestamp: now
    };

    if (params.targetRecordId) {
      this.mutatedMap.set(params.targetRecordId, {
        recordId: params.targetRecordId,
        trackingId: auditRec.trackingId,
        badgeText: `${params.badgeText || params.diffAfter || '✓ ثبت شد'} · ${auditRec.trackingId}`,
        type: 'success',
        diffBefore: params.diffBefore,
        diffAfter: params.diffAfter,
        timestamp: now
      });

      const targetId = params.targetRecordId;
      setTimeout(() => {
        const current = this.mutatedMap.get(targetId);
        if (current && current.timestamp === now) {
          this.mutatedMap.delete(targetId);
          this.notify();
        }
      }, 6500);
    }

    this.setEvent(event, 6000);
  }

  public recordConflict(params: {
    title: string;
    subtitle?: string;
    diffBefore?: string;
    diffAfter?: string;
    targetRecordId?: string;
    badgeText?: string;
    resolutionAction?: { label: string; onClick: () => void };
  }) {
    triggerHaptic('error');
    const now = Date.now();
    const event: ActionVerificationEvent = {
      id: `conf-${now}`,
      status: 'conflict',
      title: params.title,
      subtitle: params.subtitle,
      diffBefore: params.diffBefore,
      diffAfter: params.diffAfter,
      targetRecordId: params.targetRecordId,
      persistenceVerified: false,
      canUndo: false,
      timestamp: now,
      resolutionAction: params.resolutionAction
    };

    if (params.targetRecordId) {
      this.mutatedMap.set(params.targetRecordId, {
        recordId: params.targetRecordId,
        badgeText: params.badgeText || '⚠️ تداخل شناسایی شد',
        type: 'conflict',
        timestamp: now
      });

      const targetId = params.targetRecordId;
      setTimeout(() => {
        const current = this.mutatedMap.get(targetId);
        if (current && current.timestamp === now) {
          this.mutatedMap.delete(targetId);
          this.notify();
        }
      }, 6500);
    }

    this.setEvent(event, 7000);
  }

  public recordError(params: {
    title: string;
    subtitle?: string;
    targetRecordId?: string;
    resolutionAction?: { label: string; onClick: () => void };
  }) {
    triggerHaptic('error');
    const now = Date.now();
    const event: ActionVerificationEvent = {
      id: `err-${now}`,
      status: 'error',
      title: params.title,
      subtitle: params.subtitle,
      targetRecordId: params.targetRecordId,
      persistenceVerified: false,
      canUndo: false,
      timestamp: now,
      resolutionAction: params.resolutionAction
    };

    this.setEvent(event, 6500);
  }

  public dismiss() {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.activeEvent = null;
    this.notify();
  }

  private setEvent(event: ActionVerificationEvent, durationMs: number) {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
    this.activeEvent = event;
    this.notify();

    this.dismissTimer = setTimeout(() => {
      if (this.activeEvent?.id === event.id) {
        this.activeEvent = null;
        this.notify();
      }
    }, durationMs);
  }

  public getHighlight(recordId?: string): MutatedRecordHighlight | undefined {
    if (!recordId) return undefined;
    return this.mutatedMap.get(recordId);
  }

  public subscribe(listener: FeedbackListener): () => void {
    this.listeners.add(listener);
    listener(this.activeEvent, new Map(this.mutatedMap), this.safetyLockEnabled);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = new Map(this.mutatedMap);
    this.listeners.forEach(l => l(this.activeEvent, snapshot, this.safetyLockEnabled));
  }
}

export const actionFeedback = new ActionFeedbackManager();

export function useActionFeedback() {
  const [activeEvent, setActiveEvent] = useState<ActionVerificationEvent | null>(null);
  const [mutatedMap, setMutatedMap] = useState<Map<string, MutatedRecordHighlight>>(new Map());
  const [safetyLockEnabled, setSafetyLockEnabled] = useState<boolean>(actionFeedback.isSafetyLockEnabled());

  useEffect(() => {
    return actionFeedback.subscribe((ev, map, lock) => {
      setActiveEvent(ev);
      setMutatedMap(map);
      setSafetyLockEnabled(lock);
    });
  }, []);

  const getCardFeedbackClasses = useCallback(
    (recordId?: string) => {
      if (!recordId) return '';
      const hl = mutatedMap.get(recordId);
      if (!hl) return '';
      if (hl.type === 'conflict' || hl.type === 'error') {
        return 'ios27-conflict-shake ring-2 ring-rose-500 border-rose-500 bg-rose-50/40';
      }
      return 'ios27-mutation-flash ring-2 ring-emerald-500 border-emerald-500';
    },
    [mutatedMap]
  );

  const getCardFeedbackBadge = useCallback(
    (recordId?: string): MutatedRecordHighlight | undefined => {
      if (!recordId) return undefined;
      return mutatedMap.get(recordId);
    },
    [mutatedMap]
  );

  return {
    activeEvent,
    mutatedMap,
    safetyLockEnabled,
    setSafetyLockEnabled: (val: boolean) => actionFeedback.setSafetyLockEnabled(val),
    getCardFeedbackClasses,
    getCardFeedbackBadge,
    dismiss: () => actionFeedback.dismiss()
  };
}
