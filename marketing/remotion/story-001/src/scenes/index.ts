// Scene registry — scaffold.py appends here. Do not reorder markers.
// <scaffold:imports>
import scene_wg1_invitation_component from './wg1-invitation/Scene';
import {defaults as scene_wg1_invitation_defaults, durationInFrames as scene_wg1_invitation_dur} from './wg1-invitation/schema';
import scene_wg2_page_turn_component from './wg2-page-turn/Scene';
import {defaults as scene_wg2_page_turn_defaults, durationInFrames as scene_wg2_page_turn_dur} from './wg2-page-turn/schema';
import scene_wg3_bedroom_component from './wg3-bedroom/Scene';
import {defaults as scene_wg3_bedroom_defaults, durationInFrames as scene_wg3_bedroom_dur} from './wg3-bedroom/schema';
import scene_wg4_the_smile_component from './wg4-the-smile/Scene';
import {defaults as scene_wg4_the_smile_defaults, durationInFrames as scene_wg4_the_smile_dur} from './wg4-the-smile/schema';
import scene_wg5_envelope_component from './wg5-envelope/Scene';
import {defaults as scene_wg5_envelope_defaults, durationInFrames as scene_wg5_envelope_dur} from './wg5-envelope/schema';
import scene_wg6_party_recording_component from './wg6-party-recording/Scene';
import {defaults as scene_wg6_party_recording_defaults, durationInFrames as scene_wg6_party_recording_dur} from './wg6-party-recording/schema';
import scene_wg7_they_chose_her_component from './wg7-they-chose-her/Scene';
import {defaults as scene_wg7_they_chose_her_defaults, durationInFrames as scene_wg7_they_chose_her_dur} from './wg7-they-chose-her/schema';
import scene_wg8_lost_everything_component from './wg8-lost-everything/Scene';
import {defaults as scene_wg8_lost_everything_defaults, durationInFrames as scene_wg8_lost_everything_dur} from './wg8-lost-everything/schema';
import scene_wg9_planning_component from './wg9-planning/Scene';
import {defaults as scene_wg9_planning_defaults, durationInFrames as scene_wg9_planning_dur} from './wg9-planning/schema';
import scene_01_cold_open_component from './01-cold-open/Scene';
import {defaults as scene_01_cold_open_defaults, durationInFrames as scene_01_cold_open_dur} from './01-cold-open/schema';
import scene_02_bear_meme_component from './02-bear-meme/Scene';
import {defaults as scene_02_bear_meme_defaults, durationInFrames as scene_02_bear_meme_dur} from './02-bear-meme/schema';
import scene_03_silly_secrets_component from './03-silly-secrets/Scene';
import {defaults as scene_03_silly_secrets_defaults, durationInFrames as scene_03_silly_secrets_dur} from './03-silly-secrets/schema';
import scene_04_night_post_component from './04-night-post/Scene';
import {defaults as scene_04_night_post_defaults, durationInFrames as scene_04_night_post_dur} from './04-night-post/schema';
import scene_05_the_words_component from './05-the-words/Scene';
import {defaults as scene_05_the_words_defaults, durationInFrames as scene_05_the_words_dur} from './05-the-words/schema';
import scene_06_ink_bleed_component from './06-ink-bleed/Scene';
import {defaults as scene_06_ink_bleed_defaults, durationInFrames as scene_06_ink_bleed_dur} from './06-ink-bleed/schema';
import scene_07_case_closed_component from './07-case-closed/Scene';
import {defaults as scene_07_case_closed_defaults, durationInFrames as scene_07_case_closed_dur} from './07-case-closed/schema';
import scene_08_explosion_component from './08-explosion/Scene';
import {defaults as scene_08_explosion_defaults, durationInFrames as scene_08_explosion_dur} from './08-explosion/schema';
import scene_09_one_reply_component from './09-one-reply/Scene';
import {defaults as scene_09_one_reply_defaults, durationInFrames as scene_09_one_reply_dur} from './09-one-reply/schema';
import scene_02_bear_clip_component from './02-bear-clip/Scene';
import {defaults as scene_02_bear_clip_defaults, durationInFrames as scene_02_bear_clip_dur} from './02-bear-clip/schema';
import scene_03_post_clip_component from './03-post-clip/Scene';
import {defaults as scene_03_post_clip_defaults, durationInFrames as scene_03_post_clip_dur} from './03-post-clip/schema';
import scene_05_explosion_clip_component from './05-explosion-clip/Scene';
import {defaults as scene_05_explosion_clip_defaults, durationInFrames as scene_05_explosion_clip_dur} from './05-explosion-clip/schema';

