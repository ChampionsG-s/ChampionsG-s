export const TEAM_FLAGS: Record<string, string> = {
  'México': 'mx', 'Sudáfrica': 'za', 'Corea del Sur': 'kr', 'República Checa': 'cz',
  'Canadá': 'ca', 'Bosnia y Herzegovina': 'ba', 'Qatar': 'qa', 'Suiza': 'ch',
  'Brasil': 'br', 'Marruecos': 'ma', 'Haití': 'ht', 'Escocia': 'gb-sct',
  'Estados Unidos': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turquía': 'tr',
  'Alemania': 'de', 'Curaçao': 'cw', 'Costa de Marfil': 'ci', 'Ecuador': 'ec',
  'Países Bajos': 'nl', 'Japón': 'jp', 'Suecia': 'se', 'Túnez': 'tn',
  'Bélgica': 'be', 'Egipto': 'eg', 'Irán': 'ir', 'Nueva Zelanda': 'nz',
  'España': 'es', 'Cabo Verde': 'cv', 'Arabia Saudí': 'sa', 'Uruguay': 'uy',
  'Francia': 'fr', 'Senegal': 'sn', 'Irak': 'iq', 'Noruega': 'no',
  'Argentina': 'ar', 'Argelia': 'dz', 'Austria': 'at', 'Jordania': 'jo',
  'Portugal': 'pt', 'RD Congo': 'cd', 'Uzbekistán': 'uz', 'Colombia': 'co',
  'Inglaterra': 'gb-eng', 'Croacia': 'hr', 'Ghana': 'gh', 'Panamá': 'pa',
}

export const LEAGUE_TEAMS = [
  'FC Barcelona',
  'Real Madrid',
  'Atlético de Madrid',
  'Athletic Club',
  'Villarreal',
  'Real Betis',
  'Real Sociedad',
  'Valencia',
  'Sevilla',
  'Osasuna',
  'Celta de Vigo',
  'Rayo Vallecano',
  'Getafe',
  'Mallorca',
  'Las Palmas',
  'Girona',
  'Alavés',
  'Espanyol',
  'Leganés',
  'Real Valladolid',
] as const

export const ALL_TEAMS = [...LEAGUE_TEAMS]

export const JORNADAS = Array.from({ length: 38 }, (_, index) => `Jornada ${index + 1}`)

export const AWARDS = [
  { id: 'golden_ball', label: 'Balón de Oro', icon: '🥇', desc: 'Mejor jugador del torneo', pts: 10, type: 'player' as const },
  { id: 'silver_ball', label: 'Balón de Plata', icon: '🥈', desc: 'Segundo mejor jugador', pts: 10, type: 'player' as const },
  { id: 'bronze_ball', label: 'Balón de Bronce', icon: '🥉', desc: 'Tercer mejor jugador', pts: 10, type: 'player' as const },
  { id: 'golden_boot', label: 'Bota de Oro', icon: '👟', desc: 'Máximo goleador', pts: 10, type: 'player' as const },
  { id: 'silver_boot', label: 'Bota de Plata', icon: '👟', desc: '2º máximo goleador', pts: 10, type: 'player' as const },
  { id: 'bronze_boot', label: 'Bota de Bronce', icon: '👟', desc: '3er máximo goleador', pts: 10, type: 'player' as const },
  { id: 'golden_glove', label: 'Guante de Oro', icon: '🧤', desc: 'Mejor portero', pts: 8, type: 'player' as const },
  { id: 'best_young', label: 'Mejor Joven', icon: '🌟', desc: 'Mejor jugador sub-21', pts: 8, type: 'player' as const },
  { id: 'best_coach', label: 'Mejor Entrenador', icon: '👔', desc: 'Mejor director técnico', pts: 8, type: 'coach' as const },
  { id: 'fair_play', label: 'Premio Fair Play', icon: '🤝', desc: 'Mejor fair play', pts: 6, type: 'team' as const },
  { id: 'champion', label: 'Campeón', icon: '🏆', desc: 'Ganador del Mundial', pts: 12, type: 'team' as const },
  { id: 'runner_up', label: 'Subcampeón', icon: '🥈', desc: 'Finalista perdedor', pts: 8, type: 'team' as const },
  { id: 'third_place', label: 'Tercer Puesto', icon: '🥉', desc: '3er clasificado', pts: 6, type: 'team' as const },
  { id: 'top_scorer_t', label: 'Equipo más goleador', icon: '⚽', desc: 'Más goles en el torneo', pts: 6, type: 'team' as const },
]

