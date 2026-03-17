import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrazabilidadService } from 'src/external-db/trazabilidad.service';
 

export interface ComparativaRow {
  id: number | null;
  interno: string;
  pedido: string | null;
  dimodex: string | null;
  factura: string | null;
  pasotrazabilidad: number | null;
  pasointerno: number | null;
  pasotxt: string | null;
  cliente: string | null;
  habilitado: boolean;
  sincronizado: 'ACTUALIZADO' | 'DESACTUALIZADO' | 'INHABILITADO';
}

@Injectable()
export class ComparativaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trazabilidad: TrazabilidadService,
  ) {}

  async getComparativa(): Promise<ComparativaRow[]> {
    // 1. Traer todos los trámites externos
    const externos = await this.trazabilidad.fetchTodos();

    if (!externos.length) return [];

    // 2. Traer todos los internos locales de una sola vez
    const internosTextos = externos.map((e) => e.internoTexto as string);

    const locales = await this.prisma.interno.findMany({
      where: {
        interno: { in: internosTextos },
        deletedAt: null,
      },
      select: {
        id: true,
        interno: true,
        paso: true,
        cliente: true,
      },
    });

    // 3. Indexar locales por campo 'interno' para búsqueda O(1)
    const localesMap = new Map(locales.map((l) => [l.interno, l]));

    // 4. Comparar y construir respuesta
    return externos.map((ext) => {
      const textoInterno = ext.internoTexto as string;
      const local = localesMap.get(textoInterno) ?? null;

      const habilitado = local !== null;

      let sincronizado: ComparativaRow['sincronizado'];
      if (!local) {
        sincronizado = 'INHABILITADO';
      } else if (local.paso === (ext.paso as number)) {
        sincronizado = 'ACTUALIZADO';
      } else {
        sincronizado = 'DESACTUALIZADO';
      }

      return {
        id: local?.id ?? null,
        interno: textoInterno,
        pedido: (ext.pedido as string) ?? null,
        dimodex: (ext.dimodex as string) ?? null,
        factura: (ext.factura as string) ?? null,
        pasotrazabilidad: (ext.paso as number) ?? null,
        pasointerno: (local?.paso as number) ?? null,
        pasotxt: ext.pasotxt ?? null,
        cliente: (ext.b1_razonSocial as string) ?? null,
        habilitado,
        sincronizado,
      };
    });
  }
}