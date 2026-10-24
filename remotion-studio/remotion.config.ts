/**
 * Remotion configuration.
 *
 * Note the explicit browser executable: this environment has no Chrome
 * Headless Shell download access, so bootstrap.sh extracts the Chromium that
 * ships inside the @sparticuz/chromium npm tarball into .tools/chromium and we
 * point Remotion at it here (overridable with --browser-executable).
 */
import {Config} from '@remotion/cli/config';
import path from 'node:path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
Config.setChromiumOpenGlRenderer('swangle');
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');

const root = path.resolve(process.cwd(), '..');
const chrome = path.join(root, '.tools', 'chromium', 'chromium');
if (process.env.YTV_CHROME || require('node:fs').existsSync(chrome)) {
  Config.setBrowserExecutable(process.env.YTV_CHROME || chrome);
}

// local fonts live in public/fonts (copied from ../fonts by bootstrap)
Config.setPublicDir(path.resolve(process.cwd(), 'public'));
