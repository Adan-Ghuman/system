import { PageHeader } from '../components/ui/PageHeader.js';
import { DyeingUnitsTab } from '../features/dyeing/components/DyeingUnitsTab.js';

export function UnitsPage() {
  return <div className="space-y-6"><PageHeader title="Units & godowns" description="Manage mills and godowns, view stock by location, and open the linked party ledger." /><DyeingUnitsTab /></div>;
}
