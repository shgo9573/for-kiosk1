import { KioskFolder, KioskFile } from '../types';

// Zero fake/mock data in production
export const DEMO_FOLDERS: Record<string, { folder: KioskFolder; files: KioskFile[] }> = {};
