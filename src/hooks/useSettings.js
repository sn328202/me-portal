/**
 * Settings now live in a provider so every consumer shares one copy — see
 * contexts/SettingsContext.jsx for why. Re-exported from here so the existing
 * `import { useSettings } from '../hooks/useSettings'` call sites keep working.
 */
export { useSettings } from '../contexts/SettingsContext';
export { DEFAULT_SETTINGS } from '../configs/settings';
