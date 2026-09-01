import { getDatabase } from '../db';
import api from '../api/client';
import * as SecureStore from 'expo-secure-store';

const LAST_SYNC_KEY = 'ref_last_sync';

export async function syncReferences() {
  const db = await getDatabase();
  const lastSync = await SecureStore.getItemAsync(LAST_SYNC_KEY);

  try {
    // Equipment types — delta sync
    const eqParams = lastSync ? { updated_since: lastSync } : {};
    const eqResponse = await api.get('/refs/equipment-types', { params: eqParams });
    const eqTypes = eqResponse.data as any[];

    for (const eq of eqTypes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_equipment_types (id, name, code, specialization) VALUES (?, ?, ?, ?)`,
        [eq.id, eq.name, eq.code, eq.specialization || null]
      );
    }

    // Room types
    const rtResponse = await api.get('/refs/room-types', { params: eqParams });
    const rtTypes = rtResponse.data as any[];

    for (const rt of rtTypes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_room_types (id, name, code) VALUES (?, ?, ?)`,
        [rt.id, rt.name, rt.code || null]
      );
    }

    // Recommendations
    const recResponse = await api.get('/refs/recommendations', { params: eqParams });
    const recs = recResponse.data as any[];

    for (const rec of recs) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_recommendations (id, text, equipment_type_code) VALUES (?, ?, ?)`,
        [rec.id, rec.text, rec.equipment_type_code || null]
      );
    }

    await SecureStore.setItemAsync(LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    // Offline — use cached data
    console.log('Ref sync failed, using cache:', error);
  }
}

export async function getCachedEquipmentTypes() {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; name: string; code: string; specialization: string | null }>(
    `SELECT * FROM cached_equipment_types ORDER BY name`
  );
}

export async function getCachedRoomTypes() {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; name: string; code: string | null }>(
    `SELECT * FROM cached_room_types ORDER BY name`
  );
}

export async function getCachedRecommendations(equipmentTypeCode?: string) {
  const db = await getDatabase();
  if (equipmentTypeCode) {
    return db.getAllAsync<{ id: string; text: string; equipment_type_code: string | null }>(
      `SELECT * FROM cached_recommendations WHERE equipment_type_code = ? ORDER BY text`,
      [equipmentTypeCode]
    );
  }
  return db.getAllAsync<{ id: string; text: string; equipment_type_code: string | null }>(
    `SELECT * FROM cached_recommendations ORDER BY text`
  );
}

export async function cacheAddressesForEngineer(addresses: any[]) {
  const db = await getDatabase();
  for (const addr of addresses) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_addresses (id, full_address, city, street, house, building) VALUES (?, ?, ?, ?, ?, ?)`,
      [addr.id, addr.full_address || addr.fullAddress, addr.city || null, addr.street || null, addr.house || null, addr.building || null]
    );
  }
}

export async function getCachedAddresses() {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; full_address: string; city: string | null; street: string | null; house: string | null; building: string | null }>(
    `SELECT * FROM cached_addresses ORDER BY full_address`
  );
}
