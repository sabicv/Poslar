import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';
import { BodyModule } from './body/BodyModule';
import { FleetModule } from './fleet/FleetModule';
import { GearModule } from './gear/GearModule';
import { MotoModule } from './moto/MotoModule';
import { VoltModule } from './volt/VoltModule';
import { WheelModule } from './wheel/WheelModule';
import { AirModule } from './air/AirModule';

export interface ModuleProps {
  ctx: WorkshopContext;
  job: JobWithRefs;
  locked: boolean;
}

// The package's own tab on a work order.
export function ModuleTab(props: ModuleProps) {
  switch (props.ctx.pkg.id) {
    case 'volt':
      return <VoltModule {...props} />;
    case 'gear':
      return <GearModule {...props} />;
    case 'body':
      return <BodyModule {...props} />;
    case 'wheel':
      return <WheelModule {...props} />;
    case 'fleet':
      return <FleetModule {...props} />;
    case 'moto':
      return <MotoModule {...props} />;
    case 'air':
      return <AirModule {...props} />;
  }
}
