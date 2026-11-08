import { type CanvasRenderingContext2D, createCanvas, loadImage, registerFont } from 'canvas';
import { DateTime } from 'luxon';
import sharp from 'sharp';
import { getFontPath } from './share.ts';

registerFont(getFontPath('pacifico.ttf'), { family: 'Pacifico' });
registerFont(getFontPath('roboto-regular.ttf'), { family: 'Roboto', weight: '400' });
registerFont(getFontPath('roboto-bold.ttf'), { family: 'Roboto', weight: '700' });

const WIDTH = 700;
const HEIGHT = 500;
const OUTPUT_SCALE = 2;
const PANEL_WIDTH = 324;
const PANEL_TOP = 94;
const PANEL_HEIGHT = 352;
const THEMES = {
  dark: {
    backgroundStart: '#191b21',
    backgroundEnd: '#151a20',
    panelStart: '#23272f',
    panelEnd: '#20242b',
    border: '#3a414d',
    accent: '#64b5f6',
    text: '#f2f3f5',
    muted: '#b7becb',
  },
  light: {
    backgroundStart: '#f8fafc',
    backgroundEnd: '#edf2f7',
    panelStart: '#ffffff',
    panelEnd: '#f8fafc',
    border: '#cbd5e1',
    accent: '#1565c0',
    text: '#1e293b',
    muted: '#526174',
  },
};

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let fitted = '';
  for (const character of text) {
    if (ctx.measureText(`${fitted}${character}…`).width > maxWidth) break;
    fitted += character;
  }
  return `${fitted.trimEnd()}…`;
};

export type ShareImageInput = {
  theme?: keyof typeof THEMES;
  username: string;
  bookTitles: string[];
  movieTitles: string[];
  profilePicture?: Uint8Array;
};

export const renderShareImage = async ({
  theme = 'dark',
  username,
  bookTitles,
  movieTitles,
  profilePicture,
}: ShareImageInput) => {
  const colors = theme === 'light' ? THEMES.light : THEMES.dark;
  const canvas = createCanvas(WIDTH * OUTPUT_SCALE, HEIGHT * OUTPUT_SCALE);
  const ctx = canvas.getContext('2d');
  ctx.scale(OUTPUT_SCALE, OUTPUT_SCALE);
  ctx.textBaseline = 'alphabetic';

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, colors.backgroundStart);
  background.addColorStop(1, colors.backgroundEnd);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  let headerLeft = 27;
  if (profilePicture) {
    const image = await loadImage(Buffer.from(profilePicture));
    const size = 60;
    const top = 21;
    const sourceSize = Math.min(image.width, image.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(headerLeft + size / 2, top + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      image,
      (image.width - sourceSize) / 2,
      (image.height - sourceSize) / 2,
      sourceSize,
      sourceSize,
      headerLeft,
      top,
      size,
      size,
    );
    ctx.restore();
    headerLeft += size + 14;
  }

  ctx.fillStyle = colors.text;
  ctx.font = '700 34px Roboto';
  ctx.fillText(fitText(ctx, username.replaceAll(/\s+/gu, ' '), 607 - headerLeft), headerLeft, 53);
  ctx.fillStyle = colors.muted;
  ctx.font = '400 18px Roboto';
  ctx.fillText('My top books & movies', headerLeft, 77);

  ctx.fillStyle = colors.text;
  ctx.font = '52px Pacifico';
  const logo = ctx.measureText('e');
  ctx.fillText('e', WIDTH - 27 - logo.actualBoundingBoxRight, 23 + logo.actualBoundingBoxAscent);

  const columns = [
    { x: 19, heading: 'Top books', titles: bookTitles.slice(0, 10), category: 'books' },
    { x: 357, heading: 'Top movies', titles: movieTitles.slice(0, 10), category: 'movies' },
  ];
  const rowHeight = 28;
  const rowsTop = 158;

  for (const { x, heading, titles, category } of columns) {
    const panel = ctx.createLinearGradient(x, PANEL_TOP, x + PANEL_WIDTH, PANEL_TOP + PANEL_HEIGHT);
    panel.addColorStop(0, colors.panelStart);
    panel.addColorStop(1, colors.panelEnd);
    ctx.fillStyle = panel;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, PANEL_TOP + 0.5, PANEL_WIDTH, PANEL_HEIGHT, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.font = '700 24px Roboto';
    ctx.fillText(heading, x + 19, 132);
    ctx.fillStyle = colors.border;
    ctx.fillRect(x + 15, 149, PANEL_WIDTH - 30, 1);

    if (titles.length === 0) {
      ctx.fillStyle = colors.muted;
      ctx.font = '400 16px Roboto';
      ctx.fillText(`No completed ${category} yet`, x + 19, 298);
      continue;
    }

    for (const [index, title] of titles.entries()) {
      const y = rowsTop + index * rowHeight;
      ctx.font = '700 17px Roboto';
      const text = title.replaceAll(/\s+/gu, ' ').trim();
      const titleWidth = PANEL_WIDTH - 78;
      const baseline = y + 20;

      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'right';
      ctx.fillText(String(index + 1), x + 39, baseline);
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.text;
      ctx.fillText(fitText(ctx, text, titleWidth), x + 59, baseline);
    }
  }

  ctx.fillStyle = colors.muted;
  ctx.font = '400 11px Roboto';
  ctx.textAlign = 'right';
  ctx.fillText(`Shared ${DateTime.now().setLocale('en').toFormat('d LLL yyyy')}`, WIDTH - 19, 475);

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return sharp(pixels, { raw: { width: canvas.width, height: canvas.height, channels: 4 } })
    .avif({ effort: 1 })
    .toBuffer();
};
