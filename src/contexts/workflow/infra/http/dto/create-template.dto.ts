import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000010', description: 'UUID do template' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Aprovação de Compras', description: 'Nome do template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Fluxo padrão de aprovação de compras acima de R$ 10.000' })
  @IsString()
  @IsOptional()
  description?: string;
}