export const scenes = {
// <scaffold:entries>
  'wg1-invitation': {component: scene_wg1_invitation_component, defaults: scene_wg1_invitation_defaults, durationInFrames: scene_wg1_invitation_dur},
  'wg2-page-turn': {component: scene_wg2_page_turn_component, defaults: scene_wg2_page_turn_defaults, durationInFrames: scene_wg2_page_turn_dur},
  'wg3-bedroom': {component: scene_wg3_bedroom_component, defaults: scene_wg3_bedroom_defaults, durationInFrames: scene_wg3_bedroom_dur},
  'wg4-the-smile': {component: scene_wg4_the_smile_component, defaults: scene_wg4_the_smile_defaults, durationInFrames: scene_wg4_the_smile_dur},
  'wg5-envelope': {component: scene_wg5_envelope_component, defaults: scene_wg5_envelope_defaults, durationInFrames: scene_wg5_envelope_dur},
  'wg6-party-recording': {component: scene_wg6_party_recording_component, defaults: scene_wg6_party_recording_defaults, durationInFrames: scene_wg6_party_recording_dur},
  'wg7-they-chose-her': {component: scene_wg7_they_chose_her_component, defaults: scene_wg7_they_chose_her_defaults, durationInFrames: scene_wg7_they_chose_her_dur},
  'wg8-lost-everything': {component: scene_wg8_lost_everything_component, defaults: scene_wg8_lost_everything_defaults, durationInFrames: scene_wg8_lost_everything_dur},
  'wg9-planning': {component: scene_wg9_planning_component, defaults: scene_wg9_planning_defaults, durationInFrames: scene_wg9_planning_dur},
  '01-cold-open': {component: scene_01_cold_open_component, defaults: scene_01_cold_open_defaults, durationInFrames: scene_01_cold_open_dur},
  '02-bear-meme': {component: scene_02_bear_meme_component, defaults: scene_02_bear_meme_defaults, durationInFrames: scene_02_bear_meme_dur},
  '03-silly-secrets': {component: scene_03_silly_secrets_component, defaults: scene_03_silly_secrets_defaults, durationInFrames: scene_03_silly_secrets_dur},
  '04-night-post': {component: scene_04_night_post_component, defaults: scene_04_night_post_defaults, durationInFrames: scene_04_night_post_dur},
  '05-the-words': {component: scene_05_the_words_component, defaults: scene_05_the_words_defaults, durationInFrames: scene_05_the_words_dur},
  '06-ink-bleed': {component: scene_06_ink_bleed_component, defaults: scene_06_ink_bleed_defaults, durationInFrames: scene_06_ink_bleed_dur},
  '07-case-closed': {component: scene_07_case_closed_component, defaults: scene_07_case_closed_defaults, durationInFrames: scene_07_case_closed_dur},
  '08-explosion': {component: scene_08_explosion_component, defaults: scene_08_explosion_defaults, durationInFrames: scene_08_explosion_dur},
  '09-one-reply': {component: scene_09_one_reply_component, defaults: scene_09_one_reply_defaults, durationInFrames: scene_09_one_reply_dur},
  '02-bear-clip': {component: scene_02_bear_clip_component, defaults: scene_02_bear_clip_defaults, durationInFrames: scene_02_bear_clip_dur},
  '03-post-clip': {component: scene_03_post_clip_component, defaults: scene_03_post_clip_defaults, durationInFrames: scene_03_post_clip_dur},
  '05-explosion-clip': {component: scene_05_explosion_clip_component, defaults: scene_05_explosion_clip_defaults, durationInFrames: scene_05_explosion_clip_dur},
} as const;
