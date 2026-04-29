import type { SkinModule } from '../contracts';
import { exploreGalaxyModule } from './exploreGalaxy.module';
import { pixelBlastVoidModule } from './pixelBlastVoid.module';
import { neonCortexModule } from './neonCortex.module';
import { windows98Module } from './windows98.module';

export const SKIN_MODULES: readonly SkinModule[] = [
  neonCortexModule,
  pixelBlastVoidModule,
  exploreGalaxyModule,
  windows98Module,
];
