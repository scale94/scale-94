// usePrivacyDrawer.js — the privacy protocol's drawer on /SURVEILLANCE.
//
// Opening it (the drawer button, `g p`, or the `privacy` command) counts as a
// 'privacy' visit, as entering the old tab did: the compiled house_privacy
// reads tabsVisited.privacy. A visit is reported once per opening (closed ->
// open); asking for an already open drawer again is not a visit. The emit is
// deferred one tick, as in handleNav. The drawer closes whenever the visitor
// leaves /SURVEILLANCE. `focusToken` asks the drawer to scroll/focus itself;
// the drawer clears it when handled.
import { useCallback, useEffect, useRef, useState } from 'react';
import { emit as emitObs } from '../../observatory/observatoryBus';

export function usePrivacyDrawer({ handleNav, activeTab }) {
  const [open, setOpen] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  const noteOpened = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    setTimeout(() => emitObs('gaze', 'tab_navigated', { tab: 'privacy' }), 0);
  }, []);

  const openPrivacy = useCallback(() => {
    handleNav('~/system/surveillance', 'surveillance');
    noteOpened();
    setOpen(true);
    setFocusToken((t) => t + 1);
  }, [handleNav, noteOpened]);

  const onOpenChange = useCallback((next) => {
    if (next) noteOpened();
    else openRef.current = false;
    setOpen(next);
  }, [noteOpened]);

  const clearFocus = useCallback(() => setFocusToken(0), []);

  useEffect(() => {
    if (activeTab !== 'surveillance') {
      openRef.current = false;
      setOpen(false);
    }
  }, [activeTab]);

  return { privacyOpen: open, privacyFocusToken: focusToken, openPrivacy, onPrivacyOpenChange: onOpenChange, clearPrivacyFocus: clearFocus };
}
