// sceneSystem.ts — THE style lock. Every scene imports {system} from here.
// Transcribed from motion-builder sheet NOIR-CONFESSION (2026-08-03):
// ink black world, off-white paper, single cold pale blue accent used only
// for light and key objects. Condensed caps headlines, typewriter labels.
import {staticFile} from 'remotion';
import {loadFont as loadHead} from '@remotion/google-fonts/Anton';
import {loadFont as loadLabel} from '@remotion/google-fonts/SpecialElite';
import {loadFont as loadData} from '@remotion/google-fonts/SpaceMono';

const head = loadHead();
const label = loadLabel();
const data = loadData();

export const system = {
  bg: '#0b0b0d',
  ink: '#0b0b0d',
  paper: '#efe6d4',
  accent: '#a9c9ea',
  accentSoft: '#41586e',

  stageSrc: staticFile('system/stage.png'),

  type: {
    h1: {fontFamily: head.fontFamily, fontWeight: 400, fontSize: 104, textTransform: 'uppercase' as const, letterSpacing: '0.01em', lineHeight: 1.08},
    h2: {fontFamily: head.fontFamily, fontWeight: 400, fontSize: 60, textTransform: 'uppercase' as const, letterSpacing: '0.02em', lineHeight: 1.15},
    label: {fontFamily: label.fontFamily, fontWeight: 400, fontSize: 34, letterSpacing: '0.14em'},
    data: {fontFamily: data.fontFamily, fontWeight: 700, fontSize: 120},
    caption: {fontFamily: head.fontFamily, fontWeight: 400, fontSize: 68, textTransform: 'uppercase' as const, letterSpacing: '0.02em'},
  },

  springs: {
    pop: {damping: 14, stiffness: 170, mass: 0.7},
    settle: {damping: 30, stiffness: 80, mass: 1},
  },
  staggerStep: 5,
  settleFrames: 8,
  driftPx: 14,

  map: {ocean: '#101c2c', land: '#2a3a4e', border: '#3f5470', route: '#a9c9ea'},
} as const;
