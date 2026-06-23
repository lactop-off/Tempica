import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AdminInput {
  @IsString() @MinLength(1) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

class OrgInput {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsInt() @Min(1) @Max(31) closeDay?: number;
}

export class SetupDto {
  @ValidateNested() @Type(() => OrgInput) organization!: OrgInput;
  @ValidateNested() @Type(() => AdminInput) admin!: AdminInput;
}
