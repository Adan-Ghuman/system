import { ClientSession } from 'mongoose';
import { CatalogChoice } from './records.js';

export async function rememberFabricNames(items: Array<{ fabricType?: string }>, session: ClientSession) {
  for (const name of new Set(items.map(item => item.fabricType?.trim()).filter((value): value is string => Boolean(value)))) {
    const normalized = name.toLocaleLowerCase();
    await CatalogChoice.updateOne({ kind: 'FABRIC', normalized }, { $setOnInsert: { kind: 'FABRIC', normalized, name, isActive: true } }, { upsert: true, session });
  }
}
