import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  topic!: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(60)
  durationSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  style?: string;

  @IsOptional()
  @IsBoolean()
  captions?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  voiceId?: string;
}
