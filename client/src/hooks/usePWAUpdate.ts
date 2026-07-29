import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setNeedRefresh(false);
  };

  const update = () => {
    updateServiceWorker(true);
  };

  return { needRefresh, update, close };
}
