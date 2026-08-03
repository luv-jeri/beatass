// Scene registry — scaffold.py appends here. Do not reorder markers.
// <scaffold:imports>
import scene_07_cliffhanger_card_component from './07-cliffhanger-card/Scene';
import {defaults as scene_07_cliffhanger_card_defaults, durationInFrames as scene_07_cliffhanger_card_dur} from './07-cliffhanger-card/schema';
import scene_06_reply_clip_component from './06-reply-clip/Scene';
import {defaults as scene_06_reply_clip_defaults, durationInFrames as scene_06_reply_clip_dur} from './06-reply-clip/schema';
import scene_05_explosion_clip_component from './05-explosion-clip/Scene';
import {defaults as scene_05_explosion_clip_defaults, durationInFrames as scene_05_explosion_clip_dur} from './05-explosion-clip/schema';
import scene_04_confession_card_component from './04-confession-card/Scene';
import {defaults as scene_04_confession_card_defaults, durationInFrames as scene_04_confession_card_dur} from './04-confession-card/schema';
import scene_03_post_clip_component from './03-post-clip/Scene';
import {defaults as scene_03_post_clip_defaults, durationInFrames as scene_03_post_clip_dur} from './03-post-clip/schema';
import scene_02_bear_clip_component from './02-bear-clip/Scene';
import {defaults as scene_02_bear_clip_defaults, durationInFrames as scene_02_bear_clip_dur} from './02-bear-clip/schema';
import scene_01_hook_card_component from './01-hook-card/Scene';
import {defaults as scene_01_hook_card_defaults, durationInFrames as scene_01_hook_card_dur} from './01-hook-card/schema';

export const scenes = {
// <scaffold:entries>
  '07-cliffhanger-card': {component: scene_07_cliffhanger_card_component, defaults: scene_07_cliffhanger_card_defaults, durationInFrames: scene_07_cliffhanger_card_dur},
  '06-reply-clip': {component: scene_06_reply_clip_component, defaults: scene_06_reply_clip_defaults, durationInFrames: scene_06_reply_clip_dur},
  '05-explosion-clip': {component: scene_05_explosion_clip_component, defaults: scene_05_explosion_clip_defaults, durationInFrames: scene_05_explosion_clip_dur},
  '04-confession-card': {component: scene_04_confession_card_component, defaults: scene_04_confession_card_defaults, durationInFrames: scene_04_confession_card_dur},
  '03-post-clip': {component: scene_03_post_clip_component, defaults: scene_03_post_clip_defaults, durationInFrames: scene_03_post_clip_dur},
  '02-bear-clip': {component: scene_02_bear_clip_component, defaults: scene_02_bear_clip_defaults, durationInFrames: scene_02_bear_clip_dur},
  '01-hook-card': {component: scene_01_hook_card_component, defaults: scene_01_hook_card_defaults, durationInFrames: scene_01_hook_card_dur},
} as const;
