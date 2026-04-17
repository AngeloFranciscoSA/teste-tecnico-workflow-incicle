import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DecideStepDto {
  @ApiPropertyOptional({ example: 'Aprovado conforme política interna', description: 'Justificativa opcional' })
  @IsString() @IsOptional() comment?: string;
}
