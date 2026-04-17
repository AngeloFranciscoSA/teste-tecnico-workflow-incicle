import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInstanceDto {
  @ApiProperty({ example: 'inst-uuid-001', description: 'UUID da instância (gerado pelo cliente)' })
  @IsString() @IsNotEmpty() id: string;

  @ApiProperty({ example: 'a0000000-0000-0000-0000-000000000010', description: 'UUID do template' })
  @IsString() @IsNotEmpty() templateId: string;

  @ApiProperty({ example: 'ver-uuid-001', description: 'UUID da versão publicada' })
  @IsString() @IsNotEmpty() versionId: string;
}
