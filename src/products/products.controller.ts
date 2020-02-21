import { User } from 'src/entities/user.entity';
import { Controller, Header, Get, Param, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile, UploadedFiles, Inject, Query, Response } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ProductsService } from "./products.service";
import { FileInterceptor, FilesInterceptor, AnyFilesInterceptor } from "@nestjs/platform-express";
import { MinioService } from "nestjs-minio-client";
import { extname } from "path";
import { diskStorage } from "multer";

@Controller("products")
export class ProductsController {
  constructor (public productService: ProductsService, private readonly minioClient: MinioService) { }

    @Get()
    async getProducts () {
      const products = await this.productService.getFullTable();
      return products;
    }

    @Get("download")
    async downloadImg(@Query('file') file, @Response() res) {
      return this.minioClient.client.getObject('mybucket', file , function(err, dataStream) {
          if(err) {
              return res.status(500).send(err);
          }
          dataStream.pipe(res);
      })
    }
  

    @Get(":id")
    getUser (@Param() params) {
      const id = params.id;
      return this.productService.getRow(id);
    }

    @UseGuards(AuthGuard("jwt"))
    @Post("add")
    @UseInterceptors(FileInterceptor("avatar", {
      storage: diskStorage({
        filename: (req, file, cb) => {
          const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join("");
          cb(null, `${randomName}${extname(file.originalname)}`);
        }
      })
    }))
    async createProduct(@UploadedFile() file, @Request() req) {
      const user = req.user
      const imgName = file.filename
      const product = {
        name: req.body.title,
        description: req.body.description,
        avatar: imgName,
        number:  Number.parseInt(req.body.count)
      }
      this.productService.addProduct(product, user)
      const metaData = {
        'Content-Type': 'image',
      };
      this.minioClient.client.fPutObject("mybucket", imgName, file.path, metaData, function (err, etag) {
        return console.log(err, etag);
      });
    }
}
