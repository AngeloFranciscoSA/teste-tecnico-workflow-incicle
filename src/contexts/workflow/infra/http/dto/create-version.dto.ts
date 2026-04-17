import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ApprovalRuleDto {
  ALL = 'ALL',
  ANY = 'ANY',
  QUORUM = 'QUORUM',
}

export class StepDto {
  @ApiProperty({ example: 'step-uuid-001', description: 'UUID do step' })
  @IsString() @IsNotEmpty() id: string;

  @ApiProperty({ example: 1, description: 'Ordem de execução do step (começa em 1)' })
  @IsInt() @Min(1) stepOrder: number;

  @ApiProperty({ example: 'Aprovação Gerência' })
  @IsString() @IsNotEmpty() stepName: string;

  @ApiProperty({ enum: ApprovalRuleDto, example: ApprovalRuleDto.ALL, description: 'ALL = todos aprovam, ANY = qualquer um, QUORUM = mínimo N' })
  @IsEnum(ApprovalRuleDto) approvalRule: ApprovalRuleDto;

  @ApiPropertyOptional({ example: 2, description: 'Obrigatório quando approvalRule = QUORUM' })
  @IsInt() @IsOptional() @Min(1) quorumCount?: number;

  @ApiProperty({ type: [String], example: ['user-uuid-1', 'user-uuid-2'], description: 'IDs dos aprovadores' })
  @IsArray() @IsString({ each: true }) approvers: string[];

  @ApiProperty({ example: 48, description: 'Prazo em horas para SLA do step' })
  @IsInt() @Min(1) slaHours: number;
}

export class CreateVersionDto {
  @ApiProperty({ example: 'ver-uuid-001', description: 'UUID da versão' })
  @IsString() @IsNotEmpty() id: string;

  @ApiProperty({ type: [StepDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => StepDto) steps: StepDto[];
}
