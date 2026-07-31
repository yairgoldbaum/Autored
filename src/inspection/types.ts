// Tipos del módulo de Inspección de Recepción con IA.
// La inspección ocurre cuando el compra-vendedor recibe físicamente el auto
// (Pre-stock / recién adjudicado) y antes de pasarlo a "En preparación".

export type Severidad = 'leve' | 'moderado' | 'grave';

export type CondicionZona = 'bueno' | 'regular' | 'malo';

export type Recomendacion = 'aprobar' | 'aprobar_con_reparos' | 'revision_mecanica';

export interface InspectionStep {
  id: string;
  titulo: string;
  descripcion: string;
  icon: string; // nombre FontAwesome6
  obligatoria: boolean;
}

// Checklist estándar de recepción de un compra-vendedor:
// carrocería completa, neumáticos, interior, tablero (km/testigos) y motor.
export const INSPECTION_STEPS: InspectionStep[] = [
  {
    id: 'frontal',
    titulo: 'Frontal',
    descripcion: 'Parachoques, capó, ópticos y parabrisas',
    icon: 'car',
    obligatoria: true,
  },
  {
    id: 'trasera',
    titulo: 'Trasera',
    descripcion: 'Portalón, parachoques trasero y focos',
    icon: 'car-rear',
    obligatoria: true,
  },
  {
    id: 'lateral_izq',
    titulo: 'Lateral Izquierdo',
    descripcion: 'Puertas, tapabarros y espejo izquierdo',
    icon: 'car-side',
    obligatoria: true,
  },
  {
    id: 'lateral_der',
    titulo: 'Lateral Derecho',
    descripcion: 'Puertas, tapabarros y espejo derecho',
    icon: 'car-side',
    obligatoria: true,
  },
  {
    id: 'neumaticos',
    titulo: 'Neumáticos y Llantas',
    descripcion: 'Desgaste de banda, daños en llantas',
    icon: 'circle-notch',
    obligatoria: false,
  },
  {
    id: 'interior',
    titulo: 'Interior',
    descripcion: 'Asientos, tapiz, consola y volante',
    icon: 'couch',
    obligatoria: true,
  },
  {
    id: 'tablero',
    titulo: 'Tablero Encendido',
    descripcion: 'Kilometraje y testigos de falla activos',
    icon: 'gauge-high',
    obligatoria: true,
  },
  {
    id: 'motor',
    titulo: 'Vano Motor',
    descripcion: 'Fugas, niveles, corrosión y soportes',
    icon: 'gears',
    obligatoria: false,
  },
];

export interface Hallazgo {
  titulo: string;
  descripcion: string;
  severidad: Severidad;
  costoEstimadoCLP: number;
  accionSugerida: string;
}

// Foto tomada durante la inspección. `base64` vive solo en memoria durante la
// sesión (no se persiste en AsyncStorage para no reventar el límite de storage).
export interface InspectionPhoto {
  stepId: string;
  uri: string;
  base64: string | null;
  mediaType: 'image/jpeg' | 'image/png';
}

export interface PhotoAnalysis {
  stepId: string;
  stepTitulo: string;
  uri: string;
  esFotoValida: boolean;
  condicion: CondicionZona;
  resumen: string;
  hallazgos: Hallazgo[];
}

export interface InspectionReport {
  carId: number;
  fecha: string; // ISO
  modelo: string; // usado para trazabilidad del informe
  analisis: PhotoAnalysis[];
  resumenGeneral: string;
  recomendacion: Recomendacion;
  notaCondicion: number; // 1 a 10
  costoTotalEstimadoCLP: number;
}

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  grave: 'Grave',
};

export const RECOMENDACION_LABEL: Record<Recomendacion, string> = {
  aprobar: 'Aprobar ingreso a preparación',
  aprobar_con_reparos: 'Aprobar con reparos',
  revision_mecanica: 'Requiere revisión mecánica',
};

export const CONDICION_LABEL: Record<CondicionZona, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
};
