import { CanvasRenderingContext2D, createCanvas, registerFont } from 'canvas';
import { DateTime } from 'luxon';
import { getFontPath } from './share';

registerFont(getFontPath('pacifico.ttf'), { family: 'Pacifico' });
registerFont(getFontPath('roboto-regular.ttf'), { family: 'Roboto', weight: '400' });
registerFont(getFontPath('roboto-bold.ttf'), { family: 'Roboto', weight: '700' });

const WIDTH = 700;
const HEIGHT = 500;
const PANEL_WIDTH = 324;
const PANEL_TOP = 94;
const PANEL_HEIGHT = 352;
const ACCENT_COLOR = '#64b5f6';
const TEXT_COLOR = '#f2f3f5';
const MUTED_COLOR = '#b7becb';

const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let fitted = '';
  for (const character of text) {
    if (ctx.measureText(`${fitted}${character}…`).width > maxWidth) break;
    fitted += character;
  }
  return `${fitted.trimEnd()}…`;
};

export const renderShareImage = ({
  username,
  bookTitles,
  movieTitles,
}: {
  username: string;
  bookTitles: string[];
  movieTitles: string[];
}) => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#191b21');
  background.addColorStop(1, '#151a20');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '700 36px Roboto';
  ctx.fillText(fitText(ctx, username.replaceAll(/\s+/gu, ' '), 580), 27, 53);
  ctx.fillStyle = MUTED_COLOR;
  ctx.font = '400 18px Roboto';
  ctx.fillText('My top books & movies', 27, 77);

  ctx.fillStyle = TEXT_COLOR;
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
    panel.addColorStop(0, '#23272f');
    panel.addColorStop(1, '#20242b');
    ctx.fillStyle = panel;
    ctx.strokeStyle = '#3a414d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, PANEL_TOP + 0.5, PANEL_WIDTH, PANEL_HEIGHT, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '700 24px Roboto';
    ctx.fillText(heading, x + 19, 132);
    ctx.fillStyle = '#3a414d';
    ctx.fillRect(x + 15, 149, PANEL_WIDTH - 30, 1);

    if (titles.length === 0) {
      ctx.fillStyle = MUTED_COLOR;
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

      ctx.fillStyle = ACCENT_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(String(index + 1), x + 39, baseline);
      ctx.textAlign = 'left';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(fitText(ctx, text, titleWidth), x + 59, baseline);
    }
  }

  ctx.fillStyle = MUTED_COLOR;
  ctx.font = '400 11px Roboto';
  ctx.textAlign = 'right';
  ctx.fillText(`Shared ${DateTime.now().setLocale('en').toFormat('d LLL yyyy')}`, WIDTH - 19, 475);

  ctx.strokeStyle = ACCENT_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);

  return canvas.toBuffer('image/png');
};
