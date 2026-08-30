import { pool } from '../db.js';

export interface ShippingResult {
  fee: number;
  zoneName: string;
  isFreeShipping: boolean;
}

/** Computes the authoritative shipping fee for a district + order subtotal. Single source of
 * truth, used both by the public /shipping/calculate preview endpoint and by order creation. */
export async function calculateShippingFee(district: string, subtotal: number): Promise<ShippingResult> {
  const settingsResult = await pool.query(`SELECT free_shipping_threshold FROM shipping_settings WHERE id = 1`);
  const threshold = Number(settingsResult.rows[0]?.free_shipping_threshold ?? 0);
  if (threshold > 0 && subtotal >= threshold) {
    return { fee: 0, zoneName: 'Free Shipping', isFreeShipping: true };
  }

  const zonesResult = await pool.query(`SELECT name, districts, fee, is_default FROM shipping_zones`);
  const normalized = district.trim().toLowerCase();
  const matched = zonesResult.rows.find((z) => (z.districts as string[]).some((d) => d.toLowerCase() === normalized));
  const zone = matched ?? zonesResult.rows.find((z) => z.is_default);

  return {
    fee: zone ? Number(zone.fee) : 0,
    zoneName: zone?.name ?? 'Standard',
    isFreeShipping: false,
  };
}