export const SPAIN_FIELDS = [
  { id: 'es_s1', label: '1er Goleador España', desc: 'Máximo goleador español', pts: 10, type: 'player' as const },
  { id: 'es_s2', label: '2º Goleador España', desc: 'Segundo goleador español', pts: 8, type: 'player' as const },
  { id: 'es_s3', label: '3er Goleador España', desc: 'Tercer goleador español', pts: 6, type: 'player' as const },
  { id: 'es_s4', label: '4º Goleador España', desc: 'Cuarto goleador español', pts: 4, type: 'player' as const },
  { id: 'es_g1', label: '1º Grupo H', desc: 'Primero del Grupo H', pts: 6, type: 'select' as const, options: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'] },
  { id: 'es_g2', label: '2º Grupo H', desc: 'Segundo del Grupo H', pts: 4, type: 'select' as const, options: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'] },
  { id: 'es_g3', label: '3º Grupo H', desc: 'Tercero del Grupo H', pts: 2, type: 'select' as const, options: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'] },
  { id: 'es_fase', label: 'Fase que llega España', desc: '¿Hasta qué ronda llegará España?', pts: 8, type: 'select' as const, options: ['Fase de grupos', '32avos', 'Octavos', 'Cuartos', 'Semis', '3er Puesto', 'CAMPEÓN'] },
  { id: 'es_expyn', label: '¿Algún expulsado?', desc: '¿Tendrá España algún expulsado?', pts: 4, type: 'select' as const, options: ['Sí', 'No'] },
  { id: 'es_exp1', label: '1er Expulsado España', desc: 'Primer jugador español expulsado', pts: 10, type: 'player' as const },
  { id: 'es_exp2', label: '2º Expulsado España', desc: 'Segundo jugador español expulsado', pts: 8, type: 'player' as const },
  { id: 'es_goals', label: 'Total goles España', desc: 'Goles que marcará España en todo el torneo', pts: 8, type: 'number' as const },
  { id: 'es_wins', label: 'Victorias de España', desc: 'Partidos que ganará España', pts: 6, type: 'number' as const },
]

export const SPAIN_SQUAD_DEFAULT = [
  'Unai Simón', 'David Raya', 'Álex Remiro',
  'Pedro Porro', 'Alejandro Balde', 'Marc Cucurella', 'Pau Cubarsí',
  'Aymeric Laporte', 'Robin Le Normand', 'Dani Vivian', 'Tete Morente',
  'Rodri', 'Pedri', 'Fabián Ruiz', 'Mikel Merino', 'Martín Zubimendi',
  'Gavi', 'Fermín López', 'Pablo Barrios', 'Álex Baena', 'Dani Olmo',
  'Lamine Yamal', 'Nico Williams', 'Mikel Oyarzabal', 'Bryan Gil',
  'Yeremy Pino', 'Borja Iglesias',
]

export const PHASE_INFO: Record<string, { label: string; full: string; ptsExact: number; ptsWinner: number }> = {
  grupos:   { label: 'Grupos',   full: 'Fase de grupos',  ptsExact: 3,  ptsWinner: 1 },
  '32avos': { label: '32avos',   full: '32avos de final', ptsExact: 5,  ptsWinner: 2 },
  octavos:  { label: 'Octavos',  full: 'Octavos de final',ptsExact: 5,  ptsWinner: 2 },
  cuartos:  { label: 'Cuartos',  full: 'Cuartos de final',ptsExact: 6,  ptsWinner: 3 },
  semis:    { label: 'Semis',    full: 'Semifinales',     ptsExact: 8,  ptsWinner: 4 },
  '3er':    { label: '3er',      full: '3er Puesto',      ptsExact: 6,  ptsWinner: 3 },
  final:    { label: 'Final',    full: 'Gran Final',      ptsExact: 10, ptsWinner: 5 },
}

export const PHASE_ORDER = ['grupos', '32avos', 'octavos', 'cuartos', 'semis', '3er', 'final']
