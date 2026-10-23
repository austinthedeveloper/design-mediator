import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.products.findOne(id);
  }
}

@Controller("categories")
export class CategoriesController {
  @Get()
  list() {
    return [];
  }
}
