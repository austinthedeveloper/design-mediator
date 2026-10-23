import { IsInt, IsString, IsUUID, MaxLength, Min, Matches } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @Matches(/^[A-Z0-9-]{4,20}$/)
  sku: string;

  /** Price in cents */
  @IsInt()
  @Min(0)
  priceCents: number;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  weightGrams: number;
}
