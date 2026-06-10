import { useIdleSignOut } from '@/hooks/useIdleSignOut';

export const IdleSignOutMount = () => {
  useIdleSignOut();
  return null;
};
