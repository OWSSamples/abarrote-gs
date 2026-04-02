// Catálogo de servicios — shared constant (NOT a 'use server' module)

/** Available service categories with display names and commission rates */
export const SERVICIO_CATALOGO = {
  recargas: [
    { id: 'telcel', nombre: 'Telcel', montos: [20, 30, 50, 80, 100, 150, 200, 300, 500], comisionPct: 4 },
    { id: 'movistar', nombre: 'Movistar', montos: [20, 30, 50, 80, 100, 150, 200, 300, 500], comisionPct: 4 },
    { id: 'att', nombre: 'AT&T / Unefon', montos: [20, 30, 50, 80, 100, 150, 200, 300, 500], comisionPct: 3.5 },
    { id: 'bait', nombre: 'Bait', montos: [30, 50, 100, 150, 200, 300], comisionPct: 5 },
    { id: 'virgin', nombre: 'Virgin Mobile', montos: [30, 50, 100, 200], comisionPct: 4 },
    { id: 'altan', nombre: 'Altán Redes', montos: [50, 100, 150, 200, 300], comisionPct: 5 },
  ],
  servicios: [
    { id: 'cfe', nombre: 'CFE (Luz)', montoLibre: true, comisionFija: 8 },
    { id: 'agua', nombre: 'Agua', montoLibre: true, comisionFija: 8 },
    { id: 'gas_natural', nombre: 'Gas Natural', montoLibre: true, comisionFija: 8 },
    { id: 'telmex', nombre: 'Telmex', montoLibre: true, comisionFija: 10 },
    { id: 'izzi', nombre: 'izzi', montoLibre: true, comisionFija: 10 },
    { id: 'totalplay', nombre: 'Totalplay', montoLibre: true, comisionFija: 10 },
    { id: 'megacable', nombre: 'Megacable', montoLibre: true, comisionFija: 10 },
    { id: 'sky', nombre: 'Sky', montoLibre: true, comisionFija: 8 },
    { id: 'dish', nombre: 'Dish', montoLibre: true, comisionFija: 8 },
  ],
} as const;
