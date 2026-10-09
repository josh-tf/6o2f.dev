import { tool as t_admin } from './admin/index.ts';
import { tool as t_labyrinth } from './labyrinth/index.ts';
import { tool as t_b64 } from './b64/index.ts';
import { tool as t_base } from './base/index.ts';
import { tool as t_calc } from './calc/index.ts';
import { tool as t_case } from './case/index.ts';
import { tool as t_clamp } from './clamp/index.ts';
import { tool as t_clip } from './clip/index.ts';
import { tool as t_color } from './color/index.ts';
import { tool as t_count } from './count/index.ts';
import { tool as t_cron } from './cron/index.ts';
import { tool as t_csv } from './csv/index.ts';
import { tool as t_diff } from './diff/index.ts';
import { tool as t_dns } from './dns/index.ts';
import { tool as t_drop } from './drop/index.ts';
import { tool as t_gradient } from './gradient/index.ts';
import { tool as t_hash } from './hash/index.ts';
import { tool as t_hook } from './hook/index.ts';
import { tool as t_html } from './html/index.ts';
import { tool as t_http } from './http/index.ts';
import { tool as t_icon } from './icon/index.ts';
import { tool as t_img } from './img/index.ts';
import { tool as t_ip } from './ip/index.ts';
import { tool as t_json } from './json/index.ts';
import { tool as t_jwt } from './jwt/index.ts';
import { tool as t_lorem } from './lorem/index.ts';
import { tool as t_mail } from './mail/index.ts';
import { tool as t_md } from './md/index.ts';
import { tool as t_mock } from './mock/index.ts';
import { tool as t_notes } from './notes/index.ts';
import { tool as t_og } from './og/index.ts';
import { tool as t_password } from './password/index.ts';
import { tool as t_paste } from './paste/index.ts';
import { tool as t_qr } from './qr/index.ts';
import { tool as t_random } from './random/index.ts';
import { tool as t_rdap } from './rdap/index.ts';
import { tool as t_regex } from './regex/index.ts';
import { tool as t_send } from './send/index.ts';
import { tool as t_rss } from './rss/index.ts';
import { tool as t_s } from './s/index.ts';
import { tool as t_shadow } from './shadow/index.ts';
import { tool as t_slug } from './slug/index.ts';
import { tool as t_stash } from './stash/index.ts';
import { tool as t_time } from './time/index.ts';
import { tool as t_timer } from './timer/index.ts';
import { tool as t_todo } from './todo/index.ts';
import { tool as t_tz } from './tz/index.ts';
import { tool as t_unicode } from './unicode/index.ts';
import { tool as t_units } from './units/index.ts';
import { tool as t_uptime } from './uptime/index.ts';
import { tool as t_url } from './url/index.ts';
import { tool as t_uuid } from './uuid/index.ts';
import { tool as t_yaml } from './yaml/index.ts';

import { tool as t_sql } from './sql/index.ts';
import { tool as t_xml } from './xml/index.ts';
import { tool as t_css } from './css/index.ts';
import { tool as t_jsonpath } from './jsonpath/index.ts';
import { tool as t_jsonts } from './jsonts/index.ts';
import { tool as t_curl } from './curl/index.ts';
import { tool as t_httpcodes } from './httpcodes/index.ts';
import { tool as t_mime } from './mime/index.ts';
import { tool as t_useragent } from './useragent/index.ts';
import { tool as t_cidr } from './cidr/index.ts';
import { tool as t_chmod } from './chmod/index.ts';
import { tool as t_totp } from './totp/index.ts';
import { tool as t_keygen } from './keygen/index.ts';
import { tool as t_jwtgen } from './jwtgen/index.ts';
import { tool as t_cert } from './cert/index.ts';
import { tool as t_gitignore } from './gitignore/index.ts';
import { tool as t_license } from './license/index.ts';
import { tool as t_hex } from './hex/index.ts';
import { tool as t_escape } from './escape/index.ts';
import { tool as t_lines } from './lines/index.ts';
import { tool as t_table } from './table/index.ts';
import { tool as t_tree } from './tree/index.ts';
import { tool as t_rot } from './rot/index.ts';
import { tool as t_morse } from './morse/index.ts';
import { tool as t_roman } from './roman/index.ts';
import { tool as t_flex } from './flex/index.ts';
import { tool as t_grid } from './grid/index.ts';
import { tool as t_blob } from './blob/index.ts';
import { tool as t_palette } from './palette/index.ts';
import { tool as t_svg } from './svg/index.ts';
import { tool as t_typo } from './typo/index.ts';
import { tool as t_qrscan } from './qrscan/index.ts';
import { tool as t_date } from './date/index.ts';
import { tool as t_duration } from './duration/index.ts';
import { tool as t_calendar } from './calendar/index.ts';
import { tool as t_percent } from './percent/index.ts';
import { tool as t_loan } from './loan/index.ts';
import { tool as t_tip } from './tip/index.ts';
import { tool as t_stats } from './stats/index.ts';
import { tool as t_aspect } from './aspect/index.ts';
import { tool as t_bookmarks } from './bookmarks/index.ts';
import { tool as t_kanban } from './kanban/index.ts';
import { tool as t_draw } from './draw/index.ts';
import { tool as t_screen } from './screen/index.ts';
import { tool as t_secheaders } from './secheaders/index.ts';
import { tool as t_ai } from './ai/index.ts';
import { tool as t_vote } from './vote/index.ts';
import { tool as t_countdown } from './countdown/index.ts';
import { tool as t_keycode } from './keycode/index.ts';

// Launcher order. Add new tools here.
export const tools = [
  t_paste,
  t_s,
  t_hook,
  t_ip,
  t_drop,
  t_jwt,
  t_b64,
  t_diff,
  t_mock,
  t_mail,
  t_admin,
  t_labyrinth,
  t_json,
  t_uuid,
  t_hash,
  t_url,
  t_html,
  t_regex,
  t_cron,
  t_time,
  t_case,
  t_count,
  t_lorem,
  t_slug,
  t_md,
  t_color,
  t_qr,
  t_csv,
  t_yaml,
  t_password,
  t_random,
  t_units,
  t_base,
  t_unicode,
  t_gradient,
  t_shadow,
  t_clamp,
  t_icon,
  t_img,
  t_timer,
  t_calc,
  t_tz,
  t_notes,
  t_todo,
  t_dns,
  t_rdap,
  t_http,
  t_og,
  t_clip,
  t_stash,
  t_uptime,
  t_rss,
  t_send,
  t_sql,
  t_xml,
  t_css,
  t_jsonpath,
  t_jsonts,
  t_curl,
  t_httpcodes,
  t_mime,
  t_useragent,
  t_cidr,
  t_chmod,
  t_totp,
  t_keygen,
  t_jwtgen,
  t_cert,
  t_gitignore,
  t_license,
  t_hex,
  t_escape,
  t_lines,
  t_table,
  t_tree,
  t_rot,
  t_morse,
  t_roman,
  t_flex,
  t_grid,
  t_blob,
  t_palette,
  t_svg,
  t_typo,
  t_qrscan,
  t_date,
  t_duration,
  t_calendar,
  t_percent,
  t_loan,
  t_tip,
  t_stats,
  t_aspect,
  t_bookmarks,
  t_kanban,
  t_draw,
  t_screen,
  t_secheaders,
  t_ai,
  t_vote,
  t_countdown,
  t_keycode,
];
export const byName = new Map(tools.map((t) => [t.name, t]));
