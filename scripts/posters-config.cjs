const shot = (name) => `screenshots/${name}`
const source = (name) => `scripts/poster-sources/${name}.webp`

const MOBILE = [
  {
    name: 'mahalla',
    screens: [source('mahalla-1'), source('mahalla-2'), source('mahalla-3')],
  },
  {
    name: 'okh',
    screens: [source('okh-1'), source('okh-2'), source('okh-3')],
  },
  {
    name: 'altn',
    screens: [shot('altn-emu-1.png'), shot('altn-emu-2.png')],
  },
  {
    name: 'avtopark',
    screens: [source('avtopark-1'), source('avtopark-2'), source('avtopark-3')],
    radius: 0.13,
  },
  {
    name: 'besttracker',
    screens: [
      source('besttracker-1'),
      source('besttracker-2'),
      source('besttracker-3'),
    ],
    radius: 0.1,
  },
  {
    name: 'geoblinker',
    screens: [shot('geoblinker-emu-2.png'), shot('geoblinker-emu-1.png')],
  },
  {
    name: 'mynails',
    screens: [
      shot('mynails-1.png'),
      shot('mynails-2.png'),
      shot('mynails-3.png'),
    ],
  },
  {
    name: 'stefa',
    screens: [shot('stefa-1.png'), shot('stefa-3.png'), shot('stefa-4.png')],
  },
  {
    name: 'tildonmobile',
    screens: [
      source('tildonmobile-1'),
      source('tildonmobile-2'),
      source('tildonmobile-3'),
    ],
  },
  {
    name: 'wallpapers',
    screens: [
      shot('wallpapers-1.png'),
      shot('wallpapers-3.png'),
      shot('wallpapers-4.png'),
    ],
  },
  {
    name: 'wegotrip',
    screens: [source('wegotrip-1'), source('wegotrip-2'), source('wegotrip-3')],
    radius: 0.12,
  },
  {
    name: 'yolo',
    screens: [source('yolo-1')],
    radius: 0.13,
  },
]

const WEB = [
  {
    name: 'agentmama',
    url: 'https://agentmama.ru',
    raw: source('agentmama-1'),
  },
  {
    name: 'matik',
    url: 'https://matematik-uz.vercel.app',
    raw: source('matik-1'),
  },
  { name: 'ailogoedit', url: 'https://ailogoedit.com', accept: true },
  { name: 'monro', url: 'https://monro-landing.vercel.app' },
  { name: 'olympic', url: 'https://olympic-almaty.vercel.app' },
  { name: 'pixelvault', url: 'https://pixelvault.vercel.app' },
  {
    name: 'supertour',
    url: 'https://supertour.uz',
    fallback: source('supertour-1'),
  },
  { name: 'tildon', url: 'https://tildon.vercel.app' },
  { name: 'vfx', url: 'https://vfx-timecode.vercel.app' },
]

const SCENE = [
  { name: 'earth', url: 'https://earth-cosmos.vercel.app', wait: 8000 },
  { name: 'vertolyot', url: 'https://vertolyot.vercel.app', wait: 18000 },
]

module.exports = { MOBILE, WEB, SCENE }
