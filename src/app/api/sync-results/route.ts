import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Team name mapping: football-data.org (English) → our DB (Spanish) ────────
const API_MAP: Record<string, string> = {
  'Spain': 'España', 'France': 'Francia', 'Germany': 'Alemania', 'Brazil': 'Brasil',
  'Argentina': 'Argentina', 'Portugal': 'Portugal', 'England': 'Inglaterra',
  'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica', 'Croatia': 'Croacia',
  'Uruguay': 'Uruguay', 'Colombia': 'Colombia', 'Morocco': 'Marruecos',
  'Senegal': 'Senegal', 'Japan': 'Japón', 'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur', 'Republic of Korea': 'Corea del Sur',
  'Australia': 'Australia', 'Mexico': 'México', 'United States': 'Estados Unidos',
  'USA': 'Estados Unidos', 'Canada': 'Canadá', 'Saudi Arabia': 'Arabia Saudí',
  'Iran': 'Irán', 'IR Iran': 'Irán', 'Ecuador': 'Ecuador', 'Switzerland': 'Suiza',
  'Ghana': 'Ghana', 'Tunisia': 'Túnez', 'South Africa': 'Sudáfrica',
  'Czech Republic': 'República Checa', 'Czechia': 'República Checa',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina', 'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
  'Qatar': 'Qatar',
  'Haiti': 'Haití', 'Scotland': 'Escocia', 'Paraguay': 'Paraguay',
  'Turkey': 'Turquía', 'Türkiye': 'Turquía',
  "Ivory Coast": 'Costa de Marfil', "Côte d'Ivoire": 'Costa de Marfil',
  'Sweden': 'Suecia', 'New Zealand': 'Nueva Zelanda', 'Egypt': 'Egipto',
  'Cape Verde': 'Cabo Verde', 'Cape Verde Islands': 'Cabo Verde',
  'Iraq': 'Irak', 'Norway': 'Noruega',
  'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
  'DR Congo': 'RD Congo', 'Congo DR': 'RD Congo', 'Uzbekistan': 'Uzbekistán',
  'Panama': 'Panamá', 'Curacao': 'Curaçao', 'Serbia': 'Serbia',
}

export async function GET(request: Request) {
  return NextResponse.json({ ok: true, message: 'Legacy World Cup sync disabled for Champions G\'s.' })
}