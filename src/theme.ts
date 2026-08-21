// Paleta AutoRed, derivada del logo (logoauto.jpg):
//   - cian de marca  #00AEEF  (la silueta del auto y "RED")
//   - grafito        #4A4A4A  ("AUTO")
// Los nombres teal*/chileanTeal se conservan porque están referenciados en toda
// la app; sus VALORES ahora son la rampa cian de marca, así que el acento de
// AutoRed queda aplicado de forma consistente sin un rename masivo.
export const C = {
  white: '#FFFFFF',
  black: '#000000',

  // Marca (usar estos en código nuevo)
  brand: '#00AEEF',
  brandDark: '#0090C8',
  brandDeep: '#0A6E96',
  graphite: '#4A4A4A',
  ink: '#22272B',

  chileanNavy: '#22272B',
  chileanTeal: '#00AEEF',
  chileanTealDark: '#0090C8',
  chileanBg: '#F7F9FA',

  slate50: '#F7F9FA',
  slate100: '#EEF1F3',
  slate200: '#DFE4E8',
  slate300: '#C6CDD3',
  slate400: '#98A2AA',
  slate500: '#6B747C',
  slate600: '#525A61',
  slate700: '#3D444A',
  slate800: '#2B3136',
  slate900: '#22272B',
  slate950: '#12161A',

  // Rampa cian de marca (nombres heredados "teal*")
  teal50: '#ECF8FE',
  teal100: '#D2EFFC',
  teal200: '#A9E1FA',
  teal300: '#6FCEF6',
  teal400: '#35BAF2',
  teal500: '#12AEEF',
  teal600: '#00AEEF',
  teal700: '#0090C8',
  teal800: '#0A6E96',
  teal900: '#0B5474',

  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald200: '#A7F3D0',
  emerald400: '#34D399',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065F46',

  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber200: '#FDE68A',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber700: '#B45309',
  amber800: '#92400E',

  blue50: '#EFF6FF',
  blue100: '#DBEAFE',
  blue700: '#1D4ED8',

  purple50: '#FAF5FF',
  purple100: '#F3E8FF',
  purple700: '#7E22CE',

  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red600: '#DC2626',
  red700: '#B91C1C',
};

// Pesos de fuente equivalentes a Tailwind
export const W = {
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// Separador de miles manual (respaldo si Intl no está disponible en el runtime)
const milesManual = (num: number) =>
  String(Math.round(Math.abs(num))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Formatear pesos chilenos (equivalente al fmtCLP del HTML)
export const fmtCLP = (num: number) => {
  const n = Number.isFinite(num) ? num : 0;
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n < 0 ? '-' : ''}$${milesManual(n)}`;
  }
};

// Miles con separador chileno (equivale a .toLocaleString('es-CL'))
export const fmtMiles = (num: number) => {
  const n = Number.isFinite(num) ? num : 0;
  try {
    return new Intl.NumberFormat('es-CL').format(n);
  } catch {
    return `${n < 0 ? '-' : ''}${milesManual(n)}`;
  }
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Nombre del mes en curso (para KPIs como "Ventas de Julio")
export const mesActual = () => MESES[new Date().getMonth()];
