import type { SkinModule } from '../contracts';
import { exploreGalaxyModule } from './exploreGalaxy.module';
import { pixelBlastVoidModule } from './pixelBlastVoid.module';
import { windows98Module } from './windows98.module';
import { cuteBlackCatModule } from './cuteBlackCat.module';
import { cuteWhiteCatModule } from './cuteWhiteCat.module';
import { cuteDogModule } from './cuteDog.module';

export const SKIN_MODULES: readonly SkinModule[] = [
  pixelBlastVoidModule,
  exploreGalaxyModule,
  windows98Module,
  cuteBlackCatModule,
  cuteWhiteCatModule,
  cuteDogModule,
];
