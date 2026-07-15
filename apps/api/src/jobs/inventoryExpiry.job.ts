import { inventoryService } from '../modules/inventory/inventory.service';
import { logger } from '../utils/logger';

export async function runInventoryExpiry(): Promise<void> {
  const expiredOrders = await inventoryService.expireDue();
  logger.debug({ expiredOrders }, 'inventoryExpiry: cycle complete');
}
